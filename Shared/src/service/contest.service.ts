
import { contestRepository, ContestInsert } from "../repository/contest.repository";

export class ContestService {
    async createContest(data: ContestInsert) {
        // Validation logic can go here (e.g. check start time < end time)
        return await contestRepository.createContest(data);
    }

    async getContest(id: string) {
        return await contestRepository.getContestById(id);
    }

    async getAllContests() {
        return await contestRepository.getAllContests();
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

    async getContestProblems(contestId: string) {
        return await contestRepository.getContestProblems(contestId);
    }
}

export const contestService = new ContestService();
