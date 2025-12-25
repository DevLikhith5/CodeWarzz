import { Router } from 'express';
import { createProblemController, getProblemController } from '../../controllers/problem.controller';
import { verifyToken, isAdmin } from '../../middlewares/auth.middleware';

const problemRouter = Router();


problemRouter.post('/', verifyToken, isAdmin, createProblemController);
problemRouter.get('/:id', getProblemController);

export default problemRouter;
