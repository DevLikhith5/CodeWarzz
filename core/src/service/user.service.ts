import { userRepository } from "../repository/user.repository";
import { NotFoundError } from "../utils/errors/app.error";

export class UserService {
    async getUserProfile(userId: string) {
        const user = await userRepository.getUserById(userId);
        if (!user) {
            throw new NotFoundError("User not found");
        }

        const stats = await this.getUserStats(userId);

        return {
            user,
            ...stats
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
        const solvedCounts = await userRepository.getSolvedCounts(userId);
        const submissionStats = await userRepository.getSubmissionStats(userId);
        const solvedWithTags = await userRepository.getSolvedWithTags(userId);

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

        // Calculate tag stats
        const tagCounts: Record<string, number> = {};
        let totalTags = 0;

        solvedWithTags.forEach(item => {
            if (item.tags && Array.isArray(item.tags)) {
                item.tags.forEach(tag => {
                    tagCounts[tag] = (tagCounts[tag] || 0) + 1;
                    totalTags++;
                });
            }
        });

        const tagStats = Object.keys(tagCounts).map(tag => ({
            tag,
            count: tagCounts[tag],
            percentage: totalTags > 0
                ? ((tagCounts[tag] / totalTags) * 100).toFixed(2)
                : "0.00"
        })).sort((a, b) => b.count - a.count); // Sort by most solved tags


        return {
            solved: stats,
            submissions: {
                total: totalSubmissions,
                accepted: successfulSubmissions,
                acceptanceRate: totalSubmissions > 0
                    ? ((successfulSubmissions / totalSubmissions) * 100).toFixed(2)
                    : "0.00"
            },
            tags: tagStats
        };
    }

    async getLastAttemptedProblem(userId: string) {
        return await userRepository.getLastAttemptedProblem(userId);
    }

    async getGlobalLeaderboard() {
        return await userRepository.getGlobalLeaderboard();
    }
}


export const userService = new UserService();
