import { Router } from 'express';
import { body, param } from 'express-validator';
import { protect } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validationMiddleware.js';
import {
  getComments,
  getReplies,
  createComment,
  updateCommentHandler,
  deleteCommentHandler,
  reactToComment,
} from '../controllers/commentController.js';

const router = Router();

router.use(protect);

router.get('/posts/:id/comments', param('id').isUUID().withMessage('Invalid post id'), validate, getComments);
router.post(
  '/posts/:id/comments',
  param('id').isUUID().withMessage('Invalid post id'),
  body('content').isString().trim().notEmpty().withMessage('Comment text is required').isLength({ max: 2000 }).withMessage('Comment must be 2000 characters or fewer'),
  body('parentId').optional({ values: 'null' }).isUUID().withMessage('Invalid parent comment id'),
  validate,
  createComment,
);
router.get('/comments/:id/replies', param('id').isUUID().withMessage('Invalid comment id'), validate, getReplies);
router.post(
  '/comments/:id/reactions',
  param('id').isUUID().withMessage('Invalid comment id'),
  body('type').isIn(['LIKE', 'LOVE', 'CARE', 'HAHA', 'WOW', 'SAD', 'ANGRY']).withMessage('Invalid reaction type'),
  validate,
  reactToComment,
);
router.patch('/comments/:id', param('id').isUUID().withMessage('Invalid comment id'), body('content').isString().trim().notEmpty().withMessage('Comment text is required').isLength({ max: 2000 }).withMessage('Comment must be 2000 characters or fewer'), validate, updateCommentHandler);
router.delete('/comments/:id', param('id').isUUID().withMessage('Invalid comment id'), validate, deleteCommentHandler);

export default router;