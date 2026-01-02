import { Worker } from "bullmq";
import { getRedisConnObject } from "../../config/redis.config";
import { runSandbox } from "../../sandbox/runSandbox";
import { pushToLeaderboardQueue } from "../verdict/leaderboard.producer";
import logger from "../../config/logger.config";
import { asyncLocalStorage } from "../../../../core/src/utils/helpers/request.helpers";
import { metricsService } from "../../../../core/src/service/metrics.service";

const CORE_SERVICE_URL = process.env.CORE_SERVICE_URL || "http://localhost:3000";
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || 'INTERNAL_KEY';



const fetchProblemData = async (problemId: string) => {
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
    } else {
      logger.info(`[EVALUATION] Submission ${submissionId} persisted successfully.`);
    }
  } catch (err: any) {
    logger.error(`Error calling persistence API for ${submissionId}: ${err.message}`);
  }
};

const calculateTimeTaken = async (contestId: string | undefined, submissionCreatedAt: string | undefined, executionTimeMs: number) => {
  let timeTakenInMs = executionTimeMs;
  let contestEndTime: string | number | undefined;

  if (contestId && submissionCreatedAt) {
    // Fetch contest start time to calculate penalty
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
    const redis = getRedisConnObject();
    const solvedKey = `CodeWarz:Solved:${contestId}:${userId}`;
    // sadd returns 1 if added (first time), 0 if already exists
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
    await pushToLeaderboardQueue({
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


export const startSubmissionConsumer = () => {
  logger.info("Starting submission consumer...");
  const worker = new Worker(
    "submission-queue",
    async (job) => {
      const end = metricsService.getJobProcessingDuration().startTimer({ queue_name: 'submission-queue', job_name: job.data.isRunOnly ? 'run' : 'submission' });
      metricsService.getSubmissionTotal().inc({ language: job.data.language, type: job.data.isRunOnly ? 'run' : 'submission' });

      try {
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
          correlationId
        } = job.data;

        const result = await asyncLocalStorage.run({ correlationId: correlationId || 'unknown-job' }, async () => {

          logger.info(`Received Data for ${isRunOnly ? 'Run' : 'Submission'} ${submissionId || job.id}`, { data: job.data });

          const problem = await fetchProblemData(problemId);
          const testcases = prepareTestcases(isRunOnly, customTestcases, problem);

          const constraints = {
            timeLimitMs: problem.timeLimitMs,
            memoryLimitMb: problem.memoryLimitMb,
            cpuLimit: problem.cpuLimit
          };

          const sandboxEnd = metricsService.getSandboxExecutionDuration().startTimer({ language, status: 'pending' });
          const result = await runSandbox({
            language,
            code,
            testcases,
            constraints,
            runAllTestcases: !!isRunOnly,
          });
          sandboxEnd({ status: 'completed' });

          logger.info(`Result for ${isRunOnly ? 'Run' : 'Submission'} ${submissionId || job.id}`, { result });

          metricsService.getVerdictTotal().inc({ verdict: result.verdict, contest_id: contestId || 'practice' });

          if (isRunOnly) {
            return result;
          }

          // Calculate score and penalty
          let score = 0;
          let timeTakenInMs = result.timeTakenMs;
          let contestEndTime: string | number | undefined;

          if (result.verdict === "AC") {
            score = problem.maxScore || 100;
            const timeCalc = await calculateTimeTaken(contestId, submissionCreatedAt, result.timeTakenMs);
            timeTakenInMs = timeCalc.timeTakenInMs;
            contestEndTime = timeCalc.contestEndTime;
          }

          const evaluationResult = {
            submissionId,
            userId,
            contestId,
            verdict: result.verdict,
            passed: result.passed,
            lastExecutedTestCase: result.lastExecutedTestCase,
            total: result.total,
            timeTakenMs: result.timeTakenMs,
            penaltyTimeMs: timeTakenInMs,
            score,
            actualOutput: result.actualOutput,
            expectedOutput: result.expectedOutput,
            errorMessage: result.error
          };

          await persistSubmission(submissionId, evaluationResult);

          if (result.verdict === "AC") {
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
              verdict: result.verdict
            });

            // We log penalty minutes here because we have the data
            if (contestId) {
              logger.info(`[EVALUATION] Penalty Calculated: ${penaltyMinutes} min`);
            }
          }

          if (submissionCreatedAt) {
            const e2eDuration = (Date.now() - new Date(submissionCreatedAt).getTime()) / 1000;
            metricsService.getSubmissionE2EDuration().observe({ status: result.verdict === "AC" ? 'processed' : 'failed', language }, e2eDuration);
          }

          return evaluationResult;
        });
        end({ status: 'success' });
        return result;
      } catch (err) {
        end({ status: 'failure' });
        throw err;
      }
    },
    {
      connection: getRedisConnObject(),
      concurrency: 5,
    }
  );
  logger.info("Submission consumer started successfully.");

  worker.on("completed", (job, result) => {
    logger.info(`Submission ${job.id} evaluated`, { result });
  });

  worker.on("failed", (job, err) => {
    logger.error(`Submission ${job?.id} failed`, { error: err });
  });

  return worker;
};
