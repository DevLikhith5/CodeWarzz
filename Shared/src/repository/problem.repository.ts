import db from "../config/db";
import { problems, testcases } from "../db/schema/problems";
import { contestProblems } from "../db/schema/contest";
import { InferInsertModel, eq } from "drizzle-orm";

export type ProblemInsert = InferInsertModel<typeof problems>;
export type TestcaseInsert = InferInsertModel<typeof testcases>;

export class ProblemRepository {
    async createProblemWithTestcases(
        problem: ProblemInsert,
        tcases: Omit<TestcaseInsert, 'problemId' | 'id' | 'createdAt'>[],
        contestId?: string
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

            if (contestId) {
                await tx.insert(contestProblems).values({
                    contestId,
                    problemId: createdProblem.id,
                });
            }

            return createdProblem;
        });
    }

    async getProblemById(id: string) {
        return await db.query.problems.findFirst({
            where: eq(problems.id, id),
            with: {
                testcases: true
            }
        });
    }

    // Method to fetch testcases for evaluation (internal use generally)
    async getTestcasesByProblemId(problemId: string) {
        return await db.query.testcases.findMany({
            where: eq(testcases.problemId, problemId)
        });
    }

    async getAllProblems() {
        return await db.query.problems.findMany({
            columns: {
                id: true,
                title: true,
                slug: true,
                difficulty: true,
                createdAt: true,
            }
        });
    }
}

export const problemRepository = new ProblemRepository();
