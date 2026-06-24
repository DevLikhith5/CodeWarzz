import { consumeSubmissionQueue, MessageHandler } from '../../../../core/src/queues/rabbitmq';
import { runSandbox } from "../../sandbox/runSandbox";
import { publishVerdict, publishPlagiarism } from '../../../../core/src/queues/rabbitmq';
import logger from "../../config/logger.config";
import { asyncLocalStorage } from "../../../../core/src/utils/helpers/request.helpers";
import { metricsService } from "../../../../core/src/service/metrics.service";
import { redis } from "../../config/redis.config";
import { getCircuitBreaker } from "../../../../core/src/utils/circuitBreaker";
import { isIdempotent, markProcessed } from "../../../../core/src/middlewares/idempotency.middleware";

const CORE_SERVICE_URL = process.env.CORE_SERVICE_URL || "http://localhost:3001";
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;
const FETCH_TIMEOUT_MS = 5000;

if (!INTERNAL_API_KEY || INTERNAL_API_KEY.length < 16) {
    throw new Error('CRITICAL: INTERNAL_API_KEY must be set (16+ chars) for evaluation-service');
}

const coreServiceBreaker = getCircuitBreaker('core-service-api', {
    failureThreshold: 3,
    recoveryTimeoutMs: 15000,
    halfOpenMaxAttempts: 2,
});

const fetchProblemData = async (problemId: string) => {
    return coreServiceBreaker.execute(async () => {
        const problemResponse = await fetch(`${CORE_SERVICE_URL}/api/v1/problems/${problemId}`, {
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        });
        if (!problemResponse.ok) {
            throw new Error(`Failed to fetch problem ${problemId}: ${problemResponse.statusText}`);
        }
        const problemDataJson = await problemResponse.json() as any;
        const problem = problemDataJson.data;

        if (!problem) {
            throw new Error(`Problem data not found for id ${problemId}`);
        }
        return problem;
    });
};

const prepareTestcases = (isRunOnly: boolean, customTestcases: any[], problem: any) => {
  if (isRunOnly && customTestcases && customTestcases.length > 0) {
    return customTestcases;
  } else if (isRunOnly) {
    return problem.testcases
      .filter((tc: any) => tc.isSample)
      .map((tc: any) => ({
        input: tc.input,
        output: tc.output
      }));
  } else {
    return problem.testcases.map((tc: any) => ({
      input: tc.input,
      output: tc.output
    }));
  }
};

