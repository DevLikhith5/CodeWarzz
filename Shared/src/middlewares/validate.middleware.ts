import { Request, Response, NextFunction } from "express";
import { AnyZodObject, ZodError } from "zod";
import { StatusCodes } from "http-status-codes";

interface ValidationSchemas {
    body?: AnyZodObject;
    params?: AnyZodObject;
    query?: AnyZodObject;
}

export const validate = (schemas: ValidationSchemas | AnyZodObject) => (req: Request, res: Response, next: NextFunction) => {
    try {
        if ('parse' in schemas) {
            // backward compatibility for just passing a body schema
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
        next(error);
    }
};
