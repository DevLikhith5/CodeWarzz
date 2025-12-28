import db from "../config/db";
import { users } from "../db/schema/user";
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
}

export const userRepository = new UserRepository();
