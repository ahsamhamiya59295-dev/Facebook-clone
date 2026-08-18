import { Router } from 'express';
import { body, param } from 'express-validator';
import { protect } from '../middleware/authMiddleware.js';
import { uploadArray, sniffUploadedFiles, cleanupUploads, enforceTotalSize } from '../middleware/uploadMiddleware.js';
import { postLimiter } from '../middleware/rateLimitMiddleware.js';
import { validate } from '../middleware/validationMiddleware.js';
import {
  getFeed,
  createPostHandler,
  getPost,
  updatePostHandler,
  deletePostHandler,
  sharePostHandler,
} from '../controllers/postController.js';

const router = Router();

router.use(protect);

router.get('/feed', getFeed);
router.post(
  '/',
  postLimiter,
  uploadArray('files', 10, 15),
  enforceTotalSize(50),
  cleanupUploads,
  sniffUploadedFiles,
  [
    body('content').optional({ values: 'falsy' }).isString().trim().isLength({ max: 5000 }).withMessage('Content must be 5000 characters or fewer'),
    body('privacy').optional().isIn(['PUBLIC', 'FRIENDS', 'ONLY_ME']).withMessage('Invalid privacy setting'),
    body('location').optional({ values: 'falsy' }).isString().trim().isLength({ max: 200 }).withMessage('Location must be 200 characters or fewer'),
  ],
  validate,
  createPostHandler,
);
router.get('/:id', param('id').isUUID().withMessage('Invalid post id'), validate, getPost);
router.patch('/:id', param('id').isUUID().withMessage('Invalid post id'), [
  body('content').optional({ values: 'falsy' }).isString().trim().isLength({ max: 5000 }).withMessage('Content must be 5000 characters or fewer'),
  body('privacy').optional().isIn(['PUBLIC', 'FRIENDS', 'ONLY_ME']).withMessage('Invalid privacy setting'),
  body('location').optional({ values: 'falsy' }).isString().trim().isLength({ max: 200 }).withMessage('Location must be 200 characters or fewer'),
], validate, updatePostHandler);
router.delete('/:id', param('id').isUUID().withMessage('Invalid post id'), validate, deletePostHandler);
router.post(
  '/:id/share',
  param('id').isUUID().withMessage('Invalid post id'),
  body('content').optional({ values: 'falsy' }).isString().trim().isLength({ max: 5000 }).withMessage('Content must be 5000 characters or fewer'),
  validate,
  sharePostHandler,
);

export default router;