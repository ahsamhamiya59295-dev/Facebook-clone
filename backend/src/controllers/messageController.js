import asyncHandler from '../utils/asyncHandler.js';
import AppError from '../utils/AppError.js';
import {
  getDirectConversation,
  listConversations,
  listMessages,
  sendMessage,
  countUnread,
} from '../services/messageService.js';
import prisma from '../config/database.js';
import { createNotification } from '../services/notificationService.js';
import { inferMediaType } from '../middleware/uploadMiddleware.js';

import { areBlocked } from '../utils/authorization.js';

export const getConversations = asyncHandler(async (req, res) => {
  const conversations = await listConversations(req.user.id);
  const unread = await countUnread(req.user.id);
  res.json({ success: true, conversations, unread });
});

export const createConversation = asyncHandler(async (req, res) => {
  const { userId } = req.body;
  if (!userId) throw new AppError('userId is required', 400);
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) throw new AppError('User not found', 404);
  if (userId === req.user.id) throw new AppError('You cannot message yourself', 400);
  if (await areBlocked(req.user.id, userId)) throw new AppError('You cannot message this user', 403);

  const conversation = await getDirectConversation(req.user.id, userId);
  res.status(201).json({ success: true, conversation });
});

export const getMessages = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = Math.min(parseInt(req.query.limit, 10) || 30, 100);
  const messages = await listMessages(req.params.id, req.user.id, { page, limit });
  res.json({ success: true, messages });
});

export const postMessage = asyncHandler(async (req, res) => {
  const { content } = req.body;
  const media = req.file
    ? { mediaUrl: `/uploads/${req.file.filename}`, mediaType: inferMediaType(req.file.filename, req.file.mimetype) }
    : {};

  if (!content && !media.mediaUrl) throw new AppError('Message content is required', 400);

  const message = await sendMessage(req.params.id, req.user.id, { content: content || '', ...media });

  const participants = await prisma.conversationParticipant.findMany({
    where: { conversationId: req.params.id },
    select: { userId: true },
  });
  for (const p of participants) {
    if (p.userId !== req.user.id) {
      await createNotification({
        recipientId: p.userId,
        actorId: req.user.id,
        type: 'MESSAGE',
        message: `${req.user.fullName} sent you a message`,
      });
    }
  }

  res.status(201).json({ success: true, message });
});

export const markConversationRead = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await prisma.conversationParticipant.updateMany({
    where: { conversationId: id, userId: req.user.id },
    data: { lastReadAt: new Date() },
  });
  res.json({ success: true });
});