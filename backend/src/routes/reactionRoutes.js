import { Router } from 'express';
import { body, param } from 'express-validator';
import { protect } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validationMiddleware.js';
import { setReaction, removeReaction } from '../controllers/reactionController.js';

const router = Router();

router.use(protect);

router.post(
  '/posts/:id/reactions',
  param('id').isUUID().withMessage('Invalid post id'),
  body('type').isIn(['LIKE', 'LOVE', 'CARE', 'HAHA', 'WOW', 'SAD', 'ANGRY']).withMessage('Invalid reaction type'),
  validate,
  setReaction,
);
router.delete('/posts/:id/reactions', param('id').isUUID().withMessage('Invalid post id'), validate, removeReaction);

export default router;