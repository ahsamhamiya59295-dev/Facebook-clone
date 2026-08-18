import { Router } from 'express';
import { body, param } from 'express-validator';
import { protect } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validationMiddleware.js';
import {
  getSavedPosts,
  toggleSavePost,
  addCollection,
  removeCollection,
  getUserMedia,
} from '../controllers/savedPostController.js';

const router = Router();

router.use(protect);

router.get('/', getSavedPosts);
router.post('/collections', body('name').isString().trim().notEmpty().withMessage('Collection name is required').isLength({ max: 100 }).withMessage('Collection name must be 100 characters or fewer'), validate, addCollection);
router.delete('/collections/:id', param('id').isUUID().withMessage('Invalid collection id'), validate, removeCollection);
router.post('/:id', param('id').isUUID().withMessage('Invalid post id'), validate, toggleSavePost);
router.get('/users/:id/media', param('id').isUUID().withMessage('Invalid user id'), validate, getUserMedia);

export default router;