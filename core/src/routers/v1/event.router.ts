import { Router } from 'express';
import { getEventStreamController, replayEventsController } from '../../controllers/event.controller';
import { verifyToken, isAdmin } from '../../middlewares/auth.middleware';

const router = Router();

router.get('/:entity/:entityId', verifyToken, isAdmin, getEventStreamController);
router.get('/:entity/:entityId/replay', verifyToken, isAdmin, replayEventsController);

export default router;
