import prisma from '../config/database.js';

export async function createNotification({ recipientId, actorId = null, type, message, entityId = null }) {
  if (!recipientId || (actorId && recipientId === actorId)) return null;

  const settings = await prisma.notificationSetting.findUnique({
    where: { userId: recipientId },
  });

  const settingKeys = {
    LIKE: 'likesEnabled',
    COMMENT: 'commentsEnabled',
    COMMENT_REPLY: 'commentsEnabled',
    FRIEND_REQUEST: 'friendRequestsEnabled',
    FRIEND_ACCEPT: 'friendRequestsEnabled',
    FOLLOW: 'followsEnabled',
    MESSAGE: 'messagesEnabled',
    STORY: 'storiesEnabled',
  };

  const key = settingKeys[type];
  if (key && settings && settings[key] === false) return null;

  return prisma.notification.create({
    data: { recipientId, actorId, type, message, entityId },
  });
}

export async function listNotifications(userId, { page = 1, limit = 20 } = {}) {
  const skip = (page - 1) * limit;
  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where: { recipientId: userId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        actor: {
          select: {
            id: true,
            username: true,
            fullName: true,
            profile: { select: { avatarUrl: true } },
          },
        },
      },
    }),
    prisma.notification.count({ where: { recipientId: userId } }),
  ]);

  const unread = await prisma.notification.count({
    where: { recipientId: userId, isRead: false },
  });

  return { notifications, total, unread, page, limit };
}

export async function markRead(notificationId, userId) {
  return prisma.notification.updateMany({
    where: { id: notificationId, recipientId: userId },
    data: { isRead: true },
  });
}

export async function markAllRead(userId) {
  return prisma.notification.updateMany({
    where: { recipientId: userId, isRead: false },
    data: { isRead: true },
  });
}