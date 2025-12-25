import { Router } from 'express';
import { submitController } from '../../controllers/submission.controller';
import { verifyToken } from '../../middlewares/auth.middleware';

const submissionRouter = Router();

submissionRouter.post('/', verifyToken, submitController);

export default submissionRouter;
