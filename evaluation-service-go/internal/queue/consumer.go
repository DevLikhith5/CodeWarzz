package queue

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	amqp "github.com/streadway/amqp"

	"evaluation-service-go/internal/sandbox"
	"evaluation-service-go/pkg/logger"
)

type SubmissionJob struct {
	SubmissionID        string    `json:"submissionId"`
	UserID              string    `json:"userId"`
	ContestID           *string   `json:"contestId"`
	ProblemID           string    `json:"problemId"`
	Language            string    `json:"language"`
	Code                string    `json:"code"`
	SubmissionCreatedAt time.Time `json:"submissionCreatedAt"`
	IsRunOnly           bool      `json:"isRunOnly"`
	Testcases           []sandbox.Testcase `json:"testcases"`
	JobID               string    `json:"jobId"`
}

type ProblemData struct {
	TimeLimitMs   int                `json:"timeLimitMs"`
	MemoryLimitMb int                `json:"memoryLimitMb"`
	CPULimit      float64            `json:"cpuLimit"`
	MaxScore      int                `json:"maxScore"`
	Testcases     []sandbox.Testcase `json:"testcases"`
}

type VerdictPayload struct {
	SubmissionID   string  `json:"submissionId"`
	ContestID      string  `json:"contestId"`
	UserID         string  `json:"userId"`
	Score          float64 `json:"score"`
	ContestEndTime *string `json:"contestEndTime"`
}

type PlagiarismPayload struct {
	SubmissionID string `json:"submissionId"`
	ProblemID    string `json:"problemId"`
	ContestID    string `json:"contestId"`
	Code         string `json:"code"`
	Language     string `json:"language"`
}

type Consumer struct {
	conn             *amqp.Connection
	channel          *amqp.Channel
	coreServiceURL   string
	internalAPIKey   string
	hostWorkspacesRoot string
}

func NewConsumer(rabbitMQURL, coreServiceURL, internalAPIKey, hostWorkspacesRoot string) (*Consumer, error) {
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
		return nil, fmt.Errorf("failed to set QoS: %w", err)
	}

	return &Consumer{
		conn:               conn,
		channel:            ch,
		coreServiceURL:     coreServiceURL,
		internalAPIKey:     internalAPIKey,
		hostWorkspacesRoot: hostWorkspacesRoot,
	}, nil
}

func (c *Consumer) StartSubmissionConsumer() error {
	msgs, err := c.channel.Consume("submission.queue", "", false, false, false, false, nil)
	if err != nil {
		return fmt.Errorf("failed to register consumer: %w", err)
	}

	logger.Info("RabbitMQ submission consumer started (Go)")

	go func() {
		for msg := range msgs {
			c.handleSubmission(msg)
		}
	}()

	return nil
}

func (c *Consumer) handleSubmission(msg amqp.Delivery) {
	var job SubmissionJob
	if err := json.Unmarshal(msg.Body, &job); err != nil {
		logger.Error("Failed to parse submission job", "error", err)
		msg.Ack(false)
		return
	}

	logger.Info("Processing submission", "submissionId", job.SubmissionID, "problemId", job.ProblemID)

	problem, err := c.fetchProblem(job.ProblemID)
	if err != nil {
		logger.Error("Failed to fetch problem", "error", err, "problemId", job.ProblemID)
		msg.Ack(false)
		return
	}

	testcases := problem.Testcases
	if job.IsRunOnly && len(job.Testcases) > 0 {
		testcases = job.Testcases
	} else if job.IsRunOnly {
		for _, tc := range problem.Testcases {
			// Filter sample testcases if needed
		}
	}

	result := sandbox.Run(sandbox.SandboxInput{
		Code:      job.Code,
		Language:  job.Language,
		Testcases: testcases,
		Constraints: sandbox.Constraints{
			TimeLimitMs:   problem.TimeLimitMs,
			MemoryLimitMb: problem.MemoryLimitMb,
			CPULimit:      problem.CPULimit,
		},
		RunAll: job.IsRunOnly,
	}, c.hostWorkspacesRoot)

	logger.Info("Sandbox execution complete", "submissionId", job.SubmissionID, "verdict", result.Verdict)

	if !job.IsRunOnly {
		if err := c.persistSubmission(job.SubmissionID, result, problem); err != nil {
			logger.Error("Failed to persist submission", "error", err)
		}

		if result.Verdict == "AC" {
			score := float64(problem.MaxScore)
			if score == 0 {
				score = 100
			}

			if err := c.publishVerdict(job, score); err != nil {
				logger.Error("Failed to publish verdict", "error", err)
			}

			if err := c.publishPlagiarism(job); err != nil {
				logger.Error("Failed to publish plagiarism check", "error", err)
			}
		}
	}

	msg.Ack(false)
}

func (c *Consumer) fetchProblem(problemID string) (*ProblemData, error) {
	resp, err := http.Get(fmt.Sprintf("%s/api/v1/problems/%s", c.coreServiceURL, problemID))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("problem fetch failed: %d", resp.StatusCode)
	}

	var result struct {
		Data ProblemData `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	return &result.Data, nil
}

func (c *Consumer) persistSubmission(submissionID string, result sandbox.SandboxResult, problem *ProblemData) error {
	payload := map[string]interface{}{
		"verdict":          result.Verdict,
		"score":            0,
		"timeTakenMs":      result.TimeTakenMs,
		"passedTestcases":  result.Passed,
		"totalTestcases":   result.Total,
		"failedInput":      "",
		"failedExpected":   result.ExpectedOutput,
		"failedOutput":     result.ActualOutput,
		"errorMessage":     result.ErrorMessage,
	}

	if result.Verdict == "AC" {
		payload["score"] = problem.MaxScore
	}

	body, _ := json.Marshal(payload)
	req, _ := http.NewRequest("PATCH", fmt.Sprintf("%s/api/v1/submissions/%s", c.coreServiceURL, submissionID), body)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-internal-api-key", c.internalAPIKey)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("persist failed: %d", resp.StatusCode)
	}

	logger.Info("Submission persisted", "submissionId", submissionID)
	return nil
}

func (c *Consumer) publishVerdict(job SubmissionJob, score float64) error {
	if job.ContestID == nil {
		return nil
	}

	payload := VerdictPayload{
		SubmissionID: job.SubmissionID,
		ContestID:    *job.ContestID,
		UserID:       job.UserID,
		Score:        score,
	}

	body, _ := json.Marshal(payload)

	return c.channel.Publish("verdict.exchange", "verdict.route", false, false, amqp.Publishing{
		ContentType:  "application/json",
		Body:         body,
		DeliveryMode: amqp.Persistent,
		Headers: amqp.Table{
			"x-correlation-id": job.SubmissionID,
		},
	})
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

func (c *Consumer) Close() {
	if c.channel != nil {
		c.channel.Close()
	}
	if c.conn != nil {
		c.conn.Close()
	}
}
