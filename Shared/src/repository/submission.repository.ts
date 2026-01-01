import db from "../config/db";
import { submissions } from "../db/schema/submission";
import { InferInsertModel, eq, desc, asc, and, SQL } from "drizzle-orm";

export type SubmissionInsert = InferInsertModel<typeof submissions>;

import { observeDbQuery } from "../utils/metrics.utils";

export class SubmissionRepository {
    async createSubmission(submissionData: SubmissionInsert) {
        return await observeDbQuery('createSubmission', 'submissions', async () => {
            const [submission] = await db.insert(submissions).values(submissionData).returning();
            return submission;
        });
    }

    async getSubmissionById(id: string) {
        return await observeDbQuery('getSubmissionById', 'submissions', async () => {
            return await db.query.submissions.findFirst({
                where: eq(submissions.id, id),
                with: {
                    problem: {
                        columns: {
                            title: true,
                            slug: true
                        }
                    }
                }
            });
        });
    }

    async getSubmissionByProblemId(userId: string, problemId: string) {
        return await observeDbQuery('getSubmissionByProblemId', 'submissions', async () => {
            return await db.query.submissions.findFirst({
                where: and(eq(submissions.userId, userId), eq(submissions.problemId, problemId)),
                orderBy: [desc(submissions.createdAt)]
            });
        });
    }

    async getBestSubmission(userId: string, problemId: string) {
        return await observeDbQuery('getBestSubmission', 'submissions', async () => {
            return await db.query.submissions.findFirst({
                where: and(
                    eq(submissions.userId, userId),
                    eq(submissions.problemId, problemId),
                    eq(submissions.verdict, 'AC')
                ),
                orderBy: [
                    // Primary sort: Lowest time
                    // Secondary sort: Lowest memory
                    // Tertiary sort: Newest (break ties with latest optimal)
                    asc(submissions.timeTakenMs),
                    asc(submissions.memoryUsedMb),
                    desc(submissions.createdAt)
                ]
            });
        });
    }

    async getSubmissions(filters: { userId?: string, problemId?: string, contestId?: string }, limit: number = 20, offset: number = 0) {
        return await observeDbQuery('getSubmissions', 'submissions', async () => {
            const whereClauses: SQL[] = [];
            if (filters.userId) whereClauses.push(eq(submissions.userId, filters.userId));
            if (filters.problemId) whereClauses.push(eq(submissions.problemId, filters.problemId));
            if (filters.contestId) whereClauses.push(eq(submissions.contestId, filters.contestId));

            return await db.query.submissions.findMany({
                where: and(...whereClauses),
                limit,
                offset,
                orderBy: [desc(submissions.createdAt)],
                with: {
                    problem: {
                        columns: {
                            title: true,
                            slug: true
                        }
                    }
                }
            });
        });
    }

    async updateSubmission(id: string, data: Partial<SubmissionInsert>) {
        return await observeDbQuery('updateSubmission', 'submissions', async () => {
            const [submission] = await db
                .update(submissions)
                .set(data)
                .where(eq(submissions.id, id))
                .returning();
            return submission;
        });
    }
}

export const submissionRepository = new SubmissionRepository();
