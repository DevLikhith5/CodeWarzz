import { getRedisConnObject } from "../config/redis.config";

const redis = getRedisConnObject();


const SCORE_MULTIPLIER = 1_000_000;

export interface UpdateLeaderboardInput {
  contestId: string;
  userId: string;
  score: number;
  timeTakenInMs: number;
}


export async function updateLeaderboard({
  contestId,
  userId,
  score,
  timeTakenInMs,
}: UpdateLeaderboardInput) {
  const redisKey = `CodeWarz:Leaderboard:${contestId}`;

  const finalScore = score * SCORE_MULTIPLIER - timeTakenInMs;

  await redis.zadd(redisKey, finalScore, userId);

  return {
    contestId,
    userId,
    finalScore,
  };
}


export async function getTopLeaderboard(
  contestId: string,
  limit: number
) {
  const redisKey = `CodeWarz:Leaderboard:${contestId}`;

  const data = await redis.zrevrange(
    redisKey,
    0,
    limit - 1,
    "WITHSCORES"
  );

  const leaderboard = [];

  for (let i = 0; i < data.length; i += 2) {
    const rawScore = Number(data[i + 1]);

    leaderboard.push({
      userId: data[i],
      rawScore,
      score: Math.floor(rawScore / SCORE_MULTIPLIER),
      timeTakenInMs: Math.abs(rawScore % SCORE_MULTIPLIER),
    });
  }

  return leaderboard;
}


export async function getUserRank(
  contestId: string,
  userId: string
) {
  const redisKey = `CodeWarz:Leaderboard:${contestId}`;

  const rank = await redis.zrevrank(redisKey, userId);
  const score = await redis.zscore(redisKey, userId);

  if (rank === null || score === null) {
    return null;
  }

  const rawScore = Number(score);

  return {
    userId,
    rank: rank + 1,
    score: Math.floor(rawScore / SCORE_MULTIPLIER),
    timeTakenInMs: Math.abs(rawScore % SCORE_MULTIPLIER),
  };
}
