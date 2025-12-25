import { Request, Response, NextFunction } from 'express';
import { submissionService } from '../service/submission.service';
import { StatusCodes } from 'http-status-codes';

export const submitController = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const submission = await submissionService.submitSolution(req.body);
        res.status(StatusCodes.CREATED).json({
            message: 'Submission received',
            submissionId: submission.id
        });
    } catch (error) {
        next(error);
    }
};
