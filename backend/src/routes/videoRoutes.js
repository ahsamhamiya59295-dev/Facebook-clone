import { Router } from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { listVideos } from '../controllers/videoController.js';

const router = Router();

router.use(protect);

router.get('/', listVideos);

export default router;