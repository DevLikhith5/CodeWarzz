import { NextFunction, Request, Response } from "express";
import { AppError, isAppError } from "../utils/errors/app.error";
import logger from "../config/logger.config";
import { metricsService } from "../service/metrics.service";


export const appErrorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {

    if (!isAppError(err)) {
        return next(err);
    }
    const appErr = err as AppError;
    logger.error("App Error:", { error: err });
    metricsService.getAppErrorsTotal().inc({ type: 'AppError', code: appErr.statusCode });

    res.status(appErr.statusCode).json({
        success: false,
        message: appErr.message
    });
}

export const genericErrorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
    logger.error("Generic Error:", { error: err });
    metricsService.getAppErrorsTotal().inc({ type: 'GenericError', code: 500 });

    res.status(500).json({
        success: false,
        message: "Internal Server Error"
    });
}