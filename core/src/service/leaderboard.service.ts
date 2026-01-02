import { leaderboardRepository } from "../repository/leaderboard.repository";

const MAX_PENALTY_MINS = 100000;

export class LeaderboardService {
    async takeLeaderboardSnapshot() {
        const now = new Date();
        const activeContests = await leaderboardRepository.getActiveContests();

        for (const contest of activeContests) {
            const data = await leaderboardRepository.getLeaderboardFromRedis(contest.id);

            if (data.length === 0) continue;

            const snapshots = [];
            for (let i = 0; i < data.length; i += 2) {
                const userId = data[i];
                const rawScore = Number(data[i + 1]);
                const points = Math.floor(rawScore);
                const penaltyMinutes = Math.round((MAX_PENALTY_MINS - (rawScore - points) * MAX_PENALTY_MINS));
                const rank = (i / 2) + 1;

                snapshots.push({
                    contestId: contest.id,
                    userId: userId,
                    score: points,
                    timeTakenMs: penaltyMinutes,
                    rank: rank,
                    capturedAt: now
                });
            }

            if (snapshots.length > 0) {
                try {
                    await leaderboardRepository.saveSnapshots(snapshots);
                } catch (err) {
                    console.error(`Failed to save snapshots for contest ${contest.id}:`, err);
                }
            }
        }
    }

    async getArchivedLeaderboard(contestId: string) {
        const snapshots = await leaderboardRepository.getSnapshotsByContestId(contestId);
        return snapshots.map(s => ({
            userId: s.userId,
            username: (s.user as any)?.username,
            score: s.score,
            rank: s.rank,
            penaltyMinutes: s.timeTakenMs,
            capturedAt: s.capturedAt
        }));
    }
}

export const leaderboardService = new LeaderboardService();
