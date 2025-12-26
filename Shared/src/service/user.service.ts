import { userRepository } from "../repository/user.repository";
import { NotFoundError } from "../utils/errors/app.error";

export class UserService {
    async getUserProfile(userId: string) {
        const user = await userRepository.getUserById(userId);
        if (!user) {
            throw new NotFoundError("User not found");
        }

        const solvedCounts = await userRepository.getSolvedCounts(userId);
        const submissionStats = await userRepository.getSubmissionStats(userId);

        // Format solved counts
        const stats = {
            EASY: 0,
            MEDIUM: 0,
            HARD: 0,
            TOTAL: 0
        };

        solvedCounts.forEach(item => {
            if (item.difficulty in stats) {
                stats[item.difficulty as keyof typeof stats] = Number(item.count);
                stats.TOTAL += Number(item.count);
            }
        });

        // Format submission stats
        let totalSubmissions = 0;
        let successfulSubmissions = 0;
        submissionStats.forEach(item => {
            totalSubmissions += Number(item.count);
            if (item.verdict === "AC") {
                successfulSubmissions += Number(item.count);
            }
        });

        return {
            user,
            solved: stats,
            submissions: {
                total: totalSubmissions,
                accepted: successfulSubmissions,
                acceptanceRate: totalSubmissions > 0
                    ? ((successfulSubmissions / totalSubmissions) * 100).toFixed(2)
                    : "0.00"
            }
        };
    }

    async getUserActivity(userId: string) {
        const activity = await userRepository.getUserActivity(userId);
        return activity.map(item => ({
            date: item.date,
            count: Number(item.count)
        }));
    }

    async getUserStats(userId: string) {
        // Detailed stats if needed separately
        return this.getUserProfile(userId);
    }
}

export const userService = new UserService();
