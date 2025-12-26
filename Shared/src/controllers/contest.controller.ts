
import { Request, Response } from "express";
import { contestService } from "../service/contest.service";
import { StatusCodes } from "http-status-codes";

export const createContest = async (req: Request, res: Response) => {
    try {
        const contest = await contestService.createContest({
            ...req.body,
            startTime: new Date(req.body.startTime),
            endTime: new Date(req.body.endTime)
        });
        res.status(StatusCodes.CREATED).json(contest);
    } catch (error) {
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: (error as Error).message });
    }
};

export const getContest = async (req: Request, res: Response) => {
    try {
        const contest = await contestService.getContest(req.params.id);
        if (!contest) {
            res.status(StatusCodes.NOT_FOUND).json({ error: "Contest not found" });
            return;
        }
        res.status(StatusCodes.OK).json(contest);
    } catch (error) {
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: (error as Error).message });
    }
};

export const getAllContests = async (req: Request, res: Response) => {
    try {
        const contests = await contestService.getAllContests();
        res.status(StatusCodes.OK).json(contests);
    } catch (error) {
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: (error as Error).message });
    }
};

export const addProblemToContest = async (req: Request, res: Response) => {
    try {
        const { contestId, problemId } = req.body;
        console.log("INSIDE CONTEST CONTROLLER LAYER: ", contestId, problemId)
        await contestService.addProblemToContest(contestId, problemId);
        res.status(StatusCodes.OK).json({ message: "Problem added to contest" });
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
        res.status(StatusCodes.OK).json({ message: "Registered successfully" });
    } catch (error) {
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: (error as Error).message });
    }
};

export const getContestProblems = async (req: Request, res: Response) => {
    try {
        const contestId = req.params.id;
        const problems = await contestService.getContestProblems(contestId);
        res.status(StatusCodes.OK).json(problems);
    } catch (error) {
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: (error as Error).message });
    }
};
