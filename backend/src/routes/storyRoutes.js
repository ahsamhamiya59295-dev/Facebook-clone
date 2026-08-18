import { Router } from 'express';
import { param } from 'express-validator';
import { protect } from '../middleware/authMiddleware.js';
import { uploadSingle, sniffUploadedFiles, cleanupUploads } from '../middleware/uploadMiddleware.js';
import { uploadLimiter } from '../middleware/rateLimitMiddleware.js';
import { validate } from '../middleware/validationMiddleware.js';
import {
  getStories,
  createStory,
  viewStory,
  deleteStory,
  getStoryViewers,
} from '../controllers/storyController.js';

const router = Router();

router.use(protect);

router.get('/', getStories);
router.post('/', uploadLimiter, uploadSingle('file', 25), cleanupUploads, sniffUploadedFiles, createStory);
router.get('/:id/viewers', param('id').isUUID().withMessage('Invalid story id'), validate, getStoryViewers);
router.post('/:id/view', param('id').isUUID().withMessage('Invalid story id'), validate, viewStory);
router.delete('/:id', param('id').isUUID().withMessage('Invalid story id'), validate, deleteStory);

export default router;