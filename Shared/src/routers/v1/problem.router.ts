import { Router } from 'express';
import { createProblemController, getProblemController, getProblemsController } from '../../controllers/problem.controller';
import { verifyToken, isAdmin } from '../../middlewares/auth.middleware';

import { validate } from '../../middlewares/validate.middleware';
import { createProblemSchema } from '../../dtos/problem.dto';

const problemRouter = Router();

problemRouter.get('/', getProblemsController);
problemRouter.post('/', verifyToken, isAdmin, validate(createProblemSchema), createProblemController);
problemRouter.get('/:id', getProblemController);

export default problemRouter;
