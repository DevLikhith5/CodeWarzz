import { Request, Response, NextFunction } from "express";
import { ZodError, ZodSchema } from "zod";
import { StatusCodes } from "http-status-codes";

interface ValidationSchemas {
    body?: ZodSchema;
    params?: ZodSchema;
    query?: ZodSchema;
}

export const validate = (schemas: ValidationSchemas | ZodSchema) => (req: Request, res: Response, next: NextFunction) => {
    try {
        //if there is only zodSchema
        if ('parse' in schemas) {
            schemas.parse(req.body);
        } else {
            if (schemas.body) schemas.body.parse(req.body);
            if (schemas.params) schemas.params.parse(req.params);
            if (schemas.query) schemas.query.parse(req.query);
        }
        next();
    } catch (error) {
        if (error instanceof ZodError) {
            res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                message: "Validation Error",
                errors: error.errors,
            });
            return;
        }
        //will go to generic error
        next(error);
    }
};
