import { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/errors/app.error";
import logger from "../config/logger.config";
import { metricsService } from "../service/metrics.service";


export const appErrorHandler = (err: AppError, req: Request, res: Response, next: NextFunction) => {


    if (!err.statusCode) {
        return next(err);
    }
    logger.error("App Error:", { error: err });
    metricsService.getAppErrorsTotal().inc({ type: 'AppError', code: err.statusCode || 500 });

    res.status(err.statusCode || 500).json({
        success: false,
        message: err.message
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