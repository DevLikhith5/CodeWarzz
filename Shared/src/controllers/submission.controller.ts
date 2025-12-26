import { Request, Response, NextFunction } from 'express';
import { submissionService } from '../service/submission.service';
import { StatusCodes } from 'http-status-codes';

export const submitController = async (req: Request, res: Response, next: NextFunction) => {
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
        res.status(StatusCodes.CREATED).json({
            message: 'Submission received',
            submissionId: submission.id
        });
    } catch (error) {
        next(error);
    }
};
