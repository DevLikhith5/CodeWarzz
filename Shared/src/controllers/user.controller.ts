import { Request, Response, NextFunction } from "express";
import { userService } from "../service/user.service";
import { successResponse } from "../utils/response";
import { metricsService } from "../service/metrics.service";
import logger from "../config/logger.config";

export const getProfileController = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }
        const profile = await userService.getUserProfile(userId);

        metricsService.getUserEventsTotal().inc({ event: 'profile_view', status: 'success' });

        successResponse(res, profile, "User profile fetched successfully");
    } catch (error) {
        logger.error('Get profile failed', { error });
        metricsService.getUserEventsTotal().inc({ event: 'profile_view', status: 'failure' });
        next(error);
    }
};

export const getStatsController = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }
        const stats = await userService.getUserStats(userId);

        metricsService.getUserEventsTotal().inc({ event: 'stats_view', status: 'success' });

        successResponse(res, stats, "User statistics fetched successfully");
    } catch (error) {
        logger.error('Get stats failed', { error });
        metricsService.getUserEventsTotal().inc({ event: 'stats_view', status: 'failure' });
        next(error);
    }
};

export const getActivityController = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }
        const activity = await userService.getUserActivity(userId);

        metricsService.getUserEventsTotal().inc({ event: 'activity_view', status: 'success' });

        successResponse(res, activity, "User activity fetched successfully");
    } catch (error) {
        logger.error('Get activity failed', { error });
        metricsService.getUserEventsTotal().inc({ event: 'activity_view', status: 'failure' });
        next(error);
    }
};
