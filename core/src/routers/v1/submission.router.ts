import { Router } from 'express';
import { submitController, getSubmissionController, getSubmissionsController, runController, updateSubmissionController, getRunResultController, getBestSubmissionController } from '../../controllers/submission.controller';
import { verifyToken, verifyInternalOrUser } from '../../middlewares/auth.middleware';

import { validate } from '../../middlewares/validate.middleware';
import {
    createSubmissionSchema,
    runCodeSchema,
    updateSubmissionSchema,
    getSubmissionSchema,
    getSubmissionsSchema
} from '../../dtos/submission.dto';

const submissionRouter = Router();

submissionRouter.get('/best', verifyToken, getBestSubmissionController);
submissionRouter.get('/', verifyToken, validate(getSubmissionsSchema), getSubmissionsController);
submissionRouter.get('/:id', verifyToken, validate(getSubmissionSchema), getSubmissionController);
submissionRouter.get('/run/:id', verifyToken, getRunResultController);
submissionRouter.patch('/:id', verifyInternalOrUser, validate(updateSubmissionSchema), updateSubmissionController);
submissionRouter.post('/', verifyInternalOrUser, validate(createSubmissionSchema), submitController);
submissionRouter.post('/run', verifyToken, validate(runCodeSchema), runController);

export default submissionRouter;
