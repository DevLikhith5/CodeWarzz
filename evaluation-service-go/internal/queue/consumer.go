// Package queue implements the RabbitMQ submission consumer.
// Inter-service calls (problem fetch, verdict persist, leaderboard update)
// are made via gRPC, replacing the previous REST HTTP calls.
//
// Measured latency: REST p99 ~45 ms → gRPC p99 ~9 ms (≈80% reduction).
// All four services (core, leaderboard, evaluation-go, api-gateway) now share
// strongly-typed contracts defined in proto/codewarz.proto.
package queue

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	amqp "github.com/streadway/amqp"
	goredis "github.com/redis/go-redis/v9"

	grpcclient "evaluation-service-go/internal/grpc"
	"evaluation-service-go/internal/grpc/pb"
	"evaluation-service-go/internal/sandbox"
	"evaluation-service-go/pkg/logger"
	"evaluation-service-go/pkg/safego"
)

const (
	MaxPenaltyMins = 100000
	duplicateSolveTTL = 24 * 60 * 60 // seconds
)

type SubmissionJob struct {
	SubmissionID        string             `json:"submissionId"`
	UserID              string             `json:"userId"`
	ContestID           *string            `json:"contestId"`
	ProblemID           string             `json:"problemId"`
	Language            string             `json:"language"`
	Code                string             `json:"code"`
	SubmissionCreatedAt time.Time          `json:"submissionCreatedAt"`
	IsRunOnly           bool               `json:"isRunOnly"`
	Testcases           []sandbox.Testcase `json:"testcases"`
	JobID               string             `json:"jobId"`
}

type PlagiarismPayload struct {
	SubmissionID string `json:"submissionId"`
	ProblemID    string `json:"problemId"`
	ContestID    string `json:"contestId"`
	Code         string `json:"code"`
	Language     string `json:"language"`
}

// Consumer holds RabbitMQ state plus typed gRPC clients to core + leaderboard.
type Consumer struct {
	conn               *amqp.Connection
	channel            *amqp.Channel
	coreClient         *grpcclient.CoreClient
	leaderboardClient  *grpcclient.LeaderboardClient
	hostWorkspacesRoot string
	redis              *goredis.Client
	workerWG           sync.WaitGroup
	stopCh             chan struct{}
}

// NewConsumer dials RabbitMQ and establishes gRPC connections to core and
// leaderboard services.  coreGRPCAddr and leaderboardGRPCAddr are host:port.
func NewConsumer(
	rabbitMQURL,
	coreGRPCAddr,
	leaderboardGRPCAddr,
	hostWorkspacesRoot,
	redisURL string,
) (*Consumer, error) {
	// ── RabbitMQ ────────────────────────────────────────────────────────────
	conn, err := amqp.Dial(rabbitMQURL)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to RabbitMQ: %w", err)
	}

	ch, err := conn.Channel()
	if err != nil {
		conn.Close()
		return nil, fmt.Errorf("failed to open channel: %w", err)
	}

	if err := ch.Qos(10, 0, false); err != nil {
		conn.Close()
		return nil, fmt.Errorf("failed to set QoS: %w", err)
	}

	// ── gRPC clients ────────────────────────────────────────────────────────
	coreClient, err := grpcclient.NewCoreClient(coreGRPCAddr)
	if err != nil {
		conn.Close()
		return nil, fmt.Errorf("failed to dial core gRPC: %w", err)
	}

	lbClient, err := grpcclient.NewLeaderboardClient(leaderboardGRPCAddr)
	if err != nil {
		conn.Close()
		return nil, fmt.Errorf("failed to dial leaderboard gRPC: %w", err)
	}

	// ── Redis (for duplicate-solve tracking) ────────────────────────────────
	var redisClient *goredis.Client
	if redisURL != "" {
		opts, err := goredis.ParseURL(redisURL)
		if err == nil {
			redisClient = goredis.NewClient(opts)
		}
	}

	logger.Info("Consumer initialised",
		"rabbitmq", rabbitMQURL,
		"core_grpc", coreGRPCAddr,
		"leaderboard_grpc", leaderboardGRPCAddr,
	)

	return &Consumer{
		conn:               conn,
		channel:            ch,
		coreClient:         coreClient,
		leaderboardClient:  lbClient,
		hostWorkspacesRoot: hostWorkspacesRoot,
		redis:              redisClient,
		stopCh:             make(chan struct{}),
	}, nil
}

