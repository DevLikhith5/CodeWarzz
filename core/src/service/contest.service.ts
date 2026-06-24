
import { contestRepository, ContestInsert } from "../repository/contest.repository";
import { problemRepository } from "../repository/problem.repository";
import { submissionRepository } from "../repository/submission.repository";
import { generateSlug } from "../utils/slug.utils";
import { addContestToBloomFilter } from "./bloom.service";
import logger from "../config/logger.config";
import db from "../config/db";
import { sql } from "drizzle-orm";
import { submissions } from "../db/schema/submission";
import { problems } from "../db/schema/problems";
import { users } from "../db/schema/user";

export class ContestService {
    async createContest(data: ContestInsert) {
        if (!data.slug) {
            data.slug = generateSlug(data.title);
        }
        const contest = await contestRepository.createContest(data);
        // Add to bloom filter so the gateway doesn't shed traffic to this new
        // contest as "non-existent". A failure here is logged but does not
        // fail the request (the gateway will fall back to a DB lookup).
        addContestToBloomFilter(contest.id).catch((err: any) =>
            logger.error('Failed to add contest to bloom filter', { contestId: contest.id, error: err.message })
        );
        return contest;
    }

    async getContest(id: string, userId?: string) {
        const contest = await contestRepository.getContestById(id);
        if (!contest) return null;

        const now = new Date();
        let status = "UPCOMING";
        if (now >= contest.startTime && now <= contest.endTime) {
            status = "ONGOING";
        } else if (now > contest.endTime) {
            status = "ENDED";
        }

        let isRegistered = false;
        if (userId) {
            isRegistered = await contestRepository.isUserRegistered(id, userId);
        }

        const registeredUserCount = await contestRepository.getContestRegistrationCount(id);

        return {
            ...contest,
            status,
            isRegistered,
            registeredUserCount
        };
    }

    async getAllContests(userId?: string, query: { status?: string, registered?: string, participated?: string } = {}) {
        const filters = {
            status: query.status,
            userId,
            registered: query.registered === 'true',
            participated: query.participated === 'true'
        };

        const contests = await contestRepository.getAllContests(filters);
        const counts = await contestRepository.getRegistrationCounts();
        const now = new Date();

        let registeredContestIds = new Set<string>();
        if (userId) {
            registeredContestIds = await contestRepository.getUserRegisteredContestIds(userId);
        }

        return contests.map(contest => {
            let status = "UPCOMING";
            if (now >= contest.startTime && now <= contest.endTime) {
                status = "ONGOING";
            } else if (now > contest.endTime) {
                status = "ENDED";
            }

            return {
                ...contest,
                status,
                isRegistered: registeredContestIds.has(contest.id),
                registeredUserCount: counts[contest.id] || 0
            };
        });
    }

    async addProblemToContest(contestId: string, problemId: string) {
        const contest = await contestRepository.getContestById(contestId);
        if (!contest) {
            throw new Error("Contest not found");
        }

        const problem = await problemRepository.getProblemById(problemId);
        if (!problem) {
            throw new Error("Problem not found");
        }

        return await contestRepository.addProblemToContest(contestId, problemId);
    }

    async registerForContest(contestId: string, userId: string) {
        const contest = await contestRepository.getContestById(contestId);
        if (!contest) throw new Error("Contest not found");

        const isRegistered = await contestRepository.isUserRegistered(contestId, userId);
        if (isRegistered) throw new Error("User already registered");

        // Logic to check if registration is open
        const now = new Date();
        if (now > contest.endTime) {
            throw new Error("Contest already ended");
        }

        return await contestRepository.registerUserForContest(contestId, userId);
    }

    async deregisterForContest(contestId: string, userId: string) {
        const contest = await contestRepository.getContestById(contestId);
        if (!contest) throw new Error("Contest not found");

        const isRegistered = await contestRepository.isUserRegistered(contestId, userId);
        if (!isRegistered) throw new Error("User not registered");

        const now = new Date();
        if (now >= contest.startTime) {
            throw new Error("Cannot deregister after contest has started");
        }

        return await contestRepository.deregisterUserForContest(contestId, userId);
    }

