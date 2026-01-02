import db from "../config/db";
import { users, userDailyActivity } from "../db/schema/user";
import { submissions } from "../db/schema/submission";
import { problems } from "../db/schema/problems";
import { eq, and, count, sql, desc } from "drizzle-orm";

import { observeDbQuery } from "../utils/metrics.utils";

export class UserRepository {
    async getUserById(id: string) {
        return await observeDbQuery('getUserById', 'users', async () => {
            return await db.query.users.findFirst({
                where: eq(users.id, id),
                columns: {
                    passwordHash: false,
                    refreshToken: false,
                }
            });
        });
    }

    async getSolvedCounts(userId: string) {
        return await observeDbQuery('getSolvedCounts', 'submissions', async () => {
            const results = await db
                .select({
                    difficulty: problems.difficulty,
                    count: count(sql`DISTINCT ${problems.id}`),
                })
                .from(submissions)
                .innerJoin(problems, eq(submissions.problemId, problems.id))
                .where(
                    and(
                        eq(submissions.userId, userId),
                        eq(submissions.verdict, "AC")
                    )
                )
                .groupBy(problems.difficulty);

            return results;
        });
    }

    async getUserActivity(userId: string) {
        return await observeDbQuery('getUserActivity', 'submissions', async () => {
            const results = await db
                .select({
                    date: sql<string>`DATE(${submissions.createdAt})`,
                    count: count(submissions.id),
                })
                .from(submissions)
                .where(eq(submissions.userId, userId))
                .groupBy(sql`DATE(${submissions.createdAt})`)
                .orderBy(desc(sql`DATE(${submissions.createdAt})`));

            return results;
        });
    }

    async getSubmissionStats(userId: string) {
        return await observeDbQuery('getSubmissionStats', 'submissions', async () => {
            const results = await db
                .select({
                    verdict: submissions.verdict,
                    count: count(submissions.id),
                })
                .from(submissions)
                .where(eq(submissions.userId, userId))
                .groupBy(submissions.verdict);

            return results;
        });
    }

    async getSolvedProblemIds(userId: string) {
        return await observeDbQuery('getSolvedProblemIds', 'submissions', async () => {
            const results = await db
                .select({
                    problemId: sql`DISTINCT ${submissions.problemId}`,
                    difficulty: problems.difficulty
                })
                .from(submissions)
                .innerJoin(problems, eq(submissions.problemId, problems.id))
                .where(
                    and(
                        eq(submissions.userId, userId),
                        eq(submissions.verdict, "AC")
                    )
                );

            return results;
        });
    }

    async getSolvedWithTags(userId: string) {
        return await observeDbQuery('getSolvedWithTags', 'submissions', async () => {
            const results = await db
                .select({
                    tags: problems.tags
                })
                .from(submissions)
                .innerJoin(problems, eq(submissions.problemId, problems.id))
                .where(
                    and(
                        eq(submissions.userId, userId),
                        eq(submissions.verdict, "AC")
                    )
                )
                .groupBy(problems.id); // Group by Primary Key allows selecting other columns

            return results;
        });
    }

    async incrementUserActivity(userId: string) {
        return await observeDbQuery('incrementUserActivity', 'userDailyActivity', async () => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            await db.insert(userDailyActivity).values({
                userId,
                date: today,
                submissions: 1
            })
                .onConflictDoUpdate({
                    target: [userDailyActivity.userId, userDailyActivity.date],
                    set: {
                        submissions: sql`${userDailyActivity.submissions} + 1`,
                        updatedAt: new Date()
                    }
                });
        });
    }

    async incrementSolvedCount(userId: string) {
        return await observeDbQuery('incrementSolvedCount', 'users', async () => {
            await db
                .update(users)
                .set({
                    solvedCount: sql`${users.solvedCount} + 1`
                })
                .where(eq(users.id, userId));
        });
    }

    async getLastAttemptedProblem(userId: string) {
        return await observeDbQuery('getLastAttemptedProblem', 'submissions', async () => {
            return await db.query.submissions.findFirst({
                where: eq(submissions.userId, userId),
                orderBy: [desc(submissions.createdAt)],
                with: {
                    problem: {
                        columns: {
                            id: true,
                            title: true,
                            slug: true,
                            difficulty: true
                        }
                    }
                }
            });
        });
    }
    async getGlobalLeaderboard(limit: number = 50) {
        return await observeDbQuery('getGlobalLeaderboard', 'users', async () => {
            const results = await db
                .select({
                    id: users.id,
                    username: users.username,
                    solvedCount: users.solvedCount,
                    // We can also fetch breakdowns if needed, but solvedCount is primary
                })
                .from(users)
                .orderBy(desc(users.solvedCount))
                .limit(limit);

            // Fetch breakdown stats for each user
            const leaderboardWithStats = await Promise.all(results.map(async (user) => {
                const solvedCounts = await this.getSolvedCounts(user.id);
                // Transform to easy/medium/hard map
                const difficultyMap = { EASY: 0, MEDIUM: 0, HARD: 0 };
                solvedCounts.forEach(s => {
                    if (s.difficulty) {
                        // @ts-ignore
                        difficultyMap[s.difficulty] = s.count;
                    }
                });

                const totalRealSolved = difficultyMap.EASY + difficultyMap.MEDIUM + difficultyMap.HARD;

                return {
                    ...user,
                    solvedCount: totalRealSolved, // Override stale DB count with real calculated count
                    easy: difficultyMap.EASY,
                    medium: difficultyMap.MEDIUM,
                    hard: difficultyMap.HARD
                };
            }));

            // Sort by valid solved count to ensure ranking matches displayed score
            return leaderboardWithStats.sort((a, b) => b.solvedCount - a.solvedCount);
        });
    }
}


export const userRepository = new UserRepository();
