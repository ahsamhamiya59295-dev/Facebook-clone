import { Router } from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { listStreams } from '../controllers/streamController.js';

const router = Router();

router.use(protect);

router.get('/', listStreams);

export default router;