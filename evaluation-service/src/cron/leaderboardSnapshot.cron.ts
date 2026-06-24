import logger from "../config/logger.config";

let snapshotTimer: NodeJS.Timeout | null = null;

export const setupSnapshotCron = async () => {
    const intervalMs = 120000; 
    const coreUrl = process.env.CORE_SERVICE_URL || 'http://localhost:3001';
    const internalApiKey = process.env.INTERNAL_API_KEY;

    const triggerSnapshot = async () => {
        try {
            logger.info("Triggering Leaderboard Snapshot via API...");
            const response = await fetch(`${coreUrl}/api/v1/leaderboard/snapshot`, {
                method: 'POST',
                headers: internalApiKey ? { 'x-internal-api-key': internalApiKey } : {},
                signal: AbortSignal.timeout(10000),
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

    snapshotTimer = setInterval(triggerSnapshot, intervalMs);
    logger.info(`Leaderboard snapshot cron scheduled (every ${intervalMs / 1000}s).`);
};

export const stopSnapshotCron = () => {
    if (snapshotTimer) {
        clearInterval(snapshotTimer);
        snapshotTimer = null;
        logger.info("Snapshot cron stopped.");
    }
};
