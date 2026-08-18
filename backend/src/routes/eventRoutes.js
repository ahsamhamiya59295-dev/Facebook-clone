import { Router } from 'express';
import { body, param } from 'express-validator';
import { protect } from '../middleware/authMiddleware.js';
import { uploadSingle, sniffUploadedFiles, cleanupUploads } from '../middleware/uploadMiddleware.js';
import { uploadLimiter } from '../middleware/rateLimitMiddleware.js';
import { validate } from '../middleware/validationMiddleware.js';
import {
  getEvents,
  getEvent,
  createEvent,
  rsvpEvent,
} from '../controllers/eventController.js';

const router = Router();

router.use(protect);

router.get('/', getEvents);
router.post(
  '/',
  uploadLimiter,
  uploadSingle('file', 10),
  cleanupUploads,
  sniffUploadedFiles,
  [
    body('name').isString().trim().notEmpty().withMessage('Event name is required').isLength({ max: 120 }).withMessage('Event name must be 120 characters or fewer'),
    body('startsAt').isISO8601().withMessage('Valid start date is required'),
    body('endsAt').optional({ values: 'falsy' }).isISO8601().withMessage('Valid end date is required'),
    body('privacy').optional().isIn(['PUBLIC', 'FRIENDS', 'INVITE_ONLY']).withMessage('Invalid event privacy'),
    body('location').optional({ values: 'falsy' }).isLength({ max: 200 }).withMessage('Location must be 200 characters or fewer'),
  ],
  validate,
  createEvent,
);
router.get('/:id', param('id').isUUID().withMessage('Invalid event id'), validate, getEvent);
router.post(
  '/:id/rsvp',
  param('id').isUUID().withMessage('Invalid event id'),
  body('status').isIn(['GOING', 'INTERESTED', 'MAYBE']).withMessage('Invalid RSVP status'),
  validate,
  rsvpEvent,
);

export default router;