const { Queue } = require("bullmq");
const IORedis = require("ioredis");
const fs = require("fs");
const path = require("path");


const redis = new IORedis("redis://127.0.0.1:6379", {
  maxRetriesPerRequest: null,
});


const leaderboardQueue = new Queue("leaderboard-queue", {
  connection: redis,
});

const jobsPath = path.join(__dirname, "contest_jobs.json");
const contestJobs = JSON.parse(fs.readFileSync(jobsPath, "utf8"));


async function produce() {
  console.log("Producing contest jobs...\n");

  for (const job of contestJobs.jobs) {
    const createdJob = await leaderboardQueue.add(
      job.name,
      job.data,
      job.options
    );

    console.log(
      `Added job ${createdJob.id} | user=${job.data.userId} | score=${job.data.score}`
    );
  }

  console.log("All jobs pushed to queue");
  process.exit(0);
}

produce().catch((err) => {
  console.error("Producer error", err);
  process.exit(1);
});
