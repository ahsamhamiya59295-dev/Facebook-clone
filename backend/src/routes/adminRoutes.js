import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { protect, requireAdmin } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validationMiddleware.js';
import {
  getDashboard,
  listUsers,
  toggleUserStatus,
  setUserRole,
  deleteUser,
  listReports,
  resolveReport,
} from '../controllers/adminController.js';

const router = Router();

router.use(protect, requireAdmin);

router.get('/dashboard', getDashboard);
router.get('/users', query('page').optional().isInt({ min: 1 }).withMessage('Invalid page'), query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Invalid limit'), validate, listUsers);
router.patch('/users/:id/status', param('id').isUUID().withMessage('Invalid user id'), validate, toggleUserStatus);
router.patch('/users/:id/role', param('id').isUUID().withMessage('Invalid user id'), body('role').isIn(['USER', 'ADMIN']).withMessage('Invalid role'), validate, setUserRole);
router.delete('/users/:id', param('id').isUUID().withMessage('Invalid user id'), validate, deleteUser);
router.get('/reports', query('page').optional().isInt({ min: 1 }).withMessage('Invalid page'), query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Invalid limit'), validate, listReports);
router.patch('/reports/:id/resolve', param('id').isUUID().withMessage('Invalid report id'), validate, resolveReport);

export default router;