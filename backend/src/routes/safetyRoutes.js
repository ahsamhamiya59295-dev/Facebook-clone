import { Router } from 'express';
import { body, param } from 'express-validator';
import { protect } from '../middleware/authMiddleware.js';
import { reportLimiter } from '../middleware/rateLimitMiddleware.js';
import { validate } from '../middleware/validationMiddleware.js';
import {
  getBlockedUsers,
  blockUser,
  unblockUser,
  reportItem,
} from '../controllers/safetyController.js';

const router = Router();

router.use(protect);

router.get('/blocked', getBlockedUsers);
router.post('/blocks/:id', param('id').isUUID().withMessage('Invalid user id'), validate, blockUser);
router.delete('/blocks/:id', param('id').isUUID().withMessage('Invalid user id'), validate, unblockUser);
router.post(
  '/reports',
  reportLimiter,
  [
    body('targetType').isIn(['POST', 'COMMENT', 'USER', 'GROUP', 'MESSAGE', 'MARKETPLACE']).withMessage('Invalid target type'),
    body('targetId').isUUID().withMessage('Invalid target id'),
    body('reason').isString().trim().notEmpty().withMessage('Reason is required').isLength({ max: 1000 }).withMessage('Reason must be 1000 characters or fewer'),
  ],
  validate,
  reportItem,
);

export default router;