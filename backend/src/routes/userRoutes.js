import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { protect } from '../middleware/authMiddleware.js';
import { uploadSingle, sniffUploadedFiles, cleanupUploads } from '../middleware/uploadMiddleware.js';
import { uploadLimiter } from '../middleware/rateLimitMiddleware.js';
import { validate } from '../middleware/validationMiddleware.js';
import {
  getUser,
  getUserByUsernameHandler,
  updateMe,
  uploadAvatar,
  uploadCover,
  getUserPosts,
  getFriendsHandler,
  getFollowersHandler,
  getFollowingHandler,
  getFriendRequestsHandler,
  getSuggestionsHandler,
  getMutualFriends,
  toggleFollow,
} from '../controllers/userController.js';

const router = Router();

router.use(protect);

router.get('/username/:username', param('username').isLength({ min: 3, max: 30 }).withMessage('Invalid username'), validate, getUserByUsernameHandler);
router.get('/by-username/:username', param('username').isLength({ min: 3, max: 30 }).withMessage('Invalid username'), validate, getUserByUsernameHandler);
router.get('/me/requests', getFriendRequestsHandler);
router.get('/suggestions', query('limit').optional().isInt({ min: 1, max: 20 }).withMessage('Invalid limit'), validate, getSuggestionsHandler);
router.get('/me/mutual/:id', param('id').isUUID().withMessage('Invalid user id'), validate, getMutualFriends);

router.patch(
  '/me',
  [
    body('fullName').optional({ values: 'falsy' }).isString().trim().isLength({ min: 2, max: 80 }).withMessage('Full name must be 2-80 characters'),
    body('username').optional({ values: 'falsy' }).isString().trim().isLength({ min: 3, max: 30 }).withMessage('Username must be 3-30 characters').matches(/^[a-zA-Z0-9_.]+$/).withMessage('Username can only contain letters, numbers, dots and underscores'),
    body('gender').optional({ values: 'falsy' }).isIn(['MALE', 'FEMALE', 'OTHER']).withMessage('Invalid gender'),
    body('profile.bio').optional({ values: 'falsy' }).isLength({ max: 500 }).withMessage('Bio must be 500 characters or fewer'),
    body('profile.website').optional({ values: 'falsy' }).isLength({ max: 200 }).withMessage('Website must be 200 characters or fewer').isURL().withMessage('Invalid website URL'),
    body('profile.location').optional({ values: 'falsy' }).isLength({ max: 200 }).withMessage('Location must be 200 characters or fewer'),
    body('profile.privacy').optional().isIn(['PUBLIC', 'FRIENDS', 'ONLY_ME']).withMessage('Invalid privacy setting'),
    body('profile.birthdayVisibility').optional().isIn(['PUBLIC', 'FRIENDS', 'ONLY_ME']).withMessage('Invalid birthday visibility'),
  ],
  validate,
  updateMe,
);
router.patch('/me/avatar', uploadLimiter, uploadSingle('file', 5), cleanupUploads, sniffUploadedFiles, uploadAvatar);
router.patch('/me/cover', uploadLimiter, uploadSingle('file', 5), cleanupUploads, sniffUploadedFiles, uploadCover);

router.get('/:id', param('id').isUUID().withMessage('Invalid user id'), validate, getUser);
router.get('/:id/posts', param('id').isUUID().withMessage('Invalid user id'), validate, getUserPosts);
router.get('/:id/friends', param('id').isUUID().withMessage('Invalid user id'), validate, getFriendsHandler);
router.get('/:id/followers', param('id').isUUID().withMessage('Invalid user id'), validate, getFollowersHandler);
router.get('/:id/following', param('id').isUUID().withMessage('Invalid user id'), validate, getFollowingHandler);
router.post('/:id/follow', param('id').isUUID().withMessage('Invalid user id'), validate, toggleFollow);
router.delete('/:id/follow', param('id').isUUID().withMessage('Invalid user id'), validate, toggleFollow);

export default router;