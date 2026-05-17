import { Request, Response, NextFunction } from 'express';
import { getPlagiarismByProblem, getPlagiarismByContest, getPlagiarismBySubmission } from '../service/plagiarism';
import { successResponse } from '../utils/response';

export const getPlagiarismByProblemController = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { problemId } = req.params;
        const reports = await getPlagiarismByProblem(problemId);
        successResponse(res, reports, 'Plagiarism reports retrieved');
    } catch (error) {
        next(error);
    }
};

export const getPlagiarismByContestController = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { contestId } = req.params;
        const reports = await getPlagiarismByContest(contestId);
        successResponse(res, reports, 'Plagiarism reports retrieved');
    } catch (error) {
        next(error);
    }
};

export const getPlagiarismBySubmissionController = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { submissionId } = req.params;
        const reports = await getPlagiarismBySubmission(submissionId);
        successResponse(res, reports, 'Plagiarism reports retrieved');
    } catch (error) {
        next(error);
    }
};
