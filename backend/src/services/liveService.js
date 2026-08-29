import crypto from 'crypto';
import prisma from '../config/database.js';
import AppError from '../utils/AppError.js';

function generateRoomCode() {
  return crypto.randomBytes(16).toString('hex');
}

export async function createLive(userId, { title, description, visibility }) {
  const activeLive = await prisma.liveStream.findFirst({
    where: { ownerId: userId, status: { in: ['CREATED', 'STARTING', 'LIVE'] } },
  });
  if (activeLive) throw new AppError('You already have an active live stream', 409);

  const live = await prisma.liveStream.create({
    data: {
      ownerId: userId,
      title: (title || '').trim().slice(0, 200),
      description: (description || '').trim().slice(0, 1000),
      visibility: visibility || 'PUBLIC',
      roomCode: generateRoomCode(),
    },
    include: { owner: { select: { id: true, username: true, fullName: true, profile: { select: { avatarUrl: true } } } } },
  });
  return live;
}

export async function startLive(userId, liveId) {
  const live = await prisma.liveStream.findUnique({ where: { id: liveId } });
  if (!live) throw new AppError('Live stream not found', 404);
  if (live.ownerId !== userId) throw new AppError('Not authorized', 403);
  if (live.status !== 'CREATED' && live.status !== 'STARTING') {
    throw new AppError('Live stream cannot be started', 400);
  }

  return prisma.liveStream.update({
    where: { id: liveId },
    data: { status: 'LIVE', startedAt: new Date() },
  });
}

export async function endLive(userId, liveId) {
  const live = await prisma.liveStream.findUnique({ where: { id: liveId } });
  if (!live) throw new AppError('Live stream not found', 404);
  if (live.ownerId !== userId) throw new AppError('Not authorized', 403);
  if (live.status === 'ENDED' || live.status === 'ENDING') {
    throw new AppError('Live stream already ended', 400);
  }

  const now = new Date();
  const duration = live.startedAt ? Math.floor((now - live.startedAt) / 1000) : 0;

  return prisma.liveStream.update({
    where: { id: liveId },
    data: {
      status: 'ENDED',
      endedAt: now,
      duration,
      currentViewerCount: 0,
    },
  });
}

export async function getLive(liveId) {
  const live = await prisma.liveStream.findUnique({
    where: { id: liveId },
    include: {
      owner: {
        select: {
          id: true, username: true, fullName: true,
          profile: { select: { avatarUrl: true } },
        },
      },
      _count: { select: { comments: { where: { isHidden: false } }, viewers: { where: { isLive: true } } } },
    },
  });
  if (!live) throw new AppError('Live stream not found', 404);
  return live;
}

export async function getLiveByRoomCode(roomCode) {
  const live = await prisma.liveStream.findUnique({
    where: { roomCode },
    include: {
      owner: {
        select: {
          id: true, username: true, fullName: true,
          profile: { select: { avatarUrl: true } },
        },
      },
    },
  });
  if (!live) throw new AppError('Live stream not found', 404);
  return live;
}

export async function listActiveLives({ page = 1, limit = 20 } = {}) {
  const skip = (Math.max(1, page) - 1) * limit;
  const [lives, total] = await Promise.all([
    prisma.liveStream.findMany({
      where: { status: 'LIVE', visibility: 'PUBLIC' },
      include: {
        owner: {
          select: { id: true, username: true, fullName: true, profile: { select: { avatarUrl: true } } },
        },
        _count: { select: { viewers: { where: { isLive: true } } } },
      },
      orderBy: { currentViewerCount: 'desc' },
      skip,
      take: limit,
    }),
    prisma.liveStream.count({ where: { status: 'LIVE', visibility: 'PUBLIC' } }),
  ]);
  return { lives, total, page, limit };
}

export async function joinLive(userId, liveId) {
  const live = await prisma.liveStream.findUnique({ where: { id: liveId } });
  if (!live) throw new AppError('Live stream not found', 404);
  if (live.status !== 'LIVE') throw new AppError('Live stream is not active', 400);
  if (live.visibility === 'ONLY_ME' && live.ownerId !== userId) {
    throw new AppError('This live stream is private', 403);
  }

  const banned = await prisma.liveBan.findUnique({
    where: { liveStreamId_userId: { liveStreamId: liveId, userId } },
  });
  if (banned) throw new AppError('You are banned from this live stream', 403);

  if (live.visibility === 'FRIENDS' && live.ownerId !== userId) {
    const friendship = await prisma.friendship.findFirst({
      where: {
        OR: [
          { userOneId: live.ownerId, userTwoId: userId },
          { userOneId: userId, userTwoId: live.ownerId },
        ],
      },
    });
    if (!friendship) throw new AppError('This live stream is for friends only', 403);
  }

  const viewer = await prisma.liveViewer.upsert({
    where: { liveStreamId_userId: { liveStreamId: liveId, userId } },
    update: { isLive: true, leftAt: null },
    create: { liveStreamId: liveId, userId },
  });

  const updated = await prisma.liveStream.update({
    where: { id: liveId },
    data: {
      currentViewerCount: { increment: 1 },
    },
  });

  await prisma.liveStream.update({
    where: { id: liveId },
    data: {
      peakViewerCount: Math.max(updated.peakViewerCount, updated.currentViewerCount),
    },
  });

  return viewer;
}

