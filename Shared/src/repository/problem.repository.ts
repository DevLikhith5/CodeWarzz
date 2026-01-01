import db from "../config/db";
import { problems, testcases } from "../db/schema/problems";
import { contestProblems } from "../db/schema/contest";
import { submissions } from "../db/schema/submission";
import { InferInsertModel, eq, sql, getTableColumns, count, desc } from "drizzle-orm";


import { observeDbQuery } from "../utils/metrics.utils";

export type ProblemInsert = InferInsertModel<typeof problems>;
export type TestcaseInsert = InferInsertModel<typeof testcases>;

export class ProblemRepository {
    /**
     * Creates a new problem with testcases.
     * Returns the created problem object (Drizzle inferred type).
     * Structure: { id: string, title: string, ...other_problem_fields }
     */
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

    /**
     * Fetches a problem by ID with stats and testcases.
     * Returns:
     * {
     *   ...problemFields,
     *   stats: { totalSubmissions: number, acceptedSubmissions: number },
     *   testcases: Testcase[]
     * }
     */
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
    // Method to fetch testcases for evaluation (internal use generally)
    /**
     * Fetches only the testcases for a problem.
     * Returns: Testcase[]
     */
    async getTestcasesByProblemId(problemId: string) {
        return await observeDbQuery('getTestcasesByProblemId', 'testcases', async () => {
            return await db.query.testcases.findMany({
                where: eq(testcases.problemId, problemId)
            });
        });
    }

    /**
     * Fetches all problems with submission stats, paginated.
     * Returns: PaginatedProblemsDto
     */
    async getAllProblems(page: number = 1, limit: number = 10) {
        return await observeDbQuery('getAllProblems', 'problems', async () => {
            const offset = (page - 1) * limit;

            const [totalResult] = await db
                .select({ count: count(problems.id) })
                .from(problems);

            const total = totalResult?.count || 0;

            const results = await db
                .select({
                    id: problems.id,
                    title: problems.title,
                    slug: problems.slug,
                    difficulty: problems.difficulty,
                    tags: problems.tags,
                    createdAt: problems.createdAt,
                    stats: {
                        totalSubmissions: count(submissions.id),
                        acceptedSubmissions: sql<number>`count(case when ${submissions.verdict} = 'AC' then 1 end)::int`,
                    }
                })
                .from(problems)
                .leftJoin(submissions, eq(problems.id, submissions.problemId))
                .groupBy(problems.id)
                .limit(limit)
                .offset(offset)
                .orderBy(desc(problems.createdAt));

            return {
                data: results,
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            };
        });
    }
}

export const problemRepository = new ProblemRepository();
