import { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/errors/app.error";
import logger from "../config/logger.config";
import { metricsService } from "../../../core/src/service/metrics.service";

export const appErrorHandler = (err: AppError, req: Request, res: Response, next: NextFunction) => {
    const statusCode = err.statusCode || 500;
    logger.error("App Error:", { error: err.message, stack: err.stack, statusCode });

    if (process.env.NODE_ENV !== 'test') {
        metricsService.getAppErrorsTotal().inc({ type: 'AppError', code: statusCode });
    }

    res.status(statusCode).json({
        success: false,
        message: err.message,
    });
}

export const genericErrorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
    logger.error("Generic Error:", { error: err.message, stack: err.stack });

    if (process.env.NODE_ENV !== 'test') {
        try {
            metricsService.getAppErrorsTotal().inc({ type: 'GenericError', code: 500 });
        } catch {
            // metrics may not be initialized in tests
        }
    }

    res.status(500).json({
        success: false,
        message: "Internal Server Error",
    });
}
