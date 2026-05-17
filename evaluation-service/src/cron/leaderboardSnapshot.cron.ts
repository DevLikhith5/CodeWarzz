import logger from "../config/logger.config";

export const setupSnapshotCron = async () => {
    const intervalMs = 120000; // 2 minutes
    const coreUrl = process.env.CORE_SERVICE_URL || 'http://localhost:3001';

    const triggerSnapshot = async () => {
        try {
            logger.info("Triggering Leaderboard Snapshot via API...");
            const response = await fetch(`${coreUrl}/api/v1/leaderboard/snapshot`, {
                method: 'POST',
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`API returned ${response.status}: ${errText}`);
            }

            logger.info("Snapshot API call successful.");
        } catch (error: any) {
            logger.error(`Failed to trigger snapshot: ${error.message}`);
        }
    };

    setInterval(triggerSnapshot, intervalMs);
    logger.info(`Leaderboard snapshot cron scheduled (every ${intervalMs / 1000}s).`);
};
