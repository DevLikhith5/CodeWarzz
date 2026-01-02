import { Response } from "express";
import { StatusCodes } from "http-status-codes";

export const successResponse = (res: Response, data: any, message: string = "Success", statusCode: number = StatusCodes.OK) => {
     res.status(statusCode).json({
        success: true,
        message,
        data,
    });
};
