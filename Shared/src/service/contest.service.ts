
import { contestRepository, ContestInsert } from "../repository/contest.repository";
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

        const counts = await contestRepository.getRegistrationCounts();
        const registeredUserCount = counts[id] || 0;

        return {
            ...contest,
            status,
            isRegistered,
            registeredUserCount
        };
    }

    async getAllContests(userId?: string) {
        const contests = await contestRepository.getAllContests();
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
        // Validation: check if contest exists, problem exists
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

        // Allowed to deregister only before contest ends (or strictly before it starts? Let's say before end for now)
        const now = new Date();
        if (now > contest.endTime) {
            throw new Error("Cannot deregister after contest has ended");
        }

        return await contestRepository.deregisterUserForContest(contestId, userId);
    }

    async getContestProblems(contestId: string) {
        return await contestRepository.getContestProblems(contestId);
    }
}

export const contestService = new ContestService();
