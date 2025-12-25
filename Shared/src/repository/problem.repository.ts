import db from "../config/db";
import { problems, testcases } from "../db/schema/problems";
import { InferInsertModel, eq } from "drizzle-orm";

export type ProblemInsert = InferInsertModel<typeof problems>;
export type TestcaseInsert = InferInsertModel<typeof testcases>;

export class ProblemRepository {
    async createProblemWithTestcases(
        problem: ProblemInsert,
        tcases: Omit<TestcaseInsert, 'problemId' | 'id' | 'createdAt'>[]
    ) {
        return await db.transaction(async (tx) => {
            const [createdProblem] = await tx
                .insert(problems)
                .values(problem)
                .returning();

            if (tcases.length > 0) {
                const testcaseRows = tcases.map((tc) => ({
                    ...tc,
                    problemId: createdProblem.id,
                }));
                await tx.insert(testcases).values(testcaseRows);
            }

            return createdProblem;
        });
    }

    async getProblemById(id: string) {
        const [problem] = await db.select().from(problems).where(eq(problems.id, id)).limit(1);
        return problem;
    }

    // Method to fetch testcases for evaluation (internal use generally)
    async getTestcasesByProblemId(problemId: string) {
        return await db.select().from(testcases).where(eq(testcases.problemId, problemId));
    }
}

export const problemRepository = new ProblemRepository();
