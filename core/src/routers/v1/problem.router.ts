import { Router } from 'express';
import { createProblemController, getProblemController, getProblemsController, getProblemBySlugController } from '../../controllers/problem.controller';
import { verifyToken, isAdmin, extractUser } from '../../middlewares/auth.middleware';

import { validate } from '../../middlewares/validate.middleware';
import { createProblemSchema } from '../../dtos/problem.dto';

const problemRouter = Router();

problemRouter.get('/', extractUser, getProblemsController);
problemRouter.post('/', verifyToken, isAdmin, validate(createProblemSchema), createProblemController);
problemRouter.get('/:id', extractUser, getProblemController);
problemRouter.get('/slug/:slug', extractUser, getProblemBySlugController);

export default problemRouter;
