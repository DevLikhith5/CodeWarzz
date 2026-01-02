import { Request, Response } from "express";
import { contestService } from "../service/contest.service";
import { StatusCodes } from "http-status-codes";

import { successResponse } from "../utils/response";
import logger from "../config/logger.config";
import { metricsService } from "../service/metrics.service";

export const createContest = async (req: Request, res: Response) => {
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
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: (error as Error).message });
    }
};

export const getContest = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        const contest = await contestService.getContest(req.params.id, userId);
        if (!contest) {
            res.status(StatusCodes.NOT_FOUND).json({ error: "Contest not found" });
            return;
        }
        metricsService.getContestEventsTotal().inc({ event: 'get_contest', status: 'success' });
        successResponse(res, contest);
    } catch (error) {
        metricsService.getContestEventsTotal().inc({ event: 'get_contest', status: 'failure' });
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: (error as Error).message });
    }
};

export const getAllContests = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        const { status, registered, participated } = req.query as { status?: string, registered?: string, participated?: string };
        const contests = await contestService.getAllContests(userId, { status, registered, participated });
        metricsService.getContestEventsTotal().inc({ event: 'list_contests', status: 'success' });
        successResponse(res, contests);
    } catch (error) {
        metricsService.getContestEventsTotal().inc({ event: 'list_contests', status: 'failure' });
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: (error as Error).message });
    }
};

export const addProblemToContest = async (req: Request, res: Response) => {

    try {
        const { contestId, problemId } = req.body;
        logger.info("INSIDE CONTEST CONTROLLER LAYER: ", { contestId, problemId });
        await contestService.addProblemToContest(contestId, problemId);
        metricsService.getContestEventsTotal().inc({ event: 'add_problem', status: 'success' });
        successResponse(res, null, "Problem added to contest");
    } catch (error) {
        metricsService.getContestEventsTotal().inc({ event: 'add_problem', status: 'failure' });
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: (error as Error).message });
    }
};

export const registerForContest = async (req: Request, res: Response) => {
    try {
        const contestId = req.params.id;
        const userId = req.user?.id;
        await contestService.registerForContest(contestId, userId!);
        metricsService.getContestEventsTotal().inc({ event: 'register', status: 'success' });
        successResponse(res, null, "Registered successfully");
    } catch (error) {
        metricsService.getContestEventsTotal().inc({ event: 'register', status: 'failure' });
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: (error as Error).message });
    }
};

export const deregisterForContest = async (req: Request, res: Response) => {
    try {
        const contestId = req.params.id;
        const userId = req.user?.id;
        await contestService.deregisterForContest(contestId, userId!);
        metricsService.getContestEventsTotal().inc({ event: 'deregister', status: 'success' });
        successResponse(res, null, "Deregistered successfully");
    } catch (error) {
        metricsService.getContestEventsTotal().inc({ event: 'deregister', status: 'failure' });
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: (error as Error).message });
    }
};

export const getContestProblems = async (req: Request, res: Response) => {
    try {
        const contestId = req.params.id;
        const userId = req.user?.id;
        const problems = await contestService.getContestProblems(contestId, userId);
        metricsService.getContestEventsTotal().inc({ event: 'view_problems', status: 'success' });
        successResponse(res, problems);
    } catch (error) {
        metricsService.getContestEventsTotal().inc({ event: 'view_problems', status: 'failure' });
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: (error as Error).message });
    }
};

export const getContestLeaderboard = async (req: Request, res: Response) => {
    try {
        const contestId = req.params.id;
        const leaderboard = await contestService.getContestLeaderboard(contestId);
        metricsService.getContestEventsTotal().inc({ event: 'view_leaderboard', status: 'success' });
        successResponse(res, leaderboard);
    } catch (error) {
        metricsService.getContestEventsTotal().inc({ event: 'view_leaderboard', status: 'failure' });
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: (error as Error).message });
    }
};
