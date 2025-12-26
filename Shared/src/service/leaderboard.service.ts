import { leaderboardRepository } from "../repository/leaderboard.repository";

const SCORE_MULTIPLIER = 1_000_000;

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
            const score = Math.floor(rawScore / SCORE_MULTIPLIER);
            const timeTakenMs = Math.abs(rawScore % SCORE_MULTIPLIER);
            const rank = (i / 2) + 1;

            snapshots.push({
                contestId: contest.id,
                userId: userId,
                score: score,
                timeTakenMs: timeTakenMs,
                rank: rank,
                capturedAt: now
            });
        }

        // 4. Insert into database
        if (snapshots.length > 0) {
            await leaderboardRepository.saveSnapshots(snapshots);
            console.log(`Saved ${snapshots.length} snapshots for contest ${contest.id}`);
        }
    }
};
