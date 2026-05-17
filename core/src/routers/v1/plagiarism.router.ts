import { Router } from 'express';
import { getPlagiarismByProblemController, getPlagiarismByContestController, getPlagiarismBySubmissionController } from '../../controllers/plagiarism.controller';

const router = Router();

router.get('/problem/:problemId', getPlagiarismByProblemController);
router.get('/contest/:contestId', getPlagiarismByContestController);
router.get('/submission/:submissionId', getPlagiarismBySubmissionController);

export default router;
