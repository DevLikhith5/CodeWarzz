import { Request, Response } from "express";
import logger from "../config/logger.config";

export const pingHandler = async (req: Request, res: Response) => {
    logger.info("Ping request received");
    res.status(200).json({ message: "Pong!" });
};
