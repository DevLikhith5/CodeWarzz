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
import { NextFunction, Request, Response, RequestHandler } from 'express';
import {
    updateLeaderboard,
    getUserRank,
} from '../services/leaderboard.service';
import { leaderboardReadModelService } from '../services/leaderboard.readmodel.service';
import logger from '../config/logger.config';
import { NotFoundError, BadRequestError } from '../utils/errors/app.error';

export const leaderboardController = {
    // ── WRITE SIDE ──────────────────────────────────────────────────────────
    upsertLeaderboard: (async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { userId, contestId, score, timeTakenInMs } = req.body;

            if (!userId || !contestId || score === undefined || timeTakenInMs === undefined) {
                return next(new BadRequestError('Missing required fields: userId, contestId, score, timeTakenInMs'));
            }

            const result = await updateLeaderboard({
                userId,
                contestId,
                score: Number(score),
                timeTakenInMs: Number(timeTakenInMs),
            });

            // Async CQRS projection (non-blocking)
            leaderboardReadModelService.project(contestId).catch((err: any) =>
                logger.error('Read model projection error', { error: err.message }),
            );

            res.status(200).json({ message: 'Leaderboard updated', ...result });
        } catch (err) {
            next(err);
        }
    }) as RequestHandler,

    // ── READ SIDE (Read Model) ───────────────────────────────────────────────
    getTopLeaderboard: (async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { contestId } = req.params;
            const limit = Number(req.query.limit) || 50;

            const entries = await leaderboardReadModelService.getTop(contestId, limit);

            res.json({ contestId, leaderboard: entries });
        } catch (err) {
            next(err);
        }
    }) as RequestHandler,

    getUserRank: (async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { contestId, userId } = req.params;

            const entry = await leaderboardReadModelService.getUserEntry(contestId, userId);
            if (entry) {
                return res.json(entry);
            }

            const result = await getUserRank(contestId, userId);
            if (!result) {
                return next(new NotFoundError('User not ranked'));
            }
            res.json(result);
        } catch (err) {
            next(err);
        }
    }) as RequestHandler,
};
