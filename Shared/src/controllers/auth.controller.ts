import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { authService } from '../service/auth.service';
import { successResponse } from '../utils/response';

export const signUp = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { username, email, password, role } = req.body;
        const user = await authService.signUp(username, email, password, role);

        successResponse(res, { user }, 'User registered successfully', StatusCodes.CREATED);
    } catch (error) {
        next(error);
    }
};

export const signIn = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { email, password } = req.body;
        const tokens = await authService.signIn(email, password);

        successResponse(res, tokens, 'Login successful');
    } catch (error) {
        next(error);
    }
};

export const refreshToken = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { refreshToken } = req.body;
        const tokens = await authService.refreshToken(refreshToken);

        successResponse(res, tokens, 'Token refreshed');
    } catch (error) {
        next(error);
    }
};
