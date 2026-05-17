import { consumeSubmissionQueue, MessageHandler } from '../../../../core/src/queues/rabbitmq';
import { runSandbox } from "../../sandbox/runSandbox";
import { publishVerdict, publishPlagiarism } from '../../../../core/src/queues/rabbitmq';
import logger from "../../config/logger.config";
import { asyncLocalStorage } from "../../../../core/src/utils/helpers/request.helpers";
import { metricsService } from "../../../../core/src/service/metrics.service";
import { redis } from "../../config/redis.config";
import { getCircuitBreaker } from "../../../../core/src/utils/circuitBreaker";
import { isIdempotent, markProcessed } from "../../../../core/src/middlewares/idempotency.middleware";

const CORE_SERVICE_URL = process.env.CORE_SERVICE_URL || "http://localhost:3000";
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || 'INTERNAL_KEY';

const coreServiceBreaker = getCircuitBreaker('core-service-api', {
    failureThreshold: 3,
    recoveryTimeoutMs: 15000,
    halfOpenMaxAttempts: 2,
});

const fetchProblemData = async (problemId: string) => {
    return coreServiceBreaker.execute(async () => {
        const problemResponse = await fetch(`${CORE_SERVICE_URL}/api/v1/problems/${problemId}`);
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

const persistSubmission = async (submissionId: string, evaluationResult: any) => {
  try {
    await coreServiceBreaker.execute(async () => {
        const persistResponse = await fetch(`${CORE_SERVICE_URL}/api/v1/submissions/${submissionId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'x-internal-api-key': INTERNAL_API_KEY
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
            })
        });

        if (!persistResponse.ok) {
            const errorBody = await persistResponse.text();
            logger.error(`Failed to persist submission ${submissionId}: ${persistResponse.statusText}`, { error: errorBody });
            throw new Error(`Persist failed: ${persistResponse.statusText}`);
        }

        logger.info(`[EVALUATION] Submission ${submissionId} persisted successfully.`);
    });
  } catch (err: any) {
    if (err.message.includes('Circuit breaker')) {
        logger.error(`Circuit breaker OPEN for core service, persisting submission skipped`, { submissionId });
    } else {
        logger.error(`Error calling persistence API for ${submissionId}: ${err.message}`);
    }
  }
};

const calculateTimeTaken = async (contestId: string | undefined, submissionCreatedAt: string | undefined, executionTimeMs: number) => {
  let timeTakenInMs = executionTimeMs;
  let contestEndTime: string | number | undefined;

  if (contestId && submissionCreatedAt) {
    const contestResponse = await fetch(`${CORE_SERVICE_URL}/api/v1/contests/${contestId}`);
    if (contestResponse.ok) {
      const contestDataJson = await contestResponse.json() as any;
      const contest = contestDataJson.data;
      if (contest) {
        const contestStartTime = new Date(contest.startTime).getTime();
        const submissionTime = new Date(submissionCreatedAt).getTime();
        timeTakenInMs = Math.max(0, submissionTime - contestStartTime);
        contestEndTime = contest.endTime;
        logger.info(`Contest submission penalty calculated: ${timeTakenInMs}ms, EndTime: ${contestEndTime}`);
      }
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
  verdict: string
}) => {
  const { contestId, userId, problemId, submissionId, score, contestEndTime, verdict } = params;

  if (verdict !== "AC") return;

  let shouldUpdateLeaderboard = !!contestId;

  if (contestId) {
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

export const startSubmissionConsumer = () => {
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

    const result = await asyncLocalStorage.run({ correlationId: correlationId || 'unknown-job' }, async () => {
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

      await persistSubmission(submissionId, evaluationResult);

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
          verdict: sandboxResult.verdict
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
  };

  consumeSubmissionQueue(handler, {
    prefetch: 10,
    maxRetries: 3,
    retryDelayMs: 1000,
  });

  logger.info("RabbitMQ submission consumer started successfully.");
};
