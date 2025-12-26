import { Request, Response } from "express";
import { takeLeaderboardSnapshot, getArchivedLeaderboard } from "../service/leaderboard.service";
import { StatusCodes } from "http-status-codes";
import { successResponse } from "../utils/response";

export const snapshotLeaderboard = async (req: Request, res: Response) => {
    try {
        await takeLeaderboardSnapshot();
        res.status(StatusCodes.OK).json({ message: "Leaderboard snapshot taken successfully" });
    } catch (error) {
        console.error("Snapshot failed:", error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: (error as Error).message });
    }
};

export const getArchivedLeaderboardController = async (req: Request, res: Response) => {
    try {
        const { contestId } = req.params;
        const leaderboard = await getArchivedLeaderboard(contestId);
        successResponse(res, leaderboard, "Archived leaderboard fetched successfully");
    } catch (error) {
        console.error("Fetch archive failed:", error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: (error as Error).message });
    }
};
