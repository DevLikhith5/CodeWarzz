import { Request, Response } from "express";
import { takeLeaderboardSnapshot } from "../service/leaderboard.service";
import { StatusCodes } from "http-status-codes";

export const snapshotLeaderboard = async (req: Request, res: Response) => {
    try {
        await takeLeaderboardSnapshot();
        res.status(StatusCodes.OK).json({ message: "Leaderboard snapshot taken successfully" });
    } catch (error) {
        console.error("Snapshot failed:", error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: (error as Error).message });
    }
};
