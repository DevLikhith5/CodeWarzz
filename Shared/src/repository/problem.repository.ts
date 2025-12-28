import db from "../config/db";
import { problems, testcases } from "../db/schema/problems";
import { contestProblems } from "../db/schema/contest";
import { submissions } from "../db/schema/submission";
import { InferInsertModel, eq, sql, getTableColumns, count } from "drizzle-orm";

export type ProblemInsert = InferInsertModel<typeof problems>;
export type TestcaseInsert = InferInsertModel<typeof testcases>;

import { observeDbQuery } from "../utils/metrics.utils";

export class ProblemRepository {
    async createProblemWithTestcases(
        problem: ProblemInsert,
        tcases: Omit<TestcaseInsert, 'problemId' | 'id' | 'createdAt'>[],
        contestId?: string
    ) {
        return await observeDbQuery('createProblemWithTestcases', 'problems', async () => {
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
        });
    }

    async getProblemById(id: string) {
        return await observeDbQuery('getProblemById', 'problems', async () => {
            const problemData = await db
                .select({
                    ...getTableColumns(problems),
                    stats: {
                        totalSubmissions: count(submissions.id),
                        acceptedSubmissions: sql<number>`count(case when ${submissions.verdict} = 'AC' then 1 end)::int`,
                    }
                })
                .from(problems)
                .leftJoin(submissions, eq(problems.id, submissions.problemId))
                .where(eq(problems.id, id))
                .groupBy(problems.id)
                .then(res => res[0]);

            if (!problemData) return null;

            
            const problemTestcases = await db.query.testcases.findMany({
                where: eq(testcases.problemId, id)
            });

            return {
                ...problemData,
                testcases: problemTestcases
            };
        });
    }

    // Method to fetch testcases for evaluation (internal use generally)
    async getTestcasesByProblemId(problemId: string) {
        return await observeDbQuery('getTestcasesByProblemId', 'testcases', async () => {
            return await db.query.testcases.findMany({
                where: eq(testcases.problemId, problemId)
            });
        });
    }

    async getAllProblems() {
        return await observeDbQuery('getAllProblems', 'problems', async () => {
            const results = await db
                .select({
                    id: problems.id,
                    title: problems.title,
                    slug: problems.slug,
                    difficulty: problems.difficulty,
                    createdAt: problems.createdAt,
                    stats: {
                        totalSubmissions: count(submissions.id),
                        acceptedSubmissions: sql<number>`count(case when ${submissions.verdict} = 'AC' then 1 end)::int`,
                    }
                })
                .from(problems)
                .leftJoin(submissions, eq(problems.id, submissions.problemId))
                .groupBy(problems.id);

            return results;
        });
    }
}

export const problemRepository = new ProblemRepository();
