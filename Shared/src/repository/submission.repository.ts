import db from "../config/db";
import { submissions } from "../db/schema/submission";
import { InferInsertModel, eq } from "drizzle-orm";

export type SubmissionInsert = InferInsertModel<typeof submissions>;

export class SubmissionRepository {
    async createSubmission(submissionData: SubmissionInsert) {
        const [submission] = await db.insert(submissions).values(submissionData).returning();
        return submission;
    }

    async getSubmissionById(id: string) {
        const [submission] = await db.select().from(submissions).where(eq(submissions.id, id)).limit(1);
        return submission;
    }
}

export const submissionRepository = new SubmissionRepository();
