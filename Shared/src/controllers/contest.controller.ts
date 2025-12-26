
import { Request, Response } from "express";
import { contestService } from "../service/contest.service";
import { StatusCodes } from "http-status-codes";

import { successResponse } from "../utils/response";

export const createContest = async (req: Request, res: Response) => {
    try {
        const contest = await contestService.createContest({
            ...req.body,
            startTime: new Date(req.body.startTime),
            endTime: new Date(req.body.endTime)
        });
        successResponse(res, contest, "Contest created successfully", StatusCodes.CREATED);
    } catch (error) {
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: (error as Error).message });
    }
};

export const getContest = async (req: Request, res: Response) => {
    try {
        // @ts-ignore
        const userId = req.user?.id;
        const contest = await contestService.getContest(req.params.id, userId);
        if (!contest) {
            res.status(StatusCodes.NOT_FOUND).json({ error: "Contest not found" });
            return;
        }
        successResponse(res, contest);
    } catch (error) {
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: (error as Error).message });
    }
};

export const getAllContests = async (req: Request, res: Response) => {
    try {
        // @ts-ignore
        const userId = req.user?.id;
        const contests = await contestService.getAllContests(userId);
        successResponse(res, contests);
    } catch (error) {
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: (error as Error).message });
    }
};

export const addProblemToContest = async (req: Request, res: Response) => {
    try {
        const { contestId, problemId } = req.body;
        console.log("INSIDE CONTEST CONTROLLER LAYER: ", contestId, problemId)
        await contestService.addProblemToContest(contestId, problemId);
        successResponse(res, null, "Problem added to contest");
    } catch (error) {
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: (error as Error).message });
    }
};

export const registerForContest = async (req: Request, res: Response) => {
    try {
        const contestId = req.params.id;
        // @ts-ignore
        const userId = req.user.id;
        await contestService.registerForContest(contestId, userId);
        successResponse(res, null, "Registered successfully");
    } catch (error) {
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: (error as Error).message });
    }
};

export const deregisterForContest = async (req: Request, res: Response) => {
    try {
        const contestId = req.params.id;
        // @ts-ignore
        const userId = req.user.id;
        await contestService.deregisterForContest(contestId, userId);
        successResponse(res, null, "Deregistered successfully");
    } catch (error) {
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: (error as Error).message });
    }
};

export const getContestProblems = async (req: Request, res: Response) => {
    try {
        const contestId = req.params.id;
        const problems = await contestService.getContestProblems(contestId);
        successResponse(res, problems);
    } catch (error) {
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: (error as Error).message });
    }
};
