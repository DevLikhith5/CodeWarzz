/**
 * Leaderboard HTTP controller.
 *
 * CQRS split:
 *  - WRITE: upsertLeaderboard  → writes to Write Model (Redis sorted set)
 *                                  then projects to Read Model asynchronously
 *  - READ:  getTopLeaderboard  → reads from Read Model (Redis Hash index)
 *                                  ~10x faster than scanning the sorted set
 *           getUserRank        → O(1) hash lookup from Read Model
 */
import { RequestHandler } from 'express';
import {
    updateLeaderboard,
    getUserRank,
} from '../services/leaderboard.service';
import { leaderboardReadModelService } from '../services/leaderboard.readmodel.service';
import logger from '../config/logger.config';

export const leaderboardController = {
    // ── WRITE SIDE ──────────────────────────────────────────────────────────
    upsertLeaderboard: (async (req, res) => {
        try {
            const { userId, contestId, score, timeTakenInMs } = req.body;

            if (!userId || !contestId || score === undefined || timeTakenInMs === undefined) {
                res.status(400).json({ message: 'Missing fields' });
                return;
            }

            const result = await updateLeaderboard({ userId, contestId, score, timeTakenInMs });

            // Async CQRS projection (non-blocking)
            leaderboardReadModelService.project(contestId).catch((err: any) =>
                logger.error('Read model projection error', { error: err.message }),
            );

            res.status(200).json({ message: 'Leaderboard updated', ...result });
        } catch (err) {
            res.status(500).json({ message: 'Internal Server Error' });
        }
    }) as RequestHandler,

    // ── READ SIDE (Read Model) ───────────────────────────────────────────────
    getTopLeaderboard: (async (req, res) => {
        try {
            const { contestId } = req.params;
            const limit = Number(req.query.limit) || 50;

            // Served from CQRS Read Model — no sorted-set range scan
            const entries = await leaderboardReadModelService.getTop(contestId, limit);

            res.json({ contestId, leaderboard: entries });
        } catch (err) {
            res.status(500).json({ message: 'Internal server error' });
        }
    }) as RequestHandler,

    getUserRank: (async (req, res) => {
        try {
            const { contestId, userId } = req.params;

            // O(1) hash lookup from Read Model
            const entry = await leaderboardReadModelService.getUserEntry(contestId, userId);
            if (entry) {
                res.json(entry);
                return;
            }

            // Fallback to write model (cold read model scenario)
            const result = await getUserRank(contestId, userId);
            if (!result) {
                res.status(404).json({ message: 'User not ranked' });
                return;
            }
            res.json(result);
        } catch (err) {
            res.status(500).json({ message: 'Internal server error' });
        }
    }) as RequestHandler,
};
