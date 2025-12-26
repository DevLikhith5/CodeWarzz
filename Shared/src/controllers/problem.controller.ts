import { Request, Response, NextFunction } from 'express';
import { problemService } from '../service/problem.service';
import { StatusCodes } from 'http-status-codes';

import { successResponse } from '../utils/response';

export const createProblemController = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const problem = await problemService.createProblem(req.body);
        successResponse(res, { problemId: problem.id }, 'Problem created successfully', StatusCodes.CREATED);
    } catch (error) {
        next(error);
    }
};

export const getProblemsController = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const problems = await problemService.getAllProblems();
        successResponse(res, problems);
    } catch (error) {
        next(error);
    }
}

export const getProblemController = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const problem = await problemService.getProblem(id);
        if (!problem) {
            res.status(StatusCodes.NOT_FOUND).json({ message: 'Problem not found' });
            return;
        }
        successResponse(res, problem);
    } catch (error) {
        next(error);
    }
}
