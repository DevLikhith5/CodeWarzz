import { Request, Response, NextFunction } from "express";
import { contestService } from "../service/contest.service";
import { StatusCodes } from "http-status-codes";

import { successResponse } from "../utils/response";
import logger from "../config/logger.config";
import { metricsService } from "../service/metrics.service";

export const createContest = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const contest = await contestService.createContest({
            ...req.body,
            startTime: new Date(req.body.startTime),
            endTime: new Date(req.body.endTime)
        });
        metricsService.getContestEventsTotal().inc({ event: 'create_contest', status: 'success' });
        successResponse(res, contest, "Contest created successfully", StatusCodes.CREATED);
    } catch (error) {
        metricsService.getContestEventsTotal().inc({ event: 'create_contest', status: 'failure' });
        next(error);
    }
};

export const getContest = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?.id;
        const contest = await contestService.getContest(req.params.id, userId);
        if (!contest) {
            return next(new (require('../utils/errors/app.error').NotFoundError)("Contest not found"));
        }
        metricsService.getContestEventsTotal().inc({ event: 'get_contest', status: 'success' });
        successResponse(res, contest);
    } catch (error) {
        metricsService.getContestEventsTotal().inc({ event: 'get_contest', status: 'failure' });
        next(error);
    }
};

export const getAllContests = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?.id;
        const { status, registered, participated } = req.query as { status?: string, registered?: string, participated?: string };
        const contests = await contestService.getAllContests(userId, { status, registered, participated });
        metricsService.getContestEventsTotal().inc({ event: 'list_contests', status: 'success' });
        successResponse(res, contests);
    } catch (error) {
        metricsService.getContestEventsTotal().inc({ event: 'list_contests', status: 'failure' });
        next(error);
    }
};

export const addProblemToContest = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { contestId, problemId } = req.body;
        logger.info("Adding problem to contest", { contestId, problemId });
        await contestService.addProblemToContest(contestId, problemId);
        metricsService.getContestEventsTotal().inc({ event: 'add_problem', status: 'success' });
        successResponse(res, null, "Problem added to contest");
    } catch (error) {
        metricsService.getContestEventsTotal().inc({ event: 'add_problem', status: 'failure' });
        next(error);
    }
};

export const registerForContest = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const contestId = req.params.id;
        const userId = req.user?.id;
        await contestService.registerForContest(contestId, userId!);
        metricsService.getContestEventsTotal().inc({ event: 'register', status: 'success' });
        successResponse(res, null, "Registered successfully");
    } catch (error) {
        metricsService.getContestEventsTotal().inc({ event: 'register', status: 'failure' });
        next(error);
    }
};

export const deregisterForContest = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const contestId = req.params.id;
        const userId = req.user?.id;
        await contestService.deregisterForContest(contestId, userId!);
        metricsService.getContestEventsTotal().inc({ event: 'deregister', status: 'success' });
        successResponse(res, null, "Deregistered successfully");
    } catch (error) {
        metricsService.getContestEventsTotal().inc({ event: 'deregister', status: 'failure' });
        next(error);
    }
};

export const getContestProblems = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const contestId = req.params.id;
        const userId = req.user?.id;
        const problems = await contestService.getContestProblems(contestId, userId);
        metricsService.getContestEventsTotal().inc({ event: 'view_problems', status: 'success' });
        successResponse(res, problems);
    } catch (error) {
        metricsService.getContestEventsTotal().inc({ event: 'view_problems', status: 'failure' });
        next(error);
    }
};

export const getContestLeaderboard = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const contestId = req.params.id;
        const leaderboard = await contestService.getContestLeaderboard(contestId);
        metricsService.getContestEventsTotal().inc({ event: 'view_leaderboard', status: 'success' });
        successResponse(res, leaderboard);
    } catch (error) {
        metricsService.getContestEventsTotal().inc({ event: 'view_leaderboard', status: 'failure' });
        next(error);
    }
};
