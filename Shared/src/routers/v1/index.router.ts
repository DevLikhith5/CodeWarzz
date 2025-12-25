import express from 'express';
import pingRouter from './ping.router';

const v1Router = express.Router();



import authRouter from './auth.router';
import problemRouter from './problem.router';
import submissionRouter from './submission.router';

v1Router.use('/auth', authRouter);
v1Router.use('/ping', pingRouter);
v1Router.use('/problems', problemRouter);
v1Router.use('/submissions', submissionRouter);

export default v1Router;