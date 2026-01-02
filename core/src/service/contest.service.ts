
import { contestRepository, ContestInsert } from "../repository/contest.repository";
import { problemRepository } from "../repository/problem.repository";
import { submissionRepository } from "../repository/submission.repository";
import { generateSlug } from "../utils/slug.utils";

export class ContestService {
    async createContest(data: ContestInsert) {
        if (!data.slug) {
            data.slug = generateSlug(data.title);
        }
        return await contestRepository.createContest(data);
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

        const submissions = await contestRepository.getContestSubmissionsForLeaderboard(contestId);
        const problems = await contestRepository.getContestProblems(contestId);

        // Map problems for easy lookup and ordering
        const problemMap = new Map(problems.map(p => [p.id, p]));


        const userStats = new Map<string, {
            userId: string;
            username: string;
            score: number;
            totalTimeMs: number;
            problemStats: Record<string, { solved: boolean; attempts: number; timeMs: number }>;
        }>();

        for (const submission of submissions) {
            if (!userStats.has(submission.userId)) {
                userStats.set(submission.userId, {
                    userId: submission.userId,
                    username: submission.user.username,
                    score: 0,
                    totalTimeMs: 0,
                    problemStats: {}
                });
            }

            const stats = userStats.get(submission.userId)!;
            const problemId = submission.problemId;

            // Initialize problem stat if not exists
            if (!stats.problemStats[problemId]) {
                stats.problemStats[problemId] = { solved: false, attempts: 0, timeMs: 0 };
            }

            const pStat = stats.problemStats[problemId];

            if (pStat.solved) continue; // Already solved, ignore further submissions

            if (submission.verdict === 'AC') {
                pStat.solved = true;
                pStat.attempts += 1;

                // Calculate time taken from contest start
                const submissionTime = new Date(submission.createdAt).getTime();
                const startTime = new Date(contest.startTime).getTime();
                const timeTaken = Math.max(0, submissionTime - startTime);
                pStat.timeMs = timeTaken;

                // Update total stats
                const problem = problemMap.get(problemId);
                if (problem) {
                    stats.score += (problem as any).maxScore || 100; // Default 100 if maxScore missing
                }
                stats.totalTimeMs += timeTaken;

                // Add penalty for wrong attempts (e.g. AC on 3rd try = 2 wrong attempts)
                // Assuming 10 minutes (600000ms) penalty per wrong attempt
                // pStat.attempts includes the successful one, so wrong attempts = attempts - 1
                stats.totalTimeMs += (pStat.attempts - 1) * 600000;

            } else {
                pStat.attempts += 1;
            }
        }

        const leaderboard = Array.from(userStats.values()).sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score; // Higher score first
            return a.totalTimeMs - b.totalTimeMs; // Lower time first
        });

        // Add rank
        const leaderboardWithRank = leaderboard.map((entry, index) => ({
            rank: index + 1,
            ...entry,
            timeFormatted: (() => {
                const seconds = Math.floor(entry.totalTimeMs / 1000);
                const h = Math.floor(seconds / 3600);
                const m = Math.floor((seconds % 3600) / 60);
                const s = seconds % 60;
                return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
            })()
        }));

        return {
            contestId,
            problems: problems.map(p => ({ id: p.id, title: p.title })),
            leaderboard: leaderboardWithRank
        };
    }
}

export const contestService = new ContestService();
