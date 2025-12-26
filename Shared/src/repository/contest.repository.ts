
import db from "../config/db";
import { contests, contestProblems, contestRegistrations } from "../db/schema/contest";
import { InferInsertModel, eq, and } from "drizzle-orm";
import { cacheService } from "../service/cache.service";

export type ContestInsert = InferInsertModel<typeof contests>;

export class ContestRepository {
    async createContest(contestData: ContestInsert) {
        const [contest] = await db.insert(contests).values(contestData).returning();
        return contest;
    }

    async getContestById(id: string) {
        return await db.query.contests.findFirst({
            where: eq(contests.id, id)
        });
    }

    async getAllContests() {
        return await db.query.contests.findMany();
    }

    async addProblemToContest(contestId: string, problemId: string) {
        console.log("INSIDE CONTEST REPOSITORY LAYER: ", contestId, problemId)
        await db.insert(contestProblems).values({ contestId, problemId });
        await cacheService.del(`contest:problems:${contestId}`);
        await cacheService.del(`contest:ongoing:problem:${problemId}`);
    }

    async registerUserForContest(contestId: string, userId: string) {
        await db.insert(contestRegistrations).values({ contestId, userId });
        await cacheService.del(`contest:registration:${contestId}:${userId}`);
    }

    async deregisterUserForContest(contestId: string, userId: string) {
        await db.delete(contestRegistrations)
            .where(and(eq(contestRegistrations.contestId, contestId), eq(contestRegistrations.userId, userId)));
        await cacheService.del(`contest:registration:${contestId}:${userId}`);
    }

    async getOngoingContestsForProblem(problemId: string) {
        const cacheKey = `contest:ongoing:problem:${problemId}`;
        const cached = await cacheService.get<any[]>(cacheKey);
        if (cached) return cached;

        // Find contests that:
        // 1. contain the problem
        // 2. are currently ongoing (startTime <= now <= endTime)
        const now = new Date();
        const ongoingContests = await db.query.contests.findMany({
            where: (contests, { and, lte, gte }) => and(
                lte(contests.startTime, now),
                gte(contests.endTime, now)
            ),
            with: {
                problems: {
                    where: eq(contestProblems.problemId, problemId),
                    limit: 1 // Optimization: check if problem exists in this contest
                }
            }
        });

        // Filter out contests that don't have the problem (the 'with' clause fetches related problems, but we need to ensure the contest effectively has it)
        // With Drizzle's 'with' filtering, the 'problems' array will be empty if not found.
        const result = ongoingContests.filter(c => c.problems.length > 0);
        await cacheService.set(cacheKey, result, 60); // Cache for 1 minute
        return result;
    }

    async getContestProblems(contestId: string) {
        const cacheKey = `contest:problems:${contestId}`;
        const cached = await cacheService.get<any[]>(cacheKey);
        if (cached) return cached;

        // Fetch contest problems with problem details
        const results = await db.query.contestProblems.findMany({
            where: eq(contestProblems.contestId, contestId),
            with: {
                problem: true
            }
        });


        const problems = results.map(row => ({
            id: row.problem.id,
            title: row.problem.title,
            difficulty: row.problem.difficulty,
            slug: row.problem.slug
        }));

        await cacheService.set(cacheKey, problems, 300); 
        return problems;
    }

    async isUserRegistered(contestId: string, userId: string) {
        const cacheKey = `contest:registration:${contestId}:${userId}`;
        const cached = await cacheService.get<boolean>(cacheKey);
        if (cached !== null) return cached;

        const registration = await db.query.contestRegistrations.findFirst({
            where: and(eq(contestRegistrations.contestId, contestId), eq(contestRegistrations.userId, userId))
        });
        const isRegistered = !!registration;
        await cacheService.set(cacheKey, isRegistered, 300); // 5 minutes
        return isRegistered;
    }

    async getUserRegisteredContestIds(userId: string) {
        const registrations = await db.query.contestRegistrations.findMany({
            where: eq(contestRegistrations.userId, userId),
            columns: {
                contestId: true
            }
        });
        return new Set(registrations.map(r => r.contestId));
    }

    async getRegistrationCounts() {
        // Since Drizzle query builder aggregate support varies, we can use a raw query or simple findMany for now if volume is low.
        // For scalability, raw SQL 'SELECT contest_id, COUNT(*) FROM contest_registrations GROUP BY contest_id' is best.
        // But to stick to Drizzle's query API efficiently:
        const allRegistrations = await db.query.contestRegistrations.findMany({
            columns: {
                contestId: true
            }
        });

        const counts: Record<string, number> = {};
        for (const reg of allRegistrations) {
            counts[reg.contestId] = (counts[reg.contestId] || 0) + 1;
        }
        return counts;
    }
}

export const contestRepository = new ContestRepository();