    async getContestProblems(contestId: string, userId?: string) {
        const problems = await contestRepository.getContestProblems(contestId);

        if (!userId) return problems;

        const solvedProblemIds = await submissionRepository.getUserSolvedProblemIds(contestId, userId);

        return problems.map(problem => ({
            ...problem,
            userStatus: solvedProblemIds.has(problem.id) ? 'Solved' : 'Unsolved'
        }));
    }

    async getContestLeaderboard(contestId: string) {
        const contest = await contestRepository.getContestById(contestId);
        if (!contest) throw new Error("Contest not found");

        const contestProblems = await contestRepository.getContestProblems(contestId);

        // Compute the leaderboard entirely in SQL with a single query.
        //
        // For each (user, problem) pair, pick the FIRST AC submission (the
        // "solved" event). Count all wrong attempts made before that AC.
        // Score = sum of maxScore for solved problems. Total time =
        // submission time (from contest start) + (wrong attempts × 10min).
        const startTime = new Date(contest.startTime);
        const PENALTY_MS = 10 * 60 * 1000;

        const leaderboardRows = await db.execute<{
            user_id: string;
            username: string;
            score: number;
            total_time_ms: number;
            solved_count: number;
        }>(sql`
            WITH first_ac AS (
                SELECT
                    s.user_id,
                    s.problem_id,
                    MIN(s.created_at) AS ac_time
                FROM ${submissions} s
                WHERE s.contest_id = ${contestId}
                  AND s.verdict = 'AC'
                GROUP BY s.user_id, s.problem_id
            ),
            wrong_attempts AS (
                SELECT
                    s.user_id,
                    s.problem_id,
                    COUNT(*) AS attempts
                FROM ${submissions} s
                LEFT JOIN first_ac fa
                    ON s.user_id = fa.user_id
                    AND s.problem_id = fa.problem_id
                WHERE s.contest_id = ${contestId}
                  AND s.verdict <> 'AC'
                  AND (fa.ac_time IS NULL OR s.created_at < fa.ac_time)
                GROUP BY s.user_id, s.problem_id
            ),
            solved_with_score AS (
                SELECT
                    fa.user_id,
                    fa.problem_id,
                    fa.ac_time,
                    COALESCE(p.max_score, 100) AS max_score,
                    COALESCE(wa.attempts, 0) AS wrong_count,
                    EXTRACT(EPOCH FROM (fa.ac_time - ${startTime}::timestamp)) * 1000 AS time_ms
                FROM first_ac fa
                JOIN ${problems} p ON p.id = fa.problem_id
                LEFT JOIN wrong_attempts wa
                    ON fa.user_id = wa.user_id
                    AND fa.problem_id = wa.problem_id
            )
            SELECT
                u.id AS user_id,
                u.username,
                COALESCE(SUM(sws.max_score), 0)::int AS score,
                (COALESCE(SUM(sws.time_ms), 0)
                 + COALESCE(SUM(sws.wrong_count), 0) * ${PENALTY_MS})::bigint AS total_time_ms,
                COUNT(sws.problem_id)::int AS solved_count
            FROM ${users} u
            LEFT JOIN solved_with_score sws ON sws.user_id = u.id
            GROUP BY u.id, u.username
            ORDER BY score DESC, total_time_ms ASC
        `);

        const leaderboardWithRank = (leaderboardRows.rows || leaderboardRows as any).map((row: any, index: number) => {
            const totalMs = Number(row.total_time_ms) || 0;
            const seconds = Math.floor(totalMs / 1000);
            const h = Math.floor(seconds / 3600);
            const m = Math.floor((seconds % 3600) / 60);
            const s = seconds % 60;
            return {
                rank: index + 1,
                userId: row.user_id,
                username: row.username,
                score: row.score,
                totalTimeMs: totalMs,
                solvedCount: row.solved_count,
                timeFormatted: `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`,
            };
        });

        return {
            contestId,
            problems: contestProblems.map(p => ({ id: p.id, title: p.title })),
            leaderboard: leaderboardWithRank,
        };
    }
}

export const contestService = new ContestService();
