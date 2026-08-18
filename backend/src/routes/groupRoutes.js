import { Router } from 'express';
import { body, param } from 'express-validator';
import { protect } from '../middleware/authMiddleware.js';
import { uploadSingle, sniffUploadedFiles, cleanupUploads } from '../middleware/uploadMiddleware.js';
import { uploadLimiter } from '../middleware/rateLimitMiddleware.js';
import { validate } from '../middleware/validationMiddleware.js';
import {
  getGroups,
  getGroupById,
  createGroup,
  joinGroup,
  leaveGroup,
  getGroupPosts,
  createGroupPost,
} from '../controllers/groupController.js';

const router = Router();

router.use(protect);

router.get('/', getGroups);
router.post(
  '/',
  [
    body('name').isString().trim().notEmpty().withMessage('Group name is required').isLength({ max: 120 }).withMessage('Group name must be 120 characters or fewer'),
    body('description').optional({ values: 'falsy' }).isLength({ max: 2000 }).withMessage('Description must be 2000 characters or fewer'),
    body('privacy').optional().isIn(['PUBLIC', 'CLOSED', 'PRIVATE']).withMessage('Invalid group privacy'),
  ],
  validate,
  createGroup,
);
router.get('/:id', param('id').isUUID().withMessage('Invalid group id'), validate, getGroupById);
router.post('/:id/join', param('id').isUUID().withMessage('Invalid group id'), validate, joinGroup);
router.post('/:id/leave', param('id').isUUID().withMessage('Invalid group id'), validate, leaveGroup);
router.get('/:id/posts', param('id').isUUID().withMessage('Invalid group id'), validate, getGroupPosts);
router.post(
  '/:id/posts',
  uploadLimiter,
  uploadSingle('file', 20),
  cleanupUploads,
  sniffUploadedFiles,
  [param('id').isUUID().withMessage('Invalid group id'), body('content').optional({ values: 'falsy' }).isString().isLength({ max: 5000 }).withMessage('Content must be 5000 characters or fewer')],
  validate,
  createGroupPost,
);

export default router;