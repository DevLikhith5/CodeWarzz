import { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/errors/app.error";
import logger from "../config/logger.config";

export const appErrorHandler = (err: AppError, req: Request, res: Response, next: NextFunction) => {

    logger.error(err.message, { error: err });

    res.status(err.statusCode).json({
        success: false,
        message: err.message
    });
}

export const genericErrorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
    logger.error(err.message, { error: err });

    res.status(500).json({
        success: false,
        message: "Internal Server Error"
    });
}