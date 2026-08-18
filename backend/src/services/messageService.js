import prisma from '../config/database.js';
import AppError from '../utils/AppError.js';
import { areBlocked } from '../utils/authorization.js';

const userBrief = {
  id: true,
  username: true,
  fullName: true,
  profile: { select: { avatarUrl: true } },
};

// Only server-generated /uploads/... media paths may be attached to a message.
const MEDIA_URL_RE = /^\/uploads\/[\d]+-[A-Za-z0-9_-]+\.(jpg|jpeg|png|gif|webp|heic|mp4|webm|mov|avi)$/;

export async function getDirectConversation(userOneId, userTwoId) {
  let conversation = await prisma.conversation.findFirst({
    where: {
      isGroup: false,
      AND: [{ participants: { some: { userId: userOneId } } }, { participants: { some: { userId: userTwoId } } }],
    },
    include: { participants: { include: { user: { select: userBrief } } } },
  });

  if (conversation) return conversation;

  conversation = await prisma.conversation.create({
    data: {
      createdById: userOneId,
      isGroup: false,
      participants: {
        create: [
          { userId: userOneId, lastReadAt: new Date() },
          { userId: userTwoId },
        ],
      },
    },
    include: { participants: { include: { user: { select: userBrief } } } },
  });
  return conversation;
}

export async function listConversations(userId) {
  const conversations = await prisma.conversation.findMany({
    where: { participants: { some: { userId } } },
    orderBy: { updatedAt: 'desc' },
    include: {
      participants: { include: { user: { select: userBrief } } },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: { readBy: { select: { userId: true } } },
      },
    },
  });

  const items = await Promise.all(conversations.map(async (c) => {
    const lastMessage = c.messages[0] || null;
    const currentParticipant = c.participants.find((p) => p.userId === userId);
    const lastReadAt = currentParticipant?.lastReadAt || new Date(0);

    const unreadCount = currentParticipant
      ? await prisma.message.count({
          where: {
            conversationId: c.id,
            senderId: { not: userId },
            isDeleted: false,
            createdAt: { gt: lastReadAt },
          },
        })
      : 0;

    const otherParticipants = c.participants.filter((p) => p.userId !== userId);
    return {
      id: c.id,
      isGroup: c.isGroup,
      title: c.title || otherParticipants.map((p) => p.user.fullName).join(', '),
      otherUser: c.isGroup ? null : otherParticipants[0]?.user || null,
      lastMessage: lastMessage ? { content: lastMessage.content, createdAt: lastMessage.createdAt, senderId: lastMessage.senderId } : null,
      unreadCount,
      updatedAt: c.updatedAt,
    };
  }));

  return items;
}

export async function listMessages(conversationId, userId, { page = 1, limit = 30 } = {}) {
  const participant = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
  });
  if (!participant) throw new AppError('Conversation not found', 404);

  const skip = (page - 1) * limit;
  const messages = await prisma.message.findMany({
    where: { conversationId, isDeleted: false },
    orderBy: { createdAt: 'desc' },
    skip,
    take: limit,
    include: {
      sender: { select: userBrief },
      readBy: { select: { userId: true, readAt: true } },
    },
  });

  // Mark messages as read
  const lastMessageId = messages[0]?.id;
  if (lastMessageId) {
    const newMessages = messages.filter((m) => m.senderId !== userId && !m.readBy.some((r) => r.userId === userId));
    if (newMessages.length > 0) {
      await prisma.messageRead.createMany({
        data: newMessages.map((m) => ({ messageId: m.id, userId })),
        skipDuplicates: true,
      });
    }
    await prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { lastReadAt: new Date() },
    });
  }

  return messages.reverse();
}

export async function sendMessage(conversationId, userId, { content, mediaUrl, mediaType }) {
  const participant = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
  });
  if (!participant) throw new AppError('Conversation not found', 404);

  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, isGroup: false },
    select: { participants: { where: { userId: { not: userId } }, select: { userId: true } } },
  });
  const otherId = conversation?.participants[0]?.userId;
  if (otherId && (await areBlocked(userId, otherId))) {
    throw new AppError('You cannot message this user', 403);
  }

  const safeMediaUrl = mediaUrl && typeof mediaUrl === 'string' && MEDIA_URL_RE.test(mediaUrl) ? mediaUrl : null;
  const safeMediaType = safeMediaUrl && (mediaType === 'IMAGE' || mediaType === 'VIDEO') ? mediaType : null;

  const message = await prisma.message.create({
    data: { conversationId, senderId: userId, content: content || '', mediaUrl: safeMediaUrl, mediaType: safeMediaType },
    include: { sender: { select: userBrief } },
  });

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });

  return message;
}

export async function countUnread(userId) {
  const convos = await prisma.conversation.findMany({
    where: { participants: { some: { userId } } },
    select: {
      id: true,
      participants: { where: { userId }, select: { lastReadAt: true } },
    },
  });
  if (convos.length === 0) return 0;

  const lastReadByConversation = new Map(convos.map((c) => [c.id, c.participants[0]?.lastReadAt || new Date(0)]));

  const messages = await prisma.message.findMany({
    where: {
      conversationId: { in: [...lastReadByConversation.keys()] },
      senderId: { not: userId },
      isDeleted: false,
    },
    select: { conversationId: true, createdAt: true },
  });

  let total = 0;
  for (const m of messages) {
    if (m.createdAt > lastReadByConversation.get(m.conversationId)) total += 1;
  }
  return total;
}