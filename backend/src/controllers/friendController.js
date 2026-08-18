import asyncHandler from '../utils/asyncHandler.js';
import AppError from '../utils/AppError.js';
import prisma from '../config/database.js';
import { createNotification } from '../services/notificationService.js';

async function ensureNotBlocked(incomingUser, outgoingId) {
  const block = await prisma.block.findFirst({
    where: {
      OR: [
        { blockerId: incomingUser, blockedId: outgoingId },
        { blockerId: outgoingId, blockedId: incomingUser },
      ],
    },
  });
  if (block) throw new AppError('Unable to interact with this user', 403);
}

export const sendRequest = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  if (userId === req.user.id) throw new AppError('You cannot befriend yourself', 400);
  await ensureNotBlocked(req.user.id, userId);

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) throw new AppError('User not found', 404);

  const existing = await prisma.friendRequest.findFirst({
    where: {
      OR: [
        { senderId: req.user.id, receiverId: userId },
        { senderId: userId, receiverId: req.user.id },
      ],
    },
  });

  if (existing) {
    if (existing.status === 'PENDING') {
      if (existing.senderId === req.user.id) throw new AppError('Friend request already sent', 409);
      // incoming request - auto accept
      await prisma.friendRequest.update({
        where: { id: existing.id },
        data: { status: 'ACCEPTED', respondedAt: new Date() },
      });
      await createFriendship(req.user.id, userId);
      await createNotification({
        recipientId: userId,
        actorId: req.user.id,
        type: 'FRIEND_ACCEPT',
        message: `${req.user.fullName} accepted your friend request`,
      });
      return res.json({ success: true, status: 'FRIENDS' });
    }
    if (existing.status === 'ACCEPTED') {
      return res.json({ success: true, status: 'FRIENDS' });
    }
    // rejected/canceled - allow resend
    await prisma.friendRequest.update({
      where: { id: existing.id },
      data: { status: 'PENDING', senderId: req.user.id, receiverId: userId, respondedAt: null },
    });
    await notify();
    return res.json({ success: true, status: 'REQUEST_SENT' });
  }

  await prisma.friendRequest.create({
    data: { senderId: req.user.id, receiverId: userId, status: 'PENDING' },
  });
  await notify();
  return res.json({ success: true, status: 'REQUEST_SENT' });

  async function notify() {
    await createNotification({
      recipientId: userId,
      actorId: req.user.id,
      type: 'FRIEND_REQUEST',
      message: `${req.user.fullName} sent you a friend request`,
    });
  }
});

async function createFriendship(a, b) {
  const [low, high] = [a, b].sort();
  const existingF = await prisma.friendship.findFirst({
    where: { OR: [{ userOneId: low, userTwoId: high }, { userOneId: high, userTwoId: low }] },
  });
  if (!existingF) {
    await prisma.friendship.create({ data: { userOneId: low, userTwoId: high } });
  }
}

export const acceptRequest = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  await ensureNotBlocked(req.user.id, userId);

  const request = await prisma.friendRequest.findFirst({
    where: { senderId: userId, receiverId: req.user.id, status: 'PENDING' },
  });
  if (!request) throw new AppError('No pending friend request found', 404);

  await prisma.friendRequest.update({
    where: { id: request.id },
    data: { status: 'ACCEPTED', respondedAt: new Date() },
  });
  await createFriendship(req.user.id, userId);

  await createNotification({
    recipientId: userId,
    actorId: req.user.id,
    type: 'FRIEND_ACCEPT',
    message: `${req.user.fullName} accepted your friend request`,
  });

  res.json({ success: true, status: 'FRIENDS' });
});

export const rejectRequest = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  await prisma.friendRequest.updateMany({
    where: { senderId: userId, receiverId: req.user.id, status: 'PENDING' },
    data: { status: 'REJECTED', respondedAt: new Date() },
  });
  res.json({ success: true, status: 'NONE' });
});

export const cancelRequest = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  await prisma.friendRequest.updateMany({
    where: { senderId: req.user.id, receiverId: userId, status: 'PENDING' },
    data: { status: 'CANCELED', respondedAt: new Date() },
  });
  res.json({ success: true, status: 'NONE' });
});

export const unfriend = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  await prisma.friendship.deleteMany({
    where: { OR: [{ userOneId: req.user.id, userTwoId: userId }, { userOneId: userId, userTwoId: req.user.id }] },
  });
  await prisma.friendRequest.updateMany({
    where: { OR: [{ senderId: req.user.id, receiverId: userId }, { senderId: userId, receiverId: req.user.id }] },
    data: { status: 'CANCELED', respondedAt: new Date() },
  });
  res.json({ success: true, status: 'NONE' });
});