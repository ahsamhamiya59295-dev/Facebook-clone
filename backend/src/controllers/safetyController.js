import asyncHandler from '../utils/asyncHandler.js';
import AppError from '../utils/AppError.js';
import prisma from '../config/database.js';

export const getBlockedUsers = asyncHandler(async (req, res) => {
  const blocks = await prisma.block.findMany({
    where: { blockerId: req.user.id },
    include: { blocked: { select: { id: true, username: true, fullName: true, profile: { select: { avatarUrl: true } } } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ success: true, blockedUsers: blocks.map((b) => b.blocked) });
});

export const blockUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (id === req.user.id) throw new AppError('You cannot block yourself', 400);
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) throw new AppError('User not found', 404);

  await prisma.block.upsert({
    where: { blockerId_blockedId: { blockerId: req.user.id, blockedId: id } },
    create: { blockerId: req.user.id, blockedId: id },
    update: {},
  });

  // remove friendship and pending requests when blocked
  await prisma.friendship.deleteMany({
    where: { OR: [{ userOneId: req.user.id, userTwoId: id }, { userOneId: id, userTwoId: req.user.id }] },
  });
  await prisma.friendRequest.deleteMany({
    where: { OR: [{ senderId: req.user.id, receiverId: id }, { senderId: id, receiverId: req.user.id }] },
  });

  res.json({ success: true });
});

export const unblockUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await prisma.block.deleteMany({ where: { blockerId: req.user.id, blockedId: id } });
  res.json({ success: true });
});

export const reportItem = asyncHandler(async (req, res) => {
  const { targetType, targetId, reason } = req.body;
  if (!targetType || !targetId || !reason) throw new AppError('targetType, targetId and reason are required', 400);

  await prisma.report.create({
    data: { reporterId: req.user.id, targetType, targetId, reason },
  });
  res.json({ success: true, message: 'Report submitted' });
});