import { Router } from 'express';
import { getPlagiarismByProblemController, getPlagiarismByContestController, getPlagiarismBySubmissionController } from '../../controllers/plagiarism.controller';
import { verifyToken, isAdmin } from '../../middlewares/auth.middleware';

const router = Router();

router.get('/problem/:problemId', verifyToken, isAdmin, getPlagiarismByProblemController);
router.get('/contest/:contestId', verifyToken, isAdmin, getPlagiarismByContestController);
router.get('/submission/:submissionId', verifyToken, isAdmin, getPlagiarismBySubmissionController);

export default router;
