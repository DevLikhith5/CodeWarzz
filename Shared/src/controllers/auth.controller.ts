import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { authService } from '../service/auth.service';

export const signUp = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { username, email, password, role } = req.body;
        const user = await authService.signUp(username, email, password, role);

        res.status(StatusCodes.CREATED).json({
            message: 'User registered successfully',
            user
        });
    } catch (error) {
        next(error);
    }
};

export const signIn = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { email, password } = req.body;
        const tokens = await authService.signIn(email, password);

        res.status(StatusCodes.OK).json(tokens);
    } catch (error) {
        next(error);
    }
};

export const refreshToken = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { refreshToken } = req.body;
        const tokens = await authService.refreshToken(refreshToken);

        res.status(StatusCodes.OK).json(tokens);
    } catch (error) {
        next(error);
    }
};
