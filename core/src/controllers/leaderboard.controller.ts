import { Request, Response, NextFunction } from "express";
import { leaderboardService } from "../service/leaderboard.service";
import { StatusCodes } from "http-status-codes";
import { successResponse } from "../utils/response";
import { metricsService } from "../service/metrics.service";
import { NotFoundError } from "../utils/errors/app.error";

export const snapshotLeaderboard = async (req: Request, res: Response, next: NextFunction) => {
    try {
        await leaderboardService.takeLeaderboardSnapshot();
        metricsService.getLeaderboardEventsTotal().inc({ event: 'snapshot', status: 'success' });
        res.status(StatusCodes.OK).json({ message: "Leaderboard snapshot taken successfully" });
    } catch (error) {
        metricsService.getLeaderboardEventsTotal().inc({ event: 'snapshot', status: 'failure' });
        next(error);
    }
};

export const getArchivedLeaderboardController = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { contestId } = req.params;
        const leaderboard = await leaderboardService.getArchivedLeaderboard(contestId);
        if (!leaderboard) {
            return next(new NotFoundError("Archived leaderboard not found"));
        }
        metricsService.getLeaderboardEventsTotal().inc({ event: 'view_archive', status: 'success' });
        successResponse(res, leaderboard, "Archived leaderboard fetched successfully");
    } catch (error) {
        metricsService.getLeaderboardEventsTotal().inc({ event: 'view_archive', status: 'failure' });
        next(error);
    }
};
