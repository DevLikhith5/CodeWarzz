import db from "../config/db";
import { contests } from "../db/schema/contest";
import { leaderboardSnapshots } from "../db/schema/leaderboard";
import { redis } from "../config/redis.config";
import { and, lte, gte, eq } from "drizzle-orm";

import { observeDbQuery } from "../utils/metrics.utils";

export class LeaderboardRepository {
    async getActiveContests() {
        return await observeDbQuery('getActiveContests', 'contests', async () => {
            const now = new Date();
            return await db.query.contests.findMany({
                where: and(
                    lte(contests.startTime, now),
                    gte(contests.endTime, now)
                )
            });
        });
    }

    async getLeaderboardFromRedis(contestId: string) {
        const redisKey = `CodeWarz:Leaderboard:${contestId}`;
        return await redis.zrevrange(redisKey, 0, -1, "WITHSCORES");
    }

    async saveSnapshots(snapshots: typeof leaderboardSnapshots.$inferInsert[]) {
        if (snapshots.length === 0) return;
        return await observeDbQuery('saveSnapshots', 'leaderboardSnapshots', async () => {
            return await db.insert(leaderboardSnapshots).values(snapshots);
        });
    }

    async getSnapshotsByContestId(contestId: string) {
        return await observeDbQuery('getSnapshotsByContestId', 'leaderboardSnapshots', async () => {
            return await db.query.leaderboardSnapshots.findMany({
                where: eq(leaderboardSnapshots.contestId, contestId),
                with: {
                    user: {
                        columns: {
                            username: true
                        }
                    }
                },
                orderBy: (snapshots, { asc }) => [asc(snapshots.rank)]
            });
        });
    }
}

export const leaderboardRepository = new LeaderboardRepository();
