import { Request, Response, NextFunction } from "express";
import { userService } from "../service/user.service";
import { successResponse } from "../utils/response";

export const getProfileController = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }
        const profile = await userService.getUserProfile(userId);
        successResponse(res, profile, "User profile fetched successfully");
    } catch (error) {
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
        successResponse(res, stats, "User statistics fetched successfully");
    } catch (error) {
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
        successResponse(res, activity, "User activity fetched successfully");
    } catch (error) {
        next(error);
    }
};
