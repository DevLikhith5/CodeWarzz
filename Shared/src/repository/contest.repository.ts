
import db from "../config/db";
import { contests, contestProblems, contestRegistrations } from "../db/schema/contest";
import { InferInsertModel, eq, and } from "drizzle-orm";
import { problems } from "../db/schema/problems";

export type ContestInsert = InferInsertModel<typeof contests>;

export class ContestRepository {
    async createContest(contestData: ContestInsert) {
        const [contest] = await db.insert(contests).values(contestData).returning();
        return contest;
    }

    async getContestById(id: string) {
        const [contest] = await db.select().from(contests).where(eq(contests.id, id)).limit(1);
        return contest;
    }

    async getAllContests() {
        return await db.select().from(contests);
    }

    async addProblemToContest(contestId: string, problemId: string) {
        console.log("INSIDE CONTEST REPOSITORY LAYER: ", contestId, problemId)
        await db.insert(contestProblems).values({ contestId, problemId });
    }

    async registerUserForContest(contestId: string, userId: string) {
        await db.insert(contestRegistrations).values({ contestId, userId });
    }

    async getContestProblems(contestId: string) {
        return await db
            .select({
                id: problems.id,
                title: problems.title,
                difficulty: problems.difficulty,
                slug: problems.slug
            })
            .from(contestProblems)
            .innerJoin(problems, eq(contestProblems.problemId, problems.id))
            .where(eq(contestProblems.contestId, contestId));
    }

    async isUserRegistered(contestId: string, userId: string) {
        const [registration] = await db
            .select()
            .from(contestRegistrations)
            .where(and(eq(contestRegistrations.contestId, contestId), eq(contestRegistrations.userId, userId)))
            .limit(1);
        return !!registration;
    }
}

export const contestRepository = new ContestRepository();
