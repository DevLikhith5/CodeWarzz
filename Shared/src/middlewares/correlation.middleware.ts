import { NextFunction, Request, Response } from 'express';
import { v4 as uuidV4 } from 'uuid';
import { asyncLocalStorage } from '../utils/helpers/request.helpers';

export const attachCorrelationIdMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const existingCorrelationId = req.headers['x-correlation-id'] as string;
    const correlationId = existingCorrelationId || uuidV4();

    req.headers['x-correlation-id'] = correlationId;

    asyncLocalStorage.run({ correlationId }, () => {
        next();
    });
};