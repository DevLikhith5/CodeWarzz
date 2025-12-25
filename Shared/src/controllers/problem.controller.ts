import { Request, Response, NextFunction } from 'express';
import { problemService } from '../service/problem.service';
import { StatusCodes } from 'http-status-codes';

export const createProblemController = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const problem = await problemService.createProblem(req.body);
        res.status(StatusCodes.CREATED).json({
            message: 'Problem created successfully',
            problemId: problem.id
        });
    } catch (error) {
        next(error);
    }
};

export const getProblemController = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const problem = await problemService.getProblem(id);
        if (!problem) {
            res.status(StatusCodes.NOT_FOUND).json({ message: 'Problem not found' });
            return;
        }
        res.status(StatusCodes.OK).json(problem);
    } catch (error) {
        next(error);
    }
}
