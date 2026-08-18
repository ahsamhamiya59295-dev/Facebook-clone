import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { protect } from '../middleware/authMiddleware.js';
import { uploadArray, sniffUploadedFiles, cleanupUploads, enforceTotalSize } from '../middleware/uploadMiddleware.js';
import { uploadLimiter } from '../middleware/rateLimitMiddleware.js';
import { validate } from '../middleware/validationMiddleware.js';
import {
  getListings,
  getListing,
  createListing,
  updateListing,
  deleteListing,
  getCategories,
} from '../controllers/marketplaceController.js';

const router = Router();

router.use(protect);

router.get(
  '/',
  query('q').optional({ values: 'falsy' }).isLength({ max: 100 }).withMessage('Search must be 100 characters or fewer'),
  query('category').optional({ values: 'falsy' }).isLength({ max: 100 }).withMessage('Category must be 100 characters or fewer'),
  query('page').optional().isInt({ min: 1 }).withMessage('Invalid page'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Invalid limit'),
  validate,
  getListings,
);
router.get('/categories', getCategories);
router.post(
  '/',
  uploadLimiter,
  uploadArray('files', 6, 10),
  enforceTotalSize(20),
  cleanupUploads,
  sniffUploadedFiles,
  [
    body('title').isString().trim().notEmpty().withMessage('Title is required').isLength({ max: 120 }).withMessage('Title must be 120 characters or fewer'),
    body('price').isFloat({ min: 0 }).withMessage('Valid price is required'),
    body('category').isString().trim().notEmpty().withMessage('Category is required').isLength({ max: 100 }).withMessage('Category must be 100 characters or fewer'),
    body('condition').optional({ values: 'falsy' }).isLength({ max: 100 }).withMessage('Condition must be 100 characters or fewer'),
    body('location').optional({ values: 'falsy' }).isLength({ max: 200 }).withMessage('Location must be 200 characters or fewer'),
  ],
  validate,
  createListing,
);
router.get('/:id', param('id').isUUID().withMessage('Invalid listing id'), validate, getListing);
router.patch(
  '/:id',
  param('id').isUUID().withMessage('Invalid listing id'),
  [
    body('title').optional({ values: 'falsy' }).isString().trim().isLength({ max: 120 }).withMessage('Title must be 120 characters or fewer'),
    body('price').optional({ values: 'null' }).isFloat({ min: 0 }).withMessage('Valid price is required'),
    body('condition').optional({ values: 'falsy' }).isLength({ max: 100 }).withMessage('Condition must be 100 characters or fewer'),
    body('status').optional().isIn(['ACTIVE', 'SOLD', 'ARCHIVED']).withMessage('Invalid status'),
  ],
  validate,
  updateListing,
);
router.delete('/:id', param('id').isUUID().withMessage('Invalid listing id'), validate, deleteListing);

export default router;