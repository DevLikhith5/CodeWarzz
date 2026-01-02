import express from 'express';
import pingRouter from './ping.router';

const v1Router = express.Router();



import authRouter from './auth.router';
import problemRouter from './problem.router';
import contestRouter from "./contest.router";
import submissionRouter from './submission.router';
import leaderboardRouter from "./leaderboard.router";
import userRouter from "./user.router";

v1Router.use('/auth', authRouter);
v1Router.use('/ping', pingRouter);
v1Router.use('/problems', problemRouter);
v1Router.use('/contests', contestRouter);
v1Router.use('/submissions', submissionRouter);
v1Router.use('/leaderboard', leaderboardRouter);
v1Router.use('/users', userRouter);

v1Router.get('/health', (req, res) => {
    res.json({ status: "UP", service: "Core Service" });
});

export default v1Router;