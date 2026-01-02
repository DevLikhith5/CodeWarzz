import express from 'express';
import coreV1Router from '../../../../core/src/routers/v1/index.router';

const v1Router = express.Router();

v1Router.use('/', coreV1Router);

export default v1Router;