import express from 'express';
import sharedV1Router from '../../../../Shared/src/routers/v1/index.router';

const v1Router = express.Router();

v1Router.use('/', sharedV1Router);

export default v1Router;