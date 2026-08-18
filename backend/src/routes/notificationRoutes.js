import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { protect } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validationMiddleware.js';
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getNotificationSettings,
  updateNotificationSettings,
} from '../controllers/notificationController.js';

const router = Router();

router.use(protect);

router.get('/', query('page').optional().isInt({ min: 1 }).withMessage('Invalid page'), validate, getNotifications);
router.get('/settings', getNotificationSettings);
router.patch(
  '/settings',
  [
    body('likesEnabled').optional().isBoolean().withMessage('Invalid value'),
    body('commentsEnabled').optional().isBoolean().withMessage('Invalid value'),
    body('friendRequestsEnabled').optional().isBoolean().withMessage('Invalid value'),
    body('followsEnabled').optional().isBoolean().withMessage('Invalid value'),
    body('messagesEnabled').optional().isBoolean().withMessage('Invalid value'),
    body('storiesEnabled').optional().isBoolean().withMessage('Invalid value'),
  ],
  validate,
  updateNotificationSettings,
);
router.patch('/read-all', markAllNotificationsRead);
router.patch('/:id/read', param('id').isUUID().withMessage('Invalid notification id'), validate, markNotificationRead);

export default router;