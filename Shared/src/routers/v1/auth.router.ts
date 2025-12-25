import { Router } from 'express';
import { signUp, signIn, refreshToken } from '../../controllers/auth.controller';

import { verifyToken } from '../../middlewares/auth.middleware';

const authRouter = Router();

authRouter.post('/signup', signUp);
authRouter.post('/signin', signIn);
authRouter.post('/refresh', refreshToken);
authRouter.get('/me', verifyToken, (req, res) => {
    res.status(200).json({ message: 'Authenticated', user: req.user });
});

export default authRouter;
