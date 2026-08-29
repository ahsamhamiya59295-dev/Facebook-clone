import * as liveService from '../services/liveService.js';
import asyncHandler from '../utils/asyncHandler.js';

export const createLive = asyncHandler(async (req, res) => {
  const live = await liveService.createLive(req.user.id, req.body);
  res.status(201).json({ success: true, live });
});

export const startLive = asyncHandler(async (req, res) => {
  const live = await liveService.startLive(req.user.id, req.params.id);
  res.json({ success: true, live });
});

export const endLive = asyncHandler(async (req, res) => {
  const live = await liveService.endLive(req.user.id, req.params.id);
  res.json({ success: true, live });
});

export const getLive = asyncHandler(async (req, res) => {
  const live = await liveService.getLive(req.params.id);
  res.json({ success: true, live });
});

export const getLiveByRoom = asyncHandler(async (req, res) => {
  const live = await liveService.getLiveByRoomCode(req.params.roomCode);
  res.json({ success: true, live });
});

export const listLives = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const result = await liveService.listActiveLives({
    page: parseInt(page) || 1,
    limit: Math.min(parseInt(limit) || 20, 50),
  });
  res.json({ success: true, ...result });
});

export const joinLive = asyncHandler(async (req, res) => {
  await liveService.joinLive(req.user.id, req.params.id);
  res.json({ success: true });
});

export const leaveLive = asyncHandler(async (req, res) => {
  await liveService.leaveLive(req.user.id, req.params.id);
  res.json({ success: true });
});

export const addComment = asyncHandler(async (req, res) => {
  const { content } = req.body;
  if (!content || typeof content !== 'string' || !content.trim()) {
    return res.status(400).json({ success: false, message: 'Comment content is required' });
  }
  const comment = await liveService.addComment(req.user.id, req.params.id, content);
  res.status(201).json({ success: true, comment });
});

export const getComments = asyncHandler(async (req, res) => {
  const prisma = (await import('../config/database.js')).default;
  const { id } = req.params;
  const { after } = req.query;

  const where = { liveStreamId: id, isHidden: false };
  if (after) {
    where.createdAt = { gt: new Date(after) };
  }

  const comments = await prisma.liveComment.findMany({
    where,
    include: {
      user: { select: { id: true, username: true, fullName: true, profile: { select: { avatarUrl: true } } } },
    },
    orderBy: { createdAt: 'asc' },
    take: 100,
  });

  res.json({ success: true, comments });
});

export const deleteComment = asyncHandler(async (req, res) => {
  await liveService.deleteComment(req.user.id, req.params.id, req.params.commentId);
  res.json({ success: true });
});

export const moderateComment = asyncHandler(async (req, res) => {
  await liveService.moderateComment(req.user.id, req.params.id, req.params.commentId);
  res.json({ success: true });
});

export const banUser = asyncHandler(async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ success: false, message: 'userId is required' });
  await liveService.banUser(req.user.id, req.params.id, userId);
  res.json({ success: true });
});

export const unbanUser = asyncHandler(async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ success: false, message: 'userId is required' });
  await liveService.unbanUser(req.user.id, req.params.id, userId);
  res.json({ success: true });
});

export const reportLive = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  if (!reason || typeof reason !== 'string' || !reason.trim()) {
    return res.status(400).json({ success: false, message: 'Reason is required' });
  }
  await liveService.reportLive(req.user.id, req.params.id, reason);
  res.json({ success: true });
});

export const getViewerList = asyncHandler(async (req, res) => {
  const viewers = await liveService.getViewerList(req.params.id);
  res.json({ success: true, viewers });
});

export const getMyActiveLive = asyncHandler(async (req, res) => {
  const live = await liveService.getActiveLiveByOwner(req.user.id);
  res.json({ success: true, live: live || null });
});
