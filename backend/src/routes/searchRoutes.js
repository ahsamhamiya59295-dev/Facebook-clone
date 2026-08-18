import { Router } from 'express';
import { query, body, param } from 'express-validator';
import { protect } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validationMiddleware.js';
import {
  searchAll,
  getSearchHistory,
  addSearchHistory,
  clearSearchHistory,
  deleteSearchHistory,
  getTrendingTopics,
} from '../controllers/searchController.js';

const router = Router();

router.use(protect);

router.get(
  '/',
  query('q').trim().notEmpty().withMessage('Search query is required').isLength({ max: 100 }).withMessage('Search must be 100 characters or fewer'),
  validate,
  searchAll,
);

router.get('/history', getSearchHistory);

router.post(
  '/history',
  body('query').isString().trim().notEmpty().withMessage('Search query is required').isLength({ max: 100 }).withMessage('Search must be 100 characters or fewer'),
  validate,
  addSearchHistory,
);

router.delete('/history', clearSearchHistory);

router.delete(
  '/history/:id',
  param('id').isUUID().withMessage('Invalid history id'),
  validate,
  deleteSearchHistory,
);

router.get('/trending', getTrendingTopics);

export default router;