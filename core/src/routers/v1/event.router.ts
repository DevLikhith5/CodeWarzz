import { Router } from 'express';
import { getEventStreamController, replayEventsController } from '../../controllers/event.controller';

const router = Router();

router.get('/:entity/:entityId', getEventStreamController);
router.get('/:entity/:entityId/replay', replayEventsController);

export default router;
