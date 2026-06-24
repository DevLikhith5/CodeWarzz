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

    async decrementUserActivity(userId: string) {
        return await observeDbQuery('decrementUserActivity', 'userDailyActivity', async () => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            await db
                .update(userDailyActivity)
                .set({
                    submissions: sql`GREATEST(${userDailyActivity.submissions} - 1, 0)`,
                    updatedAt: new Date()
                })
                .where(and(
                    eq(userDailyActivity.userId, userId),
                    eq(userDailyActivity.date, today)
                ));
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

    /**
     * Transactional variants — accept a Drizzle tx handle so callers can
     * group the user update with other writes (e.g. submission update,
     * event append) for atomicity.
     */
    async incrementUserActivityWithTx(tx: any, userId: string) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        await tx.insert(userDailyActivity).values({
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
    }

    async decrementUserActivityWithTx(tx: any, userId: string) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        await tx
            .update(userDailyActivity)
            .set({
                submissions: sql`GREATEST(${userDailyActivity.submissions} - 1, 0)`,
                updatedAt: new Date()
            })
            .where(and(
                eq(userDailyActivity.userId, userId),
                eq(userDailyActivity.date, today)
            ));
    }

    async incrementSolvedCountWithTx(tx: any, userId: string) {
        await tx
            .update(users)
            .set({
                solvedCount: sql`${users.solvedCount} + 1`
            })
            .where(eq(users.id, userId));
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
            // Compute the entire leaderboard in a single SQL query: per-user
            // (EASY/MEDIUM/HARD) solved counts via FILTER + DISTINCT, then
            // rank by total solved. Avoids the previous N+1 (1 + N queries
            // for limit=50).
            const results = await db.execute<{
                id: string;
                username: string;
                solved_count: number;
                easy: number;
                medium: number;
                hard: number;
            }>(sql`
                SELECT
                    u.id,
                    u.username,
                    COUNT(DISTINCT CASE WHEN p.difficulty = 'EASY' THEN p.id END)::int AS easy,
                    COUNT(DISTINCT CASE WHEN p.difficulty = 'MEDIUM' THEN p.id END)::int AS medium,
                    COUNT(DISTINCT CASE WHEN p.difficulty = 'HARD' THEN p.id END)::int AS hard,
                    COUNT(DISTINCT p.id)::int AS solved_count
                FROM users u
                LEFT JOIN submissions s
                    ON s.user_id = u.id AND s.verdict = 'AC'
                LEFT JOIN problems p
                    ON p.id = s.problem_id
                GROUP BY u.id, u.username
                HAVING COUNT(DISTINCT p.id) > 0
                ORDER BY solved_count DESC
                LIMIT ${limit}
            `);

            const rows = (results.rows || results as any) as Array<{
                id: string;
                username: string;
                solved_count: number;
                easy: number;
                medium: number;
                hard: number;
            }>;

            return rows.map((row) => ({
                id: row.id,
                username: row.username,
                solvedCount: row.solved_count,
                easy: row.easy,
                medium: row.medium,
                hard: row.hard,
            }));
        });
    }
}


export const userRepository = new UserRepository();
