import { Request, Response } from "express";
import { leaderboardService } from "../service/leaderboard.service";
import { StatusCodes } from "http-status-codes";
import { successResponse } from "../utils/response";
import { metricsService } from "../service/metrics.service";

export const snapshotLeaderboard = async (req: Request, res: Response) => {
    try {
        await leaderboardService.takeLeaderboardSnapshot();
        metricsService.getLeaderboardEventsTotal().inc({ event: 'snapshot', status: 'success' });
        res.status(StatusCodes.OK).json({ message: "Leaderboard snapshot taken successfully" });
    } catch (error) {
        console.error("Snapshot failed:", error);
        metricsService.getLeaderboardEventsTotal().inc({ event: 'snapshot', status: 'failure' });
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: (error as Error).message });
    }
};

export const getArchivedLeaderboardController = async (req: Request, res: Response) => {
    try {
        const { contestId } = req.params;
        const leaderboard = await leaderboardService.getArchivedLeaderboard(contestId);
        metricsService.getLeaderboardEventsTotal().inc({ event: 'view_archive', status: 'success' });
        successResponse(res, leaderboard, "Archived leaderboard fetched successfully");
    } catch (error) {
        console.error("Fetch archive failed:", error);
        metricsService.getLeaderboardEventsTotal().inc({ event: 'view_archive', status: 'failure' });
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: (error as Error).message });
    }
};
