import { Router } from 'express';
import { body } from 'express-validator';
import {
  register,
  login,
  logout,
  me,
  forgotPassword,
  resetPasswordHandler,
  changePasswordHandler,
  verifyEmail,
  requestEmailVerification,
} from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validationMiddleware.js';
import { authLimiter } from '../middleware/rateLimitMiddleware.js';

const router = Router();

router.post(
  '/register',
  authLimiter,
  [
    body('fullName').isString().trim().notEmpty().withMessage('Full name is required').isLength({ min: 2, max: 80 }).withMessage('Full name must be 2-80 characters'),
    body('username').isString().trim().notEmpty().withMessage('Username is required').isLength({ min: 3, max: 30 }).withMessage('Username must be 3-30 characters').matches(/^[a-zA-Z0-9_.]+$/).withMessage('Username can only contain letters, numbers, dots and underscores'),
    body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
    body('password').isString().isLength({ min: 8, max: 128 }).withMessage('Password must be at least 8 characters').matches(/[a-zA-Z]/).withMessage('Password must contain a letter').matches(/[0-9]/).withMessage('Password must contain a number'),
    body('dob').isISO8601().withMessage('Valid date of birth is required'),
  ],
  validate,
  register,
);

router.post(
  '/login',
  authLimiter,
  [body('identifier').isString().trim().notEmpty().withMessage('Email or username is required'), body('password').isString().notEmpty().withMessage('Password is required')],
  validate,
  login,
);

router.post(
  '/forgot-password',
  authLimiter,
  [body('email').isEmail().withMessage('Valid email is required').normalizeEmail()],
  validate,
  forgotPassword,
);

router.post(
  '/reset-password',
  authLimiter,
  [
    body('token').isString().notEmpty().withMessage('Token is required'),
    body('password').isString().isLength({ min: 8, max: 128 }).withMessage('Password must be at least 8 characters').matches(/[a-zA-Z]/).withMessage('Password must contain a letter').matches(/[0-9]/).withMessage('Password must contain a number'),
  ],
  validate,
  resetPasswordHandler,
);

router.post(
  '/verify-email',
  authLimiter,
  [body('token').isString().notEmpty().withMessage('Token is required')],
  validate,
  verifyEmail,
);

router.post('/logout', logout);

router.get('/me', protect, me);

router.post('/me/change-password', protect, changePasswordHandler);

router.post('/me/verify-email', protect, requestEmailVerification);

export default router;