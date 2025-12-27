import { Request, Response, NextFunction } from 'express';
import { problemService } from '../service/problem.service';
import { StatusCodes } from 'http-status-codes';
import { metricsService } from '../service/metrics.service';
import { successResponse } from '../utils/response';

export const createProblemController = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const problem = await problemService.createProblem(req.body);
        metricsService.getProblemEventsTotal().inc({ event: 'create_problem', status: 'success' });
        successResponse(res, { problemId: problem.id }, 'Problem created successfully', StatusCodes.CREATED);
    } catch (error) {
        metricsService.getProblemEventsTotal().inc({ event: 'create_problem', status: 'failure' });
        next(error);
    }
};

export const getProblemsController = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const problems = await problemService.getAllProblems();
        metricsService.getProblemEventsTotal().inc({ event: 'list_problems', status: 'success' });
        successResponse(res, problems);
    } catch (error) {
        metricsService.getProblemEventsTotal().inc({ event: 'list_problems', status: 'failure' });
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
        metricsService.getProblemEventsTotal().inc({ event: 'get_problem', status: 'success' });
        successResponse(res, problem);
    } catch (error) {
        metricsService.getProblemEventsTotal().inc({ event: 'get_problem', status: 'failure' });
        next(error);
    }
}
