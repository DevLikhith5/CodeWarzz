import { Router } from 'express';
import {
    signUp, signIn, refreshToken,
    googleCallBack,
    googleSignin,
    logout
} from '../../controllers/auth.controller';

import { verifyToken } from '../../middlewares/auth.middleware';

import { validate } from '../../middlewares/validate.middleware';
import { registerSchema, loginSchema } from '../../dtos/auth.dto';

const authRouter = Router();

authRouter.post('/signup', validate(registerSchema), signUp);
authRouter.post('/signin', validate(loginSchema), signIn);
authRouter.post('/refresh', refreshToken);

authRouter.get('/google/signin', googleSignin)
//callback url 
authRouter.get('/google/callback', googleCallBack)

authRouter.post('/logout', logout);

import { metricsService } from '../../service/metrics.service';

authRouter.get('/me', verifyToken, (req, res) => {
    metricsService.getAuthEventsTotal().inc({ event: 'session_check', status: 'success' });
    res.status(200).json({ message: 'Authenticated', user: req.user });
});

export default authRouter;
