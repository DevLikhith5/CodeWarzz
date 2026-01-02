import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { authService } from '../service/auth.service';
import { successResponse } from '../utils/response';
import logger from '../config/logger.config';
import { metricsService } from '../service/metrics.service';
import { StateHelper } from '../utils/helpers/oAuth/state.helper';
import { setAuthCookies, clearAuthCookies } from '../utils/helpers/cookie.helper';

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

        setAuthCookies(res, tokens.accessToken, tokens.refreshToken);

        successResponse(res, null, 'Login successful');
    } catch (error) {
        logger.error('SignIn failed', { error });
        metricsService.getAuthEventsTotal().inc({ event: 'signin', status: 'failure' });
        next(error);
    }
};

export const refreshToken = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { refreshToken } = req.cookies;
        console.log(refreshToken)
        logger.info('RefreshToken request received');

        if (!refreshToken) {
            throw new Error("Refresh token not found");
        }

        const tokens = await authService.refreshToken(refreshToken);
        logger.info('Token refreshed successfully');

        metricsService.getAuthEventsTotal().inc({ event: 'refresh', status: 'success' });

        setAuthCookies(res, tokens.accessToken, tokens.refreshToken);

        successResponse(res, tokens, 'Token refreshed');
    } catch (error) {
        logger.error('RefreshToken failed', { error });
        metricsService.getAuthEventsTotal().inc({ event: 'refresh', status: 'failure' });
        next(error);
    }
};


export const googleCallBack = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { code, state } = req.query as { code: string, state: string };
        const savedState = StateHelper.getStateCookie(req);

        console.log("state", state);
        console.log("savedState", savedState);

        if (!state || !savedState || state !== savedState) {
            logger.error('Invalid state parameter in Google callback');
            metricsService.getAuthEventsTotal().inc({ event: 'google_signin', status: 'failure_state_mismatch' });
            res.status(StatusCodes.BAD_REQUEST).json({ success: false, message: 'Invalid state parameter' });
            return;
        }

        ``
        res.clearCookie('state');

        logger.info('Google callback request received', { code });
        const { accessToken, refreshToken, user } = await authService.googleCallBack(code);
        logger.info('Login successful', { email: user.email });

        metricsService.getAuthEventsTotal().inc({ event: 'google_signin', status: 'success' });



        setAuthCookies(res, accessToken, refreshToken);


        const frontendCallbackUrl = process.env.FRONTEND_URL
            ? `${process.env.FRONTEND_URL}/auth/callback`
            : 'http://localhost:8080/auth/callback';

        res.redirect(frontendCallbackUrl);
    } catch (error) {
        metricsService.getAuthEventsTotal().inc({ event: 'google_signin', status: 'failure' });
        next(error);
    }
}

export const googleSignin = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const state = StateHelper.setStateCookie(res);
        const response_type = "code";
        const client_id = process.env.GOOGLE_CLIENT_ID;
        const redirect_uri = process.env.GOOGLE_REDIRECT_URI;
        const scope = 'email profile openid';

        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?response_type=${response_type}&client_id=${client_id}&redirect_uri=${redirect_uri}&scope=${scope}&state=${state}`;

        res.redirect(authUrl);
    } catch (error) {
        metricsService.getAuthEventsTotal().inc({ event: 'google_signin', status: 'failure' });
        next(error);
    }
}

export const logout = async (req: Request, res: Response, next: NextFunction) => {
    try {
        logger.info('Logout request received');

        clearAuthCookies(res);

        // Also clear state cookie if it exists
        res.clearCookie('state');

        metricsService.getAuthEventsTotal().inc({ event: 'logout', status: 'success' });
        successResponse(res, null, 'Logged out successfully');
    } catch (error) {
        logger.error('Logout failed', { error });
        metricsService.getAuthEventsTotal().inc({ event: 'logout', status: 'failure' });
        next(error);
    }
};