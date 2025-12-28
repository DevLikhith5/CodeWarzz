
import db from "../config/db";
import { contests, contestProblems, contestRegistrations } from "../db/schema/contest";
import { submissions } from "../db/schema/submission";
import { eq, and, count, gt, lt, gte, lte, inArray } from "drizzle-orm";
import { cacheService } from "../service/cache.service";

export type ContestInsert = typeof contests.$inferInsert;

import { observeDbQuery } from "../utils/metrics.utils";

//Cache-Aside Pattern = Read-through + Invalidate-on-write.
export class ContestRepository {
    async createContest(contestData: ContestInsert) {
        return await observeDbQuery('createContest', 'contests', async () => {
            const [contest] = await db.insert(contests).values(contestData).returning();
            return contest;
        });
    }

    async getContestById(id: string) {
        return await observeDbQuery('getContestById', 'contests', async () => {
            return await db.query.contests.findFirst({
                where: eq(contests.id, id)
            });
        });
    }

    async getAllContests(filters: { status?: string, userId?: string, registered?: boolean, participated?: boolean } = {}) {
        return await observeDbQuery('getAllContests', 'contests', async () => {
            const now = new Date();
            const conditions = [];

            if (filters.status) {
                if (filters.status === 'upcoming') {
                    conditions.push(gt(contests.startTime, now));
                } else if (filters.status === 'ongoing') {
                    conditions.push(and(lte(contests.startTime, now), gte(contests.endTime, now)));
                } else if (filters.status === 'ended') {
                    conditions.push(lt(contests.endTime, now));
                }
            }

            if ((filters.registered || filters.participated) && filters.userId) {
                const allowedIds = new Set<string>();

                // 1. Participated = User has SUBMISSIONS
                if (filters.participated) {
                    const submittedContests = await db.select({ id: submissions.contestId })
                        .from(submissions)
                        .where(eq(submissions.userId, filters.userId));

                    submittedContests.forEach(s => {
                        if (s.id) allowedIds.add(s.id);
                    });
                }

                // 2. Registered = User has REGISTRATIONS
                if (filters.registered) {
                    const registeredContests = await db.select({
                        id: contestRegistrations.contestId
                    })
                        .from(contestRegistrations)
                        .where(eq(contestRegistrations.userId, filters.userId));

                    registeredContests.forEach(r => allowedIds.add(r.id));
                }

                if (allowedIds.size === 0) return [];
                conditions.push(inArray(contests.id, Array.from(allowedIds)));
            }

            return await db.query.contests.findMany({
                where: conditions.length ? and(...conditions) : undefined,
                orderBy: (contests, { desc }) => [desc(contests.startTime)]
            });
        });
    }

    async addProblemToContest(contestId: string, problemId: string) {
        return await observeDbQuery('addProblemToContest', 'contestProblems', async () => {
            console.log("INSIDE CONTEST REPOSITORY LAYER: ", contestId, problemId)
            await db.insert(contestProblems).values({ contestId, problemId });
            await cacheService.del(`contest:problems:${contestId}`);
            await cacheService.del(`contest:ongoing:problem:${problemId}`);
        });
    }

    async registerUserForContest(contestId: string, userId: string) {
        return await observeDbQuery('registerUserForContest', 'contestRegistrations', async () => {
            await db.insert(contestRegistrations).values({ contestId, userId });
            await cacheService.del(`contest:registration:${contestId}:${userId}`);
        });
    }

    async deregisterUserForContest(contestId: string, userId: string) {
        return await observeDbQuery('deregisterUserForContest', 'contestRegistrations', async () => {
            await db.delete(contestRegistrations)
                .where(and(eq(contestRegistrations.contestId, contestId), eq(contestRegistrations.userId, userId)));
            await cacheService.del(`contest:registration:${contestId}:${userId}`);
        });
    }

    async getOngoingContestsForProblem(problemId: string) {
        const cacheKey = `contest:ongoing:problem:${problemId}`;
        const cached = await cacheService.get<any[]>(cacheKey);
        if (cached) return cached;

        return await observeDbQuery('getOngoingContestsForProblem', 'contests', async () => {

            const now = new Date();
            const ongoingContests = await db.query.contests.findMany({
                where: (contests, { and, lte, gte }) => and(
                    lte(contests.startTime, now),
                    gte(contests.endTime, now)
                ),
                with: {
                    problems: {
                        where: eq(contestProblems.problemId, problemId),
                        limit: 1
                    }
                }
            });

            const result = ongoingContests.filter(c => c.problems.length > 0);
            await cacheService.set(cacheKey, result, 60);
            return result;
        });
    }

    async getContestProblems(contestId: string) {
        const cacheKey = `contest:problems:${contestId}`;
        const cached = await cacheService.get<any[]>(cacheKey);
        if (cached) return cached;

        return await observeDbQuery('getContestProblems', 'contestProblems', async () => {
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
        });
    }

    async isUserRegistered(contestId: string, userId: string) {
        const cacheKey = `contest:registration:${contestId}:${userId}`;
        const cached = await cacheService.get<boolean>(cacheKey);
        if (cached !== null) return cached;

        return await observeDbQuery('isUserRegistered', 'contestRegistrations', async () => {
            const registration = await db.query.contestRegistrations.findFirst({
                where: and(eq(contestRegistrations.contestId, contestId), eq(contestRegistrations.userId, userId))
            });
            const isRegistered = !!registration;
            await cacheService.set(cacheKey, isRegistered, 300); // 5 minutes
            return isRegistered;
        });
    }

    async getUserRegisteredContestIds(userId: string) {
        return await observeDbQuery('getUserRegisteredContestIds', 'contestRegistrations', async () => {
            const registrations = await db.query.contestRegistrations.findMany({
                where: eq(contestRegistrations.userId, userId),
                columns: {
                    contestId: true
                }
            });
            return new Set(registrations.map(r => r.contestId));
        });
    }

    async getContestRegistrationCount(contestId: string) {
        return await observeDbQuery('getContestRegistrationCount', 'contestRegistrations', async () => {
            const [result] = await db.select({ count: count() })
                .from(contestRegistrations)
                .where(eq(contestRegistrations.contestId, contestId));
            return result.count;
        });
    }

    async getRegistrationCounts() {
        return await observeDbQuery('getRegistrationCounts', 'contestRegistrations', async () => {
            const results = await db.select({
                contestId: contestRegistrations.contestId,
                count: count()
            })
                .from(contestRegistrations)
                .groupBy(contestRegistrations.contestId);


            const counts: Record<string, number> = {};
            for (const row of results) {
                counts[row.contestId] = row.count;
            }
            return counts;
        });
    }
}

export const contestRepository = new ContestRepository();
