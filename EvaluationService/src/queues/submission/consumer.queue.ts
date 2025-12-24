import { Worker } from "bullmq";
import { getRedisConnObject } from "../../config/redis.config";
import { runSandbox } from "../../sandbox/runSandbox";
import { pushToLeaderboardQueue } from "../verdict/leaderboard.producer";

export type SubmissionJob = {

    submissionId: string;
    userId: string;
    contestId: string;
    language: "cpp" | "python" | "javascript" | "java";
    code: string;
    testcases: {
        input: string;
        output: string;
    }[];
    constraints: {
        timeLimitMs: number;
        memoryLimitMb: number;
        cpuLimit: number;
    };


}

export const startSubmissionConsumer = () => {
  const worker = new Worker(
    "submission-queue",
    async (job) => {
      const {
        submissionId,
        userId,
        contestId,
        language,
        code,
        testcases,
        constraints,
      } = job.data;


      const result = runSandbox({
        language,
        code,
        testcases,
        constraints,
      });


      const evaluationResult = {
        submissionId,
        userId,
        contestId,
        verdict: result.verdict,
        passed: result.passed,
        total: result.total,
        timeTakenMs: result.timeTakenMs,
      };



if (result.verdict === "AC") {
  await pushToLeaderboardQueue({
    submissionId: job.data.submissionId,
    contestId: job.data.contestId,
    userId: job.data.userId,
    score: 100,                 
    timeTakenInMs: result.timeTakenMs,
  });
  console.log("PUSHED TO LEADERBOARD QUEUE")
}

      // Return result (BullMQ stores this as job result)
      // Later we can:
      // - publish to leaderboard queue
      // - save to DB
      // - emit websocket event
      return evaluationResult;
    },
    {
      connection: getRedisConnObject(),
      concurrency: 5, 
    }
  );


  worker.on("completed", (job, result) => {
    console.log(`Submission ${job.id} evaluated`, result);
  });

  worker.on("failed", (job, err) => {
    console.error(`Submission ${job?.id} failed`, err);
  });

  worker.on("drained", () => {
    console.log("Submission queue drained");
  });

  return worker;
};
