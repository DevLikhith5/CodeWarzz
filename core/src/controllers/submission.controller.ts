import { Request, Response, NextFunction } from 'express';
import { submissionService } from '../service/submission.service';
import { StatusCodes } from 'http-status-codes';

import logger from '../config/logger.config';
import { successResponse } from '../utils/response';

export const submitController = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?.id;
        logger.info(`Processing submission for user ${userId}`, { problemId: req.body.problemId });
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

export const getRunResultController = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const result = await submissionService.getRunResult(id);

        if (!result) {
            res.status(StatusCodes.NOT_FOUND).json({ message: 'Job not found' });
            return;
        }

        successResponse(res, result);
    } catch (error) {
        next(error);
    }
};

export const updateSubmissionController = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const submission = await submissionService.updateSubmission(id, req.body);
        successResponse(res, submission, 'Submission updated successfully');
    } catch (error) {
        next(error);
    }
};
export const getBestSubmissionController = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?.id;
        const { problemId } = req.query;

        if (!userId || !problemId) {
            res.status(StatusCodes.BAD_REQUEST).json({ message: 'Missing userId or problemId' });
            return;
        }

        const submission = await submissionService.getBestSubmission(userId, problemId as string);

        if (!submission) {
            // It is common to return specific code or just null/404 if no best submission exists
            // but 200 with null is also fine depending on frontend.
            // Let's return 404 for consistency with "not found"
            res.status(StatusCodes.NOT_FOUND).json({ message: 'No accepted submission found' });
            return;
        }

        successResponse(res, submission);
    } catch (error) {
        next(error);
    }
};
