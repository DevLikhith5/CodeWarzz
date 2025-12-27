import db from "../config/db";
import { submissions } from "../db/schema/submission";
import { InferInsertModel, eq, desc, and, SQL } from "drizzle-orm";

export type SubmissionInsert = InferInsertModel<typeof submissions>;

import { metricsService } from "../service/metrics.service";

export class SubmissionRepository {
    async createSubmission(submissionData: SubmissionInsert) {
        const end = metricsService.getDbQueryDuration().startTimer({ operation: 'insert', table: 'submissions' });
        try {
            const [submission] = await db.insert(submissions).values(submissionData).returning();
            end({ status: 'success' });
            return submission;
        } catch (err) {
            end({ status: 'error' });
            throw err;
        }
    }

    async getSubmissionById(id: string) {
        const end = metricsService.getDbQueryDuration().startTimer({ operation: 'select', table: 'submissions' });
        try {
            const result = await db.query.submissions.findFirst({
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
            end({ status: 'success' });
            return result;
        } catch (err) {
            end({ status: 'error' });
            throw err;
        }
    }

    async getSubmissionByProblemId(userId: string, problemId: string) {
        const end = metricsService.getDbQueryDuration().startTimer({ operation: 'select', table: 'submissions' });
        try {
            const result = await db.query.submissions.findFirst({
                where: and(eq(submissions.userId, userId), eq(submissions.problemId, problemId)),
                orderBy: [desc(submissions.createdAt)]
            });
            end({ status: 'success' });
            return result;
        } catch (err) {
            end({ status: 'error' });
            throw err;
        }
    }

    async getSubmissions(filters: { userId?: string, problemId?: string, contestId?: string }, limit: number = 20, offset: number = 0) {
        const end = metricsService.getDbQueryDuration().startTimer({ operation: 'select_many', table: 'submissions' });
        try {
            const whereClauses: SQL[] = [];
            if (filters.userId) whereClauses.push(eq(submissions.userId, filters.userId));
            if (filters.problemId) whereClauses.push(eq(submissions.problemId, filters.problemId));
            if (filters.contestId) whereClauses.push(eq(submissions.contestId, filters.contestId));

            const result = await db.query.submissions.findMany({
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
            end({ status: 'success' });
            return result;
        } catch (err) {
            end({ status: 'error' });
            throw err;
        }
    }

    async updateSubmission(id: string, data: Partial<SubmissionInsert>) {
        const end = metricsService.getDbQueryDuration().startTimer({ operation: 'update', table: 'submissions' });
        try {
            const [submission] = await db
                .update(submissions)
                .set(data)
                .where(eq(submissions.id, id))
                .returning();
            end({ status: 'success' });
            return submission;
        } catch (err) {
            end({ status: 'error' });
            throw err;
        }
    }
}

export const submissionRepository = new SubmissionRepository();
