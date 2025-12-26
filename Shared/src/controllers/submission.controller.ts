import { Request, Response, NextFunction } from 'express';
import { submissionService } from '../service/submission.service';
import { StatusCodes } from 'http-status-codes';

import { successResponse } from '../utils/response';

export const submitController = async (req: Request, res: Response, next: NextFunction) => {
    console.log(`Above submission controller`)
    try {
        const userId = req.user?.id;
        const submission = await submissionService.submitSolution({
            ...req.body,
            userId,
            verdict: "PENDING",
            timeTakenMs: 0,
            passedTestcases: 0,
            totalTestcases: 0
        });
        successResponse(res, { submissionId: submission.id }, 'Submission received', StatusCodes.CREATED);
    } catch (error) {
        next(error);
    }
};

export const getSubmissionController = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const submission = await submissionService.getSubmission(id);
        if (!submission) {
            res.status(StatusCodes.NOT_FOUND).json({ message: 'Submission not found' });
            return;
        }
        successResponse(res, submission);
    } catch (error) {
        next(error);
    }
};

export const getSubmissionsController = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?.id;
        const { problemId, contestId, limit, offset } = req.query;

        const submissions = await submissionService.getSubmissions({
            userId,
            problemId: problemId as string,
            contestId: contestId as string
        }, limit ? parseInt(limit as string) : 20, offset ? parseInt(offset as string) : 0);

        successResponse(res, submissions);
    } catch (error) {
        next(error);
    }
};

export const runController = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?.id;
        const result = await submissionService.runSolution({
            ...req.body,
            userId,
        });
        successResponse(res, result, 'Execution finished');
    } catch (error) {
        next(error);
    }
}

export const updateSubmissionController = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const submission = await submissionService.updateSubmission(id, req.body);
        successResponse(res, submission, 'Submission updated successfully');
    } catch (error) {
        next(error);
    }
};
