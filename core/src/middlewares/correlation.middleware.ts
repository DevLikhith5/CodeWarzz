import { NextFunction, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { asyncLocalStorage } from "../utils/helpers/request.helpers";

export const correlationIdMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const incomingHeader = req.header("x-correlation-id");
    const correlationId = incomingHeader ?? uuidv4();

    req.headers["x-correlation-id"] = correlationId;
    res.setHeader("x-correlation-id", correlationId);

    asyncLocalStorage.run({ correlationId }, next);
};