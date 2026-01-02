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
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const userId = req.user?.id; // Optional: Extract userId if authenticated

        const result = await problemService.getAllProblems(page, limit, userId);
        metricsService.getProblemEventsTotal().inc({ event: 'list_problems', status: 'success' });
        successResponse(res, result, 'Problems fetched successfully');
    } catch (error) {
        metricsService.getProblemEventsTotal().inc({ event: 'list_problems', status: 'failure' });
        next(error);
    }
};

export const getProblemController = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id;
        const problem = await problemService.getProblem(id, userId);
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

export const getProblemBySlugController = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { slug } = req.params;
        const userId = req.user?.id;
        const problem = await problemService.getProblemBySlug(slug, userId);
        if (!problem) {
            res.status(StatusCodes.NOT_FOUND).json({ message: 'Problem not found' });
            return;
        }
        metricsService.getProblemEventsTotal().inc({ event: 'get_problem_slug', status: 'success' });
        successResponse(res, problem);
    } catch (error) {
        metricsService.getProblemEventsTotal().inc({ event: 'get_problem_slug', status: 'failure' });
        next(error);
    }
}

