
import db from "../config/db";
import { contests, contestProblems, contestRegistrations } from "../db/schema/contest";
import { InferInsertModel, eq, and } from "drizzle-orm";
import { cacheService } from "../service/cache.service";

export type ContestInsert = InferInsertModel<typeof contests>;

import { metricsService } from "../service/metrics.service";

export class ContestRepository {
    async createContest(contestData: ContestInsert) {
        const end = metricsService.getDbQueryDuration().startTimer({ operation: 'insert', table: 'contests' });
        try {
            const [contest] = await db.insert(contests).values(contestData).returning();
            end({ status: 'success' });
            return contest;
        } catch (err) {
            end({ status: 'error' });
            throw err;
        }
    }

    async getContestById(id: string) {
        const end = metricsService.getDbQueryDuration().startTimer({ operation: 'select', table: 'contests' });
        try {
            const result = await db.query.contests.findFirst({
                where: eq(contests.id, id)
            });
            end({ status: 'success' });
            return result;
        } catch (err) {
            end({ status: 'error' });
            throw err;
        }
    }

    async getAllContests() {
        const end = metricsService.getDbQueryDuration().startTimer({ operation: 'select_many', table: 'contests' });
        try {
            const result = await db.query.contests.findMany();
            end({ status: 'success' });
            return result;
        } catch (err) {
            end({ status: 'error' });
            throw err;
        }
    }

    async addProblemToContest(contestId: string, problemId: string) {
        const end = metricsService.getDbQueryDuration().startTimer({ operation: 'insert', table: 'contestProblems' });
        try {
            console.log("INSIDE CONTEST REPOSITORY LAYER: ", contestId, problemId)
            await db.insert(contestProblems).values({ contestId, problemId });
            await cacheService.del(`contest:problems:${contestId}`);
            await cacheService.del(`contest:ongoing:problem:${problemId}`);
            end({ status: 'success' });
        } catch (err) {
            end({ status: 'error' });
            throw err;
        }
    }

    async registerUserForContest(contestId: string, userId: string) {
        const end = metricsService.getDbQueryDuration().startTimer({ operation: 'insert', table: 'contestRegistrations' });
        try {
            await db.insert(contestRegistrations).values({ contestId, userId });
            await cacheService.del(`contest:registration:${contestId}:${userId}`);
            end({ status: 'success' });
        } catch (err) {
            end({ status: 'error' });
            throw err;
        }
    }

    async deregisterUserForContest(contestId: string, userId: string) {
        const end = metricsService.getDbQueryDuration().startTimer({ operation: 'delete', table: 'contestRegistrations' });
        try {
            await db.delete(contestRegistrations)
                .where(and(eq(contestRegistrations.contestId, contestId), eq(contestRegistrations.userId, userId)));
            await cacheService.del(`contest:registration:${contestId}:${userId}`);
            end({ status: 'success' });
        } catch (err) {
            end({ status: 'error' });
            throw err;
        }
    }

    async getOngoingContestsForProblem(problemId: string) {
        const cacheKey = `contest:ongoing:problem:${problemId}`;
        const cached = await cacheService.get<any[]>(cacheKey);
        if (cached) return cached;

        const end = metricsService.getDbQueryDuration().startTimer({ operation: 'select_many', table: 'contests' });

        try {
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
            end({ status: 'success' });
            return result;
        } catch (err) {
            end({ status: 'error' });
            throw err;
        }
    }

    async getContestProblems(contestId: string) {
        const cacheKey = `contest:problems:${contestId}`;
        const cached = await cacheService.get<any[]>(cacheKey);
        if (cached) return cached;

        const end = metricsService.getDbQueryDuration().startTimer({ operation: 'select_many', table: 'contestProblems' });

        try {
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
            end({ status: 'success' });
            return problems;
        } catch (err) {
            end({ status: 'error' });
            throw err;
        }
    }

    async isUserRegistered(contestId: string, userId: string) {
        const cacheKey = `contest:registration:${contestId}:${userId}`;
        const cached = await cacheService.get<boolean>(cacheKey);
        if (cached !== null) return cached;

        const end = metricsService.getDbQueryDuration().startTimer({ operation: 'select', table: 'contestRegistrations' });

        try {
            const registration = await db.query.contestRegistrations.findFirst({
                where: and(eq(contestRegistrations.contestId, contestId), eq(contestRegistrations.userId, userId))
            });
            const isRegistered = !!registration;
            await cacheService.set(cacheKey, isRegistered, 300); // 5 minutes
            end({ status: 'success' });
            return isRegistered;
        } catch (err) {
            end({ status: 'error' });
            throw err;
        }
    }

    async getUserRegisteredContestIds(userId: string) {
        const end = metricsService.getDbQueryDuration().startTimer({ operation: 'select_many', table: 'contestRegistrations' });
        try {
            const registrations = await db.query.contestRegistrations.findMany({
                where: eq(contestRegistrations.userId, userId),
                columns: {
                    contestId: true
                }
            });
            end({ status: 'success' });
            return new Set(registrations.map(r => r.contestId));
        } catch (err) {
            end({ status: 'error' });
            throw err;
        }
    }

    async getRegistrationCounts() {
        const end = metricsService.getDbQueryDuration().startTimer({ operation: 'select_many', table: 'contestRegistrations' });
        // Since Drizzle query builder aggregate support varies, we can use a raw query or simple findMany for now if volume is low.
        // For scalability, raw SQL 'SELECT contest_id, COUNT(*) FROM contest_registrations GROUP BY contest_id' is best.
        // But to stick to Drizzle's query API efficiently:
        try {
            const allRegistrations = await db.query.contestRegistrations.findMany({
                columns: {
                    contestId: true
                }
            });

            const counts: Record<string, number> = {};
            for (const reg of allRegistrations) {
                counts[reg.contestId] = (counts[reg.contestId] || 0) + 1;
            }
            end({ status: 'success' });
            return counts;
        } catch (err) {
            end({ status: 'error' });
            throw err;
        }
    }
}

export const contestRepository = new ContestRepository();
