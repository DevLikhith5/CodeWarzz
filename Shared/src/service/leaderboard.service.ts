import { leaderboardRepository } from "../repository/leaderboard.repository";

const MAX_PENALTY_MINS = 100000;

export const takeLeaderboardSnapshot = async () => {
    const now = new Date();

    // 1. Fetch active contests
    const activeContests = await leaderboardRepository.getActiveContests();

    console.log(`Found ${activeContests.length} active contests for snapshot.`);

    for (const contest of activeContests) {
        // 2. Fetch entire leaderboard from Redis
        const data = await leaderboardRepository.getLeaderboardFromRedis(contest.id);

        if (data.length === 0) continue;

        // 3. Prepare bulk insert data
        const snapshots = [];
        for (let i = 0; i < data.length; i += 2) {
            const userId = data[i];
            const rawScore = Number(data[i + 1]);

            // Decimal decoding: Points.FractionalPenalty
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

        // 4. Insert into database
        if (snapshots.length > 0) {
            try {
                await leaderboardRepository.saveSnapshots(snapshots);
                console.log(`Saved ${snapshots.length} snapshots for contest ${contest.id}`);
            } catch (err) {
                console.error(`Failed to save snapshots for contest ${contest.id}:`, err);
            }
        }
    }
};

export const getArchivedLeaderboard = async (contestId: string) => {
    const snapshots = await leaderboardRepository.getSnapshotsByContestId(contestId);
    return snapshots.map(s => ({
        userId: s.userId,
        username: (s.user as any)?.username,
        score: s.score,
        rank: s.rank,
        penaltyMinutes: s.timeTakenMs,
        capturedAt: s.capturedAt
    }));
};