export async function leaveLive(userId, liveId) {
  await prisma.liveViewer.updateMany({
    where: { liveStreamId: liveId, userId, isLive: true },
    data: { isLive: false, leftAt: new Date() },
  });

  await prisma.liveStream.update({
    where: { id: liveId },
    data: { currentViewerCount: { decrement: 1 } },
  });
}

export async function addComment(userId, liveId, content) {
  const live = await prisma.liveStream.findUnique({ where: { id: liveId } });
  if (!live) throw new AppError('Live stream not found', 404);
  if (live.status !== 'LIVE') throw new AppError('Live stream is not active', 400);

  const banned = await prisma.liveBan.findUnique({
    where: { liveStreamId_userId: { liveStreamId: liveId, userId } },
  });
  if (banned) throw new AppError('You are banned from this live stream', 403);

  const comment = await prisma.liveComment.create({
    data: {
      liveStreamId: liveId,
      userId,
      content: content.trim().slice(0, 500),
    },
    include: {
      user: { select: { id: true, username: true, fullName: true, profile: { select: { avatarUrl: true } } } },
    },
  });

  await prisma.liveStream.update({
    where: { id: liveId },
    data: { totalComments: { increment: 1 } },
  });

  return comment;
}

export async function deleteComment(userId, liveId, commentId) {
  const live = await prisma.liveStream.findUnique({ where: { id: liveId } });
  if (!live) throw new AppError('Live stream not found', 404);

  const comment = await prisma.liveComment.findUnique({ where: { id: commentId } });
  if (!comment) throw new AppError('Comment not found', 404);
  if (comment.liveStreamId !== liveId) throw new AppError('Comment does not belong to this live', 400);

  const isOwner = live.ownerId === userId;
  const isCommenter = comment.userId === userId;
  if (!isOwner && !isCommenter) throw new AppError('Not authorized', 403);

  await prisma.liveComment.delete({ where: { id: commentId } });
}

export async function moderateComment(userId, liveId, commentId) {
  const live = await prisma.liveStream.findUnique({ where: { id: liveId } });
  if (!live) throw new AppError('Live stream not found', 404);
  if (live.ownerId !== userId) throw new AppError('Not authorized', 403);

  const comment = await prisma.liveComment.findUnique({ where: { id: commentId } });
  if (!comment || comment.liveStreamId !== liveId) throw new AppError('Comment not found', 404);

  return prisma.liveComment.update({
    where: { id: commentId },
    data: { isHidden: true },
  });
}

export async function banUser(userId, liveId, targetUserId) {
  const live = await prisma.liveStream.findUnique({ where: { id: liveId } });
  if (!live) throw new AppError('Live stream not found', 404);
  if (live.ownerId !== userId) throw new AppError('Not authorized', 403);
  if (targetUserId === userId) throw new AppError('Cannot ban yourself', 400);

  await prisma.liveBan.upsert({
    where: { liveStreamId_userId: { liveStreamId: liveId, userId: targetUserId } },
    update: {},
    create: { liveStreamId: liveId, userId: targetUserId, bannedById: userId },
  });

  await prisma.liveViewer.updateMany({
    where: { liveStreamId: liveId, userId: targetUserId, isLive: true },
    data: { isLive: false, leftAt: new Date() },
  });

  await prisma.liveStream.update({
    where: { id: liveId },
    data: { currentViewerCount: { decrement: 1 } },
  });

  return { success: true };
}

export async function unbanUser(userId, liveId, targetUserId) {
  const live = await prisma.liveStream.findUnique({ where: { id: liveId } });
  if (!live) throw new AppError('Live stream not found', 404);
  if (live.ownerId !== userId) throw new AppError('Not authorized', 403);

  await prisma.liveBan.deleteMany({
    where: { liveStreamId: liveId, userId: targetUserId },
  });

  return { success: true };
}

export async function reportLive(userId, liveId, reason) {
  const live = await prisma.liveStream.findUnique({ where: { id: liveId } });
  if (!live) throw new AppError('Live stream not found', 404);
  if (live.ownerId === userId) throw new AppError('Cannot report your own live', 400);

  const existing = await prisma.liveReport.findFirst({
    where: { liveStreamId: liveId, reporterId: userId, resolved: false },
  });
  if (existing) throw new AppError('You already reported this live stream', 409);

  return prisma.liveReport.create({
    data: { liveStreamId: liveId, reporterId: userId, reason: reason.trim().slice(0, 500) },
  });
}

export async function getViewerList(liveId) {
  return prisma.liveViewer.findMany({
    where: { liveStreamId: liveId, isLive: true },
    include: {
      user: { select: { id: true, username: true, fullName: true, profile: { select: { avatarUrl: true } } } },
    },
    orderBy: { joinedAt: 'asc' },
  });
}

export async function getActiveLiveByOwner(userId) {
  return prisma.liveStream.findFirst({
    where: { ownerId: userId, status: { in: ['CREATED', 'STARTING', 'LIVE'] } },
    include: {
      owner: {
        select: { id: true, username: true, fullName: true, profile: { select: { avatarUrl: true } } },
      },
    },
  });
}
