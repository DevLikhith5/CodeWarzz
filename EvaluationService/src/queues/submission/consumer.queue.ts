import { Worker } from "bullmq";
import { getRedisConnObject } from "../../config/redis.config";
import { runSandbox } from "../../sandbox/runSandbox";
import { pushToLeaderboardQueue } from "../verdict/leaderboard.producer";
import logger from "../../config/logger.config";
import { asyncLocalStorage } from "../../utils/helpers/request.helpers";
import { metricsService } from "../../../../Shared/src/service/metrics.service";

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

          // Fetch problem details from Shared service
          const SHARED_SERVICE_URL = process.env.SHARED_SERVICE_URL || "http://localhost:3001";
          const problemResponse = await fetch(`${SHARED_SERVICE_URL}/api/v1/problems/${problemId}`);

          if (!problemResponse.ok) {
            throw new Error(`Failed to fetch problem ${problemId}: ${problemResponse.statusText}`);
          }

          const problemDataJson = await problemResponse.json() as any;
          const problem = problemDataJson.data;

          if (!problem) {
            throw new Error(`Problem data not found for id ${problemId}`);
          }

          let testcases = [];
          if (isRunOnly && customTestcases && customTestcases.length > 0) {
            testcases = customTestcases;
          } else if (isRunOnly) {
            testcases = problem.testcases
              .filter((tc: any) => tc.isSample)
              .map((tc: any) => ({
                input: tc.input,
                output: tc.output
              }));
          } else {
            testcases = problem.testcases.map((tc: any) => ({
              input: tc.input,
              output: tc.output
            }));
          }

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
          let timeTakenInMs = result.timeTakenMs; // Default to execution time
          let contestEndTime: string | number | undefined;

          if (result.verdict === "AC") {
            score = problem.maxScore || 100;

            if (contestId && submissionCreatedAt) {
              // Fetch contest start time to calculate penalty
              const contestResponse = await fetch(`${SHARED_SERVICE_URL}/api/v1/contests/${contestId}`);
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

          const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || 'default_internal_key';
          try {
            const persistResponse = await fetch(`${SHARED_SERVICE_URL}/api/v1/submissions/${submissionId}`, {
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

          if (result.verdict === "AC") {
            const MAX_PENALTY_MINS = 100000;
            const penaltyMinutes = Math.floor(timeTakenInMs / (1000 * 60));
            const finalEncodedScore = score + ((MAX_PENALTY_MINS - penaltyMinutes) / MAX_PENALTY_MINS);

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
              await pushToLeaderboardQueue({
                submissionId,
                contestId,
                userId,
                score: finalEncodedScore,
                contestEndTime,
              });
              logger.info(`[EVALUATION] CONTEST AC: Points: ${score}, Penalty: ${penaltyMinutes} min, RedisScore: ${finalEncodedScore.toFixed(6)}`);
            } else if (!contestId) {
              logger.info(`[EVALUATION] PRACTICE AC: User ${userId} solved problem ${problemId}`);
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
        end({ status: 'error' });
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
