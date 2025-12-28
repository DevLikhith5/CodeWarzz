import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { authService } from '../service/auth.service';
import { successResponse } from '../utils/response';
import logger from '../config/logger.config';
import { metricsService } from '../service/metrics.service';

export const signUp = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { username, email, password, role } = req.body;
        logger.info('SignUp request received', { username, email });
        const user = await authService.signUp(username, email, password, role);
        logger.info('User registered successfully', { userId: user.id });

        metricsService.getAuthEventsTotal().inc({ event: 'signup', status: 'success' });

        successResponse(res, { user }, 'User registered successfully', StatusCodes.CREATED);
    } catch (error) {
        logger.error('SignUp failed', { error });
        metricsService.getAuthEventsTotal().inc({ event: 'signup', status: 'failure' });
        next(error);
    }
};

export const signIn = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { email } = req.body;
        logger.info('SignIn request received', { email });
        const tokens = await authService.signIn(email, req.body.password);
        logger.info('Login successful', { email });

        metricsService.getAuthEventsTotal().inc({ event: 'signin', status: 'success' });

        successResponse(res, tokens, 'Login successful');
    } catch (error) {
        logger.error('SignIn failed', { error });
        metricsService.getAuthEventsTotal().inc({ event: 'signin', status: 'failure' });
        next(error);
    }
};

export const refreshToken = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { refreshToken } = req.body;
        logger.info('RefreshToken request received');
        const tokens = await authService.refreshToken(refreshToken);
        logger.info('Token refreshed successfully');

        metricsService.getAuthEventsTotal().inc({ event: 'refresh', status: 'success' });

        successResponse(res, tokens, 'Token refreshed');
    } catch (error) {
        logger.error('RefreshToken failed', { error });
        metricsService.getAuthEventsTotal().inc({ event: 'refresh', status: 'failure' });
        next(error);
    }
};