// Returns true on success, false on failure. The caller should nack on false
// to allow the queue to retry / route to DLQ.
const persistSubmission = async (submissionId: string, evaluationResult: any): Promise<boolean> => {
  try {
    await coreServiceBreaker.execute(async () => {
        const persistResponse = await fetch(`${CORE_SERVICE_URL}/api/v1/submissions/${submissionId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'x-internal-api-key': INTERNAL_API_KEY!
            },
            body: JSON.stringify({
                verdict: evaluationResult.verdict,
                score: evaluationResult.score,
                timeTakenMs: evaluationResult.timeTakenMs,
                passedTestcases: evaluationResult.passed,
                totalTestcases: evaluationResult.total,
                failedInput: evaluationResult.lastExecutedTestCase?.input,
                failedExpected: evaluationResult.expectedOutput,
                failedOutput: evaluationResult.actualOutput,
                errorMessage: evaluationResult.errorMessage
            }),
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        });

        if (!persistResponse.ok) {
            const errorBody = await persistResponse.text();
            logger.error(`Failed to persist submission ${submissionId}: ${persistResponse.statusText}`, { error: errorBody });
            throw new Error(`Persist failed: ${persistResponse.statusText}`);
        }

        logger.info(`[EVALUATION] Submission ${submissionId} persisted successfully.`);
    });
    return true;
  } catch (err: any) {
    if (err.message.includes('Circuit breaker')) {
        logger.error(`Circuit breaker OPEN for core service, persisting submission skipped`, { submissionId });
    } else {
        logger.error(`Error calling persistence API for ${submissionId}: ${err.message}`);
    }
    return false;
  }
};

const calculateTimeTaken = async (contestId: string | undefined, submissionCreatedAt: string | undefined, executionTimeMs: number) => {
  let timeTakenInMs = executionTimeMs;
  let contestEndTime: string | number | undefined;

  if (contestId && submissionCreatedAt) {
    try {
      const contestResponse = await fetch(`${CORE_SERVICE_URL}/api/v1/contests/${contestId}`, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (contestResponse.ok) {
        const contestDataJson = await contestResponse.json() as any;
        const contest = contestDataJson.data;
        if (contest) {
          const contestStartTime = new Date(contest.startTime).getTime();
          const submissionTime = new Date(submissionCreatedAt).getTime();
          if (!isNaN(contestStartTime) && !isNaN(submissionTime)) {
            timeTakenInMs = Math.max(0, submissionTime - contestStartTime);
          }
          contestEndTime = contest.endTime;
          logger.info(`Contest submission penalty calculated: ${timeTakenInMs}ms, EndTime: ${contestEndTime}`);
        }
      } else {
        logger.warn(`Failed to fetch contest ${contestId}: ${contestResponse.statusText}`);
      }
    } catch (err: any) {
      logger.error(`Error fetching contest data for ${contestId}: ${err.message}`);
    }
  }
  return { timeTakenInMs, contestEndTime };
};

const handleLeaderboardUpdate = async (params: {
  contestId: string,
  userId: string,
  problemId: string,
  submissionId: string,
  score: number,
  contestEndTime?: string | number,
  verdict: string,
  timeTakenInMs?: number,
}) => {
  const { contestId, userId, problemId, submissionId, score, contestEndTime, verdict } = params;

  if (verdict !== "AC") return;

  let shouldUpdateLeaderboard = !!contestId;

  if (contestId) {
    try {
      const solvedKey = `CodeWarz:Solved:${contestId}:${userId}`;
      const isFirstSolve = await redis.sadd(solvedKey, problemId);

      if (isFirstSolve === 0) {
        shouldUpdateLeaderboard = false;
        logger.info(`[EVALUATION] Problem ${problemId} already solved by ${userId}. Skipping leaderboard update.`);
      } else if (contestEndTime) {
        const LEADERBOARD_EXPIRY_EXTENSION_MS = 24 * 60 * 60 * 1000;
        const endTimeMs = new Date(contestEndTime).getTime();
        if (!isNaN(endTimeMs)) {
          const expiryTimeInSeconds = Math.floor((endTimeMs + LEADERBOARD_EXPIRY_EXTENSION_MS) / 1000);
          await redis.expireat(solvedKey, expiryTimeInSeconds);
        }
      }
    } catch (err: any) {
      logger.error(`Error in duplicate-solve check: ${err.message}`);
      // Fall through; still attempt the leaderboard update
    }
  }

  if (shouldUpdateLeaderboard) {
    if (!contestId) {
      throw new Error("Contest ID is required for leaderboard update");
    }
    await publishVerdict({
      submissionId,
      contestId,
      userId,
      score,
      contestEndTime,
      timeTakenInMs: params.timeTakenInMs,
    });

    logger.info(`[EVALUATION] CONTEST AC: RedisScore: ${score.toFixed(6)}`);
  } else if (!contestId) {
    logger.info(`[EVALUATION] PRACTICE AC: User ${userId} solved problem ${problemId}`);
  }
};

const storeRunResult = async (jobId: string, result: any) => {
  try {
    await redis.setex(`run-result:${jobId}`, 300, JSON.stringify({
      status: 'completed',
      data: result,
    }));
  } catch (err: any) {
    logger.error(`Failed to store run result for ${jobId}: ${err.message}`);
  }
};

export const startSubmissionConsumer = async () => {
  logger.info("Starting RabbitMQ submission consumer...");

  const handler: MessageHandler = async (data: any, correlationId: string) => {
    const end = metricsService.getJobProcessingDuration().startTimer({ queue_name: 'submission-queue', job_name: data.isRunOnly ? 'run' : 'submission' });
    metricsService.getSubmissionTotal().inc({ language: data.language, type: data.isRunOnly ? 'run' : 'submission' });

    const idempotencyKey = `eval:${data.submissionId || data.jobId}`;
    const alreadyProcessed = await isIdempotent(idempotencyKey);
    if (alreadyProcessed) {
      logger.info(`Idempotent hit, skipping: ${idempotencyKey}`);
      end({ status: 'success' });
      return;
    }

    const {
      submissionId,
      userId,
      contestId,
      problemId,
      language,
      code,
      submissionCreatedAt,
      isRunOnly,
      testcases: customTestcases,
      jobId,
    } = data;

    let result: any;
    try {
      result = await asyncLocalStorage.run({ correlationId: correlationId || 'unknown-job' }, async () => {
        logger.info(`Received Data for ${isRunOnly ? 'Run' : 'Submission'} ${submissionId || jobId}`, { data });

        const problem = await fetchProblemData(problemId);
        const testcases = prepareTestcases(isRunOnly, customTestcases, problem);

        const constraints = {
          timeLimitMs: problem.timeLimitMs,
          memoryLimitMb: problem.memoryLimitMb,
          cpuLimit: problem.cpuLimit
        };

        const sandboxEnd = metricsService.getSandboxExecutionDuration().startTimer({ language, status: 'pending' });
        const sandboxResult = await runSandbox({
          language,
          code,
          testcases,
          constraints,
          runAllTestcases: !!isRunOnly,
        });
        sandboxEnd({ status: 'completed' });

        logger.info(`Result for ${isRunOnly ? 'Run' : 'Submission'} ${submissionId || jobId}`, { result: sandboxResult });

        metricsService.getVerdictTotal().inc({ verdict: sandboxResult.verdict, contest_id: contestId || 'practice' });

        if (isRunOnly) {
          if (jobId) {
            await storeRunResult(jobId, sandboxResult);
          }
          return sandboxResult;
        }

        let score = 0;
        let timeTakenInMs = sandboxResult.timeTakenMs;
        let contestEndTime: string | number | undefined;

        if (sandboxResult.verdict === "AC") {
          score = problem.maxScore || 100;
          const timeCalc = await calculateTimeTaken(contestId, submissionCreatedAt, sandboxResult.timeTakenMs);
          timeTakenInMs = timeCalc.timeTakenInMs;
          contestEndTime = timeCalc.contestEndTime;
        }

        const evaluationResult = {
          submissionId,
          userId,
          contestId,
          verdict: sandboxResult.verdict,
          passed: sandboxResult.passed,
          lastExecutedTestCase: sandboxResult.lastExecutedTestCase,
          total: sandboxResult.total,
          timeTakenMs: sandboxResult.timeTakenMs,
          penaltyTimeMs: timeTakenInMs,
          score,
          actualOutput: sandboxResult.actualOutput,
          expectedOutput: sandboxResult.expectedOutput,
          errorMessage: sandboxResult.error
        };

        const persisted = await persistSubmission(submissionId, evaluationResult);
        if (!persisted) {
          // Throw so the queue consumer retries / sends to DLQ
          throw new Error(`Failed to persist submission ${submissionId}`);
        }

        if (sandboxResult.verdict === "AC") {
          const MAX_PENALTY_MINS = 100000;
          const penaltyMinutes = Math.floor(timeTakenInMs / (1000 * 60));
          const finalEncodedScore = score + ((MAX_PENALTY_MINS - penaltyMinutes) / MAX_PENALTY_MINS);

          await handleLeaderboardUpdate({
            contestId,
            userId,
            problemId,
            submissionId,
            score: finalEncodedScore,
            contestEndTime,
            verdict: sandboxResult.verdict,
            timeTakenInMs,
          });

          await publishPlagiarism({
            submissionId,
            problemId,
            contestId,
            code,
            language,
          });

          if (contestId) {
            logger.info(`[EVALUATION] Penalty Calculated: ${penaltyMinutes} min`);
          }
        }

        if (submissionCreatedAt) {
          const e2eDuration = (Date.now() - new Date(submissionCreatedAt).getTime()) / 1000;
          metricsService.getSubmissionE2EDuration().observe({ status: sandboxResult.verdict === "AC" ? 'processed' : 'failed', language }, e2eDuration);
        }

        return evaluationResult;
      });

      await markProcessed(idempotencyKey, { verdict: result.verdict }, 3600);
      end({ status: 'success' });
      return result;
    } catch (err: any) {
      end({ status: 'error' });
      logger.error(`Submission handler failed: ${err.message}`, { submissionId, jobId, correlationId });
      throw err; // Let queue consumer handle retry / DLQ
    }
  };

  try {
    await consumeSubmissionQueue(handler, {
      prefetch: 10,
      maxRetries: 3,
      retryDelayMs: 1000,
    });
    logger.info("RabbitMQ submission consumer started successfully.");
  } catch (err: any) {
    logger.error("Failed to start submission consumer", { error: err.message });
    throw err;
  }
};
