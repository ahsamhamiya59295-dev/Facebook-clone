import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { protect } from '../middleware/authMiddleware.js';
import { liveLimiter, liveCommentLimiter, liveReportLimiter } from '../middleware/rateLimitMiddleware.js';
import { validate } from '../middleware/validationMiddleware.js';
import * as liveController from '../controllers/liveController.js';

const router = Router();

router.get('/lives', liveController.listLives);
router.get('/lives/active', protect, liveController.getMyActiveLive);
router.get('/lives/:id', liveController.getLive);
router.get('/lives/room/:roomCode', liveController.getLiveByRoom);

router.post('/lives',
  protect,
  liveLimiter,
  [
    body('title').optional().isString().trim().isLength({ max: 200 }),
    body('description').optional().isString().trim().isLength({ max: 1000 }),
    body('visibility').optional().isIn(['PUBLIC', 'FRIENDS', 'ONLY_ME']),
  ],
  validate,
  liveController.createLive
);

router.post('/lives/:id/start',
  protect,
  liveLimiter,
  [param('id').isUUID()],
  validate,
  liveController.startLive
);

router.post('/lives/:id/end',
  protect,
  liveLimiter,
  [param('id').isUUID()],
  validate,
  liveController.endLive
);

router.post('/lives/:id/join',
  protect,
  liveLimiter,
  [param('id').isUUID()],
  validate,
  liveController.joinLive
);

router.post('/lives/:id/leave',
  protect,
  liveLimiter,
  [param('id').isUUID()],
  validate,
  liveController.leaveLive
);

router.post('/lives/:id/comments',
  protect,
  liveCommentLimiter,
  [
    param('id').isUUID(),
    body('content').isString().trim().isLength({ min: 1, max: 500 }),
  ],
  validate,
  liveController.addComment
);

router.get('/lives/:id/comments',
  [param('id').isUUID()],
  validate,
  liveController.getComments
);

router.delete('/lives/:id/comments/:commentId',
  protect,
  [param('id').isUUID(), param('commentId').isUUID()],
  validate,
  liveController.deleteComment
);

router.post('/lives/:id/comments/:commentId/hide',
  protect,
  [param('id').isUUID(), param('commentId').isUUID()],
  validate,
  liveController.moderateComment
);

router.post('/lives/:id/ban',
  protect,
  [param('id').isUUID(), body('userId').isUUID()],
  validate,
  liveController.banUser
);

router.post('/lives/:id/unban',
  protect,
  [param('id').isUUID(), body('userId').isUUID()],
  validate,
  liveController.unbanUser
);

router.post('/lives/:id/report',
  protect,
  liveReportLimiter,
  [
    param('id').isUUID(),
    body('reason').isString().trim().isLength({ min: 1, max: 500 }),
  ],
  validate,
  liveController.reportLive
);

router.get('/lives/:id/viewers',
  [param('id').isUUID()],
  validate,
  liveController.getViewerList
);

export default router;
