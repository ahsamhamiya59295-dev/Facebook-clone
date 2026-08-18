import { Router } from 'express';
import { param } from 'express-validator';
import { protect } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validationMiddleware.js';
import {
  sendRequest,
  acceptRequest,
  rejectRequest,
  cancelRequest,
  unfriend,
} from '../controllers/friendController.js';

const router = Router();

router.use(protect);

router.post('/request/:userId', param('userId').isUUID().withMessage('Invalid user id'), validate, sendRequest);
router.post('/accept/:userId', param('userId').isUUID().withMessage('Invalid user id'), validate, acceptRequest);
router.post('/reject/:userId', param('userId').isUUID().withMessage('Invalid user id'), validate, rejectRequest);
router.post('/cancel/:userId', param('userId').isUUID().withMessage('Invalid user id'), validate, cancelRequest);
router.delete('/:userId', param('userId').isUUID().withMessage('Invalid user id'), validate, unfriend);

export default router;