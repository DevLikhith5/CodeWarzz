import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { getEventStream, replayEvents, EventEntity } from '../service/eventStore.service';
import { successResponse } from '../utils/response';

export const getEventStreamController = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { entity, entityId } = req.params;

        if (!['submission', 'contest', 'user', 'problem'].includes(entity)) {
            res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                message: 'Invalid entity type. Must be: submission, contest, user, or problem',
            });
            return;
        }

        const events = await getEventStream(entity as EventEntity, entityId);
        successResponse(res, events, 'Event stream retrieved');
    } catch (error) {
        next(error);
    }
};

export const replayEventsController = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { entity, entityId } = req.params;

        if (!['submission', 'contest', 'user', 'problem'].includes(entity)) {
            res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                message: 'Invalid entity type. Must be: submission, contest, user, or problem',
            });
            return;
        }

        const state = await replayEvents(entity as EventEntity, entityId);
        successResponse(res, state, 'Events replayed successfully');
    } catch (error) {
        next(error);
    }
};