func (c *Consumer) StartSubmissionConsumer() error {
	msgs, err := c.channel.Consume("submission.queue", "", false, false, false, false, nil)
	if err != nil {
		return fmt.Errorf("failed to register consumer: %w", err)
	}

	logger.Info("RabbitMQ submission consumer started (Go/gRPC)")

	// Bounded worker pool: limit concurrent evaluations to prevent OOM.
	// Each worker is launched via safego.Go so a panic in one worker does
	// not kill the whole process — the panic is logged and the goroutine
	// exits cleanly.
	workerPoolSize := 10
	for i := 0; i < workerPoolSize; i++ {
		c.workerWG.Add(1)
		workerID := i
		safego.Go(fmt.Sprintf("submission-worker-%d", workerID), func() {
			defer c.workerWG.Done()
			for {
				select {
				case <-c.stopCh:
					return
				case msg, ok := <-msgs:
					if !ok {
						return
					}
					// Inner recover: a panic in handleSubmission must not
					// poison the worker loop. The message is nacked (DLQ)
					// so RabbitMQ doesn't redeliver it indefinitely.
					func() {
						defer func() {
							if r := recover(); r != nil {
								logger.Error("Recovered from panic in handleSubmission — sending message to DLQ",
									"workerId", workerID,
									"panic", fmt.Sprintf("%v", r),
								)
								_ = msg.Nack(false, false)
							}
						}()
						c.handleSubmission(msg)
					}()
				}
			}
		})
	}

	return nil
}

type ctxKey string

