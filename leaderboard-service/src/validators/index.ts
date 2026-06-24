import { NextFunction, Request, Response } from "express";
import { AnyZodObject, ZodError } from "zod";
import logger from "../config/logger.config";

export const validateRequestBody = (schema: AnyZodObject) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            req.body = await schema.parseAsync(req.body);
            next();
        } catch (error) {
            if (error instanceof ZodError) {
                logger.warn("Request body validation failed", { errors: error.errors });
                return res.status(400).json({
                    message: "Invalid request body",
                    success: false,
                    errors: error.errors.map((e) => ({ path: e.path.join('.'), message: e.message })),
                });
            }
            next(error);
        }
    };
};

export const validateQueryParams = (schema: AnyZodObject) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            req.query = await schema.parseAsync(req.query);
            next();
        } catch (error) {
            if (error instanceof ZodError) {
                logger.warn("Query params validation failed", { errors: error.errors });
                return res.status(400).json({
                    message: "Invalid query params",
                    success: false,
                    errors: error.errors.map((e) => ({ path: e.path.join('.'), message: e.message })),
                });
            }
            next(error);
        }
    };
};
