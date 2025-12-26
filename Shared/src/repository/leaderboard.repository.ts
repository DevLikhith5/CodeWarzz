import db from "../config/db";
import { contests } from "../db/schema/contest";
import { leaderboardSnapshots } from "../db/schema/leaderboard";
import { getRedisConnObject } from "../config/redis.conifg";
import { and, lte, gte } from "drizzle-orm";

const redis = getRedisConnObject();

export const leaderboardRepository = {
    getActiveContests: async () => {
        const now = new Date();
        return await db.select().from(contests).where(
            and(
                lte(contests.startTime, now),
                gte(contests.endTime, now)
            )
        );
    },

    getLeaderboardFromRedis: async (contestId: string) => {
        const redisKey = `CodeWarz:Leaderboard:${contestId}`;
        return await redis.zrevrange(redisKey, 0, -1, "WITHSCORES");
    },

    saveSnapshots: async (snapshots: typeof leaderboardSnapshots.$inferInsert[]) => {
        if (snapshots.length === 0) return;
        return await db.insert(leaderboardSnapshots).values(snapshots);
    }
};
