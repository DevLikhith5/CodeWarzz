import { getRedisConnObject } from "../config/redis.config";

const redis = getRedisConnObject();

const MAX_PENALTY_MINS = 100000;
const LEADERBOARD_EXPIRY_EXTENSION_MS = 24 * 60 * 60 * 1000;

export interface UpdateLeaderboardInput {
  contestId: string;
  userId: string;
  score: number;
  timeTakenInMs: number;
  contestEndTime?: string | number;
}

export async function updateLeaderboard({
  contestId,
  userId,
  score,
  timeTakenInMs,
  contestEndTime,
}: UpdateLeaderboardInput) {
  const redisKey = `CodeWarz:Leaderboard:${contestId}`;

  // Time-penalty encoding: earlier submissions get a tiny fractional bonus
  // proportional to the inverse of time-taken. The fractional part is decoded
  // back on read. We clamp to MAX_PENALTY_MINS to avoid negative scores.
  const penaltyMinutes = Math.min(
    MAX_PENALTY_MINS,
    Math.max(0, Math.floor(timeTakenInMs / (1000 * 60)))
  );
  const fractionalBonus = (MAX_PENALTY_MINS - penaltyMinutes) / MAX_PENALTY_MINS;
  const encodedScore = score + fractionalBonus;

  await redis.zadd(redisKey, encodedScore, userId);

  if (contestEndTime) {
    const endTimeMs = new Date(contestEndTime).getTime();
    if (!isNaN(endTimeMs)) {
      const expiryTimeInSeconds = Math.floor((endTimeMs + LEADERBOARD_EXPIRY_EXTENSION_MS) / 1000);
      await redis.expireat(redisKey, expiryTimeInSeconds);
    }
  }

  return {
    contestId,
    userId,
    score,
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

    // Decimal decoding: Points.FractionalPenalty
    const points = Math.floor(rawScore);
    const penaltyMinutes = Math.round((MAX_PENALTY_MINS - (rawScore - points) * MAX_PENALTY_MINS));

    leaderboard.push({
      userId: data[i],
      rawScore,
      score: points,
      penaltyMinutes,
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
  const points = Math.floor(rawScore);
  const penaltyMinutes = Math.round((MAX_PENALTY_MINS - (rawScore - points) * MAX_PENALTY_MINS));

  return {
    userId,
    rank: rank + 1,
    score: points,
    penaltyMinutes,
  };
}
