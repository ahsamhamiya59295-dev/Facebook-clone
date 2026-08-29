import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import prisma from '../config/database.js';
import AppError from '../utils/AppError.js';
import { sendMessage } from '../services/messageService.js';

const connectedUsers = new Map(); // userId -> Set<socketId> (multi-tab aware)

const RATE_LIMIT_WINDOW_MS = 10000;
const RATE_LIMIT_MAX = 20;

function extractCookieToken(cookieHeader, name) {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

async function isParticipant(conversationId, userId) {
  const participant = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
  });
  return Boolean(participant);
}

export function registerSocket(io) {
  io.use(async (socket, next) => {
    const cookieHeader = socket.handshake.headers?.cookie || '';
    const token = socket.handshake.auth?.token || extractCookieToken(cookieHeader, env.cookieName);

    if (!token) return next(new Error('No token provided'));

    try {
      const decoded = jwt.verify(token, env.jwtSecret);
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: { id: true, isActive: true, tokenVersion: true },
      });
      if (!user || !user.isActive) return next(new Error('User no longer exists'));
      // Token revocation: any token signed before a password change is rejected.
      if (decoded.ver !== undefined && decoded.ver !== user.tokenVersion) {
        return next(new Error('Session expired, please log in again'));
      }
      socket.userId = user.id;
      socket.join(`user:${user.id}`);
      return next();
    } catch (err) {
      return next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.userId;
    const key = userId.toString();

    if (!connectedUsers.has(key)) connectedUsers.set(key, new Set());
    connectedUsers.get(key).add(socket.id);

    let hits = [];
    const hitLimit = () => {
      const now = Date.now();
      hits = hits.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
      if (hits.length >= RATE_LIMIT_MAX) return true;
      hits.push(now);
      return false;
    };

    socket.broadcast.emit('user:online', { userId });

    socket.on('message:send', async (data) => {
      try {
        if (hitLimit()) return socket.emit('message:error', { error: 'Too many requests, slow down.' });

        const conversationId = data?.conversationId;
        if (!conversationId || typeof conversationId !== 'string') {
          return socket.emit('message:error', { error: 'Invalid conversation' });
        }

        const content = typeof data.content === 'string' ? data.content.trim().slice(0, 5000) : '';
        const message = await sendMessage(conversationId, userId, {
          content,
          mediaUrl: typeof data.mediaUrl === 'string' ? data.mediaUrl : null,
          mediaType: typeof data.mediaType === 'string' ? data.mediaType : null,
        });

        const participants = await prisma.conversationParticipant.findMany({
          where: { conversationId },
          select: { userId: true },
        });

        participants.forEach((p) => {
          io.to(`user:${p.userId}`).emit('message:new', { message });
        });
      } catch (err) {
        const msg = err instanceof AppError ? err.message : 'Failed to send message';
        socket.emit('message:error', { error: msg });
      }
    });

    socket.on('typing', async (data) => {
      try {
        if (hitLimit()) return;

        const conversationId = data?.conversationId;
        if (!conversationId || typeof conversationId !== 'string') return;
        if (!(await isParticipant(conversationId, userId))) return;

        const participants = await prisma.conversationParticipant.findMany({
          where: { conversationId },
          select: { userId: true },
        });
        participants.forEach((p) => {
          if (p.userId !== userId) {
            io.to(`user:${p.userId}`).emit('typing', { userId, conversationId });
          }
        });
      } catch {
        // silent
      }
    });

    socket.on('read', async (data) => {
      try {
        if (hitLimit()) return;

        const conversationId = data?.conversationId;
        if (!conversationId || typeof conversationId !== 'string') return;
        if (!(await isParticipant(conversationId, userId))) return;

        await prisma.conversationParticipant.updateMany({
          where: { conversationId, userId },
          data: { lastReadAt: new Date() },
        });

        const participants = await prisma.conversationParticipant.findMany({
          where: { conversationId },
          select: { userId: true },
        });
        participants.forEach((p) => {
          if (p.userId !== userId) {
            io.to(`user:${p.userId}`).emit('read:update', { conversationId, userId, readAt: new Date() });
          }
        });
      } catch {
        // silent
      }
    });

    socket.on('disconnect', () => {
      // Clean up live rooms
      for (const room of socket.rooms) {
        if (room.startsWith('live:')) {
          socket.leave(room);
        }
      }

      const set = connectedUsers.get(key);
      if (set) {
        set.delete(socket.id);
        if (set.size === 0) {
          connectedUsers.delete(key);
          socket.broadcast.emit('user:offline', { userId });
        }
      }
    });

    // ===== LIVE STREAMING EVENTS =====

    socket.on('live:join', async (data) => {
      try {
        if (hitLimit()) return;
        const { liveId } = data || {};
        if (!liveId || typeof liveId !== 'string') return;

        const live = await prisma.liveStream.findUnique({ where: { id: liveId } });
        if (!live || live.status !== 'LIVE') return;

        const banned = await prisma.liveBan.findUnique({
          where: { liveStreamId_userId: { liveStreamId: liveId, userId } },
        });
        if (banned) return socket.emit('live:error', { error: 'You are banned from this live stream' });

        socket.join(`live:${liveId}`);
        socket.liveRoom = liveId;

        io.to(`live:${liveId}`).emit('live:viewer-joined', {
          userId,
          viewerCount: await prisma.liveViewer.count({ where: { liveStreamId: liveId, isLive: true } }),
        });
      } catch {
        socket.emit('live:error', { error: 'Failed to join live stream' });
      }
    });

    socket.on('live:leave', async (data) => {
      try {
        const { liveId } = data || {};
        if (!liveId) return;
        socket.leave(`live:${liveId}`);
        socket.liveRoom = null;
      } catch {
        // silent
      }
    });

    socket.on('live:comment', async (data) => {
      try {
        if (hitLimit()) return;
        const { liveId, content } = data || {};
        if (!liveId || typeof content !== 'string' || !content.trim()) return;

        const live = await prisma.liveStream.findUnique({ where: { id: liveId } });
        if (!live || live.status !== 'LIVE') return;

        const banned = await prisma.liveBan.findUnique({
          where: { liveStreamId_userId: { liveStreamId: liveId, userId } },
        });
        if (banned) return socket.emit('live:error', { error: 'You are banned from this live stream' });

        const trimmed = content.trim().slice(0, 500);
        const comment = await prisma.liveComment.create({
          data: { liveStreamId: liveId, userId, content: trimmed },
          include: { user: { select: { id: true, username: true, fullName: true, profile: { select: { avatarUrl: true } } } } },
        });

        await prisma.liveStream.update({
          where: { id: liveId },
          data: { totalComments: { increment: 1 } },
        });

        io.to(`live:${liveId}`).emit('live:new-comment', { comment });
      } catch {
        socket.emit('live:error', { error: 'Failed to send comment' });
      }
    });

    socket.on('live:reaction', async (data) => {
      try {
        if (hitLimit()) return;
        const { liveId, emoji } = data || {};
        if (!liveId || typeof emoji !== 'string') return;

        const validEmojis = ['👍', '❤️', '😂', '😮', '😢', '😡'];
        if (!validEmojis.includes(emoji)) return;

        io.to(`live:${liveId}`).emit('live:new-reaction', { userId, emoji });
      } catch {
        // silent
      }
    });

    socket.on('live:signal', async (data) => {
      try {
        if (hitLimit()) return;
        const { liveId, targetUserId, type, payload } = data || {};
        if (!liveId || !targetUserId || !type || !payload) return;

        const live = await prisma.liveStream.findUnique({ where: { id: liveId } });
        if (!live) return;

        io.to(`user:${targetUserId}`).emit('live:signal', {
          liveId,
          fromUserId: userId,
          type,
          payload,
        });
      } catch {
        // silent
      }
    });

    socket.on('live:broadcast-end', async (data) => {
      try {
        const { liveId } = data || {};
        if (!liveId) return;

        const live = await prisma.liveStream.findUnique({ where: { id: liveId } });
        if (!live || live.ownerId !== userId) return;

        const now = new Date();
        const duration = live.startedAt ? Math.floor((now - live.startedAt) / 1000) : 0;

        await prisma.liveStream.update({
          where: { id: liveId },
          data: { status: 'ENDED', endedAt: now, duration, currentViewerCount: 0 },
        });

        io.to(`live:${liveId}`).emit('live:ended', { liveId, duration });
      } catch {
        // silent
      }
    });
  });
}

export function isOnline(userId) {
  return connectedUsers.has(userId.toString());
}

export function onlineUsers() {
  return [...connectedUsers.keys()];
}

export default registerSocket;