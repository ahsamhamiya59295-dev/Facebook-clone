import asyncHandler from '../utils/asyncHandler.js';
import {
  listNotifications,
  markRead,
  markAllRead,
} from '../services/notificationService.js';
import prisma from '../config/database.js';

export const getNotifications = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
  const data = await listNotifications(req.user.id, { page, limit });
  res.json({ success: true, ...data });
});

export const markNotificationRead = asyncHandler(async (req, res) => {
  await markRead(req.params.id, req.user.id);
  res.json({ success: true });
});

export const markAllNotificationsRead = asyncHandler(async (req, res) => {
  await markAllRead(req.user.id);
  res.json({ success: true });
});

export const getNotificationSettings = asyncHandler(async (req, res) => {
  const settings = await prisma.notificationSetting.findUnique({
    where: { userId: req.user.id },
  });
  res.json({ success: true, settings });
});

export const updateNotificationSettings = asyncHandler(async (req, res) => {
  const allowed = ['likesEnabled', 'commentsEnabled', 'friendRequestsEnabled', 'followsEnabled', 'messagesEnabled', 'storiesEnabled'];
  const data = {};
  for (const key of allowed) {
    if (typeof req.body[key] === 'boolean') data[key] = req.body[key];
  }
  const settings = await prisma.notificationSetting.update({
    where: { userId: req.user.id },
    data,
  });
  res.json({ success: true, settings });
});