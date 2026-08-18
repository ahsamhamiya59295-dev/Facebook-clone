import { Router } from 'express';
import { body, param } from 'express-validator';
import { protect } from '../middleware/authMiddleware.js';
import { uploadSingle, sniffUploadedFiles, cleanupUploads } from '../middleware/uploadMiddleware.js';
import { messageLimiter } from '../middleware/rateLimitMiddleware.js';
import { validate } from '../middleware/validationMiddleware.js';
import {
  getConversations,
  createConversation,
  getMessages,
  postMessage,
  markConversationRead,
} from '../controllers/messageController.js';

const router = Router();

router.use(protect);

router.get('/conversations', getConversations);
router.post('/conversations', body('userId').isUUID().withMessage('Invalid user id'), validate, createConversation);
router.get('/conversations/:id/messages', param('id').isUUID().withMessage('Invalid conversation id'), validate, getMessages);
router.post(
  '/conversations/:id/messages',
  messageLimiter,
  uploadSingle('file', 15),
  cleanupUploads,
  sniffUploadedFiles,
  [
    param('id').isUUID().withMessage('Invalid conversation id'),
    body('content').optional({ values: 'falsy' }).isString().isLength({ max: 5000 }).withMessage('Message must be 5000 characters or fewer'),
  ],
  validate,
  postMessage,
);
router.patch('/conversations/:id/read', param('id').isUUID().withMessage('Invalid conversation id'), validate, markConversationRead);

export default router;