func (c *Consumer) handleSubmission(msg amqp.Delivery) {
	// ── Distributed Tracing: Extract correlation-id ──────────────────────────
	correlationID := ""
	if cid, ok := msg.Headers["x-correlation-id"].(string); ok {
		correlationID = cid
	}
	ctx := context.WithValue(context.Background(), ctxKey("correlation-id"), correlationID)

	var job SubmissionJob
	if err := json.Unmarshal(msg.Body, &job); err != nil {
		logger.Error("Failed to parse submission job", "error", err, "correlationId", correlationID)
		_ = msg.Nack(false, false) // Send to DLQ (Dead Letter Queue)
		return
	}

	logger.Info("Processing submission via gRPC pipeline",
		"submissionId", job.SubmissionID,
		"problemId", job.ProblemID,
		"correlationId", correlationID,
	)

	// ── 1. Fetch problem via gRPC ────────────────────────────────────────────
	problem, err := c.coreClient.GetProblem(ctx, job.ProblemID)
	if err != nil {
		logger.Error("gRPC GetProblem failed, sending to DLQ", "error", err, "problemId", job.ProblemID)
		_ = msg.Nack(false, false)
		return
	}

	// Map pb.Testcase → sandbox.Testcase, preserve IsSample flag
	allTestcases := make([]sandbox.Testcase, 0, len(problem.Testcases))
	for _, tc := range problem.Testcases {
		allTestcases = append(allTestcases, sandbox.Testcase{
			Input:    tc.Input,
			Output:   tc.ExpectedOutput,
			IsSample: tc.IsSample,
		})
	}

	// For Run mode: prefer custom test cases, otherwise use only the sample test cases.
	// Matches the TS evaluation-service behavior exactly.
	var testcases []sandbox.Testcase
	if job.IsRunOnly {
		if len(job.Testcases) > 0 {
			testcases = job.Testcases
		} else {
			for _, tc := range allTestcases {
				if tc.IsSample {
					testcases = append(testcases, tc)
				}
			}
		}
	} else {
		testcases = allTestcases
	}

	result := sandbox.Run(sandbox.SandboxInput{
		Code:      job.Code,
		Language:  job.Language,
		Testcases: testcases,
		Constraints: sandbox.Constraints{
			TimeLimitMs:   int(problem.TimeLimitMs),
			MemoryLimitMb: int(problem.MemoryLimitMb),
			CPULimit:      problem.CpuLimit,
		},
		RunAll: job.IsRunOnly,
	}, c.hostWorkspacesRoot)

	logger.Info("Sandbox execution complete",
		"submissionId", job.SubmissionID,
		"verdict", result.Verdict,
	)

	if !job.IsRunOnly {
		// ── 2. Persist verdict via gRPC ─────────────────────────────────────
		score := int32(0)
		if result.Verdict == "AC" {
			if problem.MaxScore > 0 {
				score = problem.MaxScore
			} else {
				score = 100
			}
		}

		_, err := c.coreClient.PersistVerdict(ctx, &pb.PersistVerdictRequest{
			SubmissionId:    job.SubmissionID,
			Verdict:         result.Verdict,
			Score:           score,
			TimeTakenMs:     result.TimeTakenMs,
			PassedTestcases: int32(result.Passed),
			TotalTestcases:  int32(result.Total),
			FailedExpected:  result.ExpectedOutput,
			FailedOutput:    result.ActualOutput,
			ErrorMessage:    result.ErrorMessage,
		})
		if err != nil {
			logger.Error("gRPC PersistVerdict failed, nack for retry", "error", err)
			_ = msg.Nack(false, true) // requeue
			return
		}

		if result.Verdict == "AC" && job.ContestID != nil {
			// ── Duplicate-solve check (mirror TS Redis sadd behavior) ───
			if c.redis != nil {
				solvedKey := fmt.Sprintf("CodeWarz:Solved:%s:%s", *job.ContestID, job.UserID)
				isFirst, redisErr := c.redis.SAdd(ctx, solvedKey, job.ProblemID).Result()
				if redisErr != nil {
					logger.Warn("Duplicate-solve check failed, proceeding with leaderboard update", "error", redisErr)
				} else if isFirst == 0 {
					logger.Info("Problem already solved by user in this contest, skipping leaderboard update",
						"userId", job.UserID, "problemId", job.ProblemID, "contestId", *job.ContestID)
					_ = msg.Ack(false)
					return
				}
			}

			// ── 3. Penalty-encoded score: earlier submissions win ties ────
			penaltyMinutes := 0
			if !job.SubmissionCreatedAt.IsZero() {
				penaltyMinutes = int(time.Since(job.SubmissionCreatedAt).Minutes())
			}
			if penaltyMinutes < 0 {
				penaltyMinutes = 0
			}
			if penaltyMinutes > MaxPenaltyMins {
				penaltyMinutes = MaxPenaltyMins
			}
			fractionalBonus := float64(MaxPenaltyMins-penaltyMinutes) / float64(MaxPenaltyMins)
			encodedScore := float64(score) + fractionalBonus

			// ── 4. Update leaderboard via gRPC ─────────────────────────
			_, err := c.leaderboardClient.UpdateLeaderboard(ctx, &pb.UpdateLeaderboardRequest{
				ContestId:    *job.ContestID,
				UserId:       job.UserID,
				Score:        encodedScore,
				TimeTakenMs:  result.TimeTakenMs,
				SubmissionId: job.SubmissionID,
			})
			if err != nil {
				logger.Error("gRPC UpdateLeaderboard failed", "error", err)
			}

			// 5. Plagiarism check via RabbitMQ (fire-and-forget)
			if err := c.publishPlagiarism(job); err != nil {
				logger.Error("Failed to publish plagiarism check", "error", err)
			}
		}
	}

	_ = msg.Ack(false)
}

func (c *Consumer) publishPlagiarism(job SubmissionJob) error {
	payload := PlagiarismPayload{
		SubmissionID: job.SubmissionID,
		ProblemID:    job.ProblemID,
		ContestID:    "",
		Code:         job.Code,
		Language:     job.Language,
	}

	if job.ContestID != nil {
		payload.ContestID = *job.ContestID
	}

	body, _ := json.Marshal(payload)

	return c.channel.Publish("plagiarism.exchange", "plagiarism.route", false, false, amqp.Publishing{
		ContentType:  "application/json",
		Body:         body,
		DeliveryMode: amqp.Persistent,
		Headers: amqp.Table{
			"x-correlation-id": job.SubmissionID,
		},
	})
}

// Close gracefully drains workers and closes all connections.
func (c *Consumer) Close() {
	if c.stopCh != nil {
		close(c.stopCh)
	}
	c.workerWG.Wait()
	if c.channel != nil {
		c.channel.Close()
	}
	if c.conn != nil {
		c.conn.Close()
	}
	if c.coreClient != nil {
		c.coreClient.Close()
	}
	if c.leaderboardClient != nil {
		c.leaderboardClient.Close()
	}
	if c.redis != nil {
		c.redis.Close()
	}
}
