import asyncHandler from '../utils/asyncHandler.js';
import prisma from '../config/database.js';
import { hiddenUserIds } from '../utils/authorization.js';

export const searchAll = asyncHandler(async (req, res) => {
  const { q } = req.query;
  if (!q || !q.trim()) {
    return res.json({ success: true, users: [], posts: [], groups: [], events: [] });
  }
  const term = q.trim();
  const hidden = await hiddenUserIds(req.user.id);

  const [users, posts, groups, events] = await Promise.all([
    prisma.user.findMany({
      where: {
        OR: [
          { username: { contains: term, mode: 'insensitive' } },
          { fullName: { contains: term, mode: 'insensitive' } },
        ],
        isActive: true,
        id: { notIn: hidden },
      },
      take: 8,
      select: {
        id: true,
        username: true,
        fullName: true,
        isVerified: true,
        profile: { select: { avatarUrl: true } },
      },
    }),
    prisma.post.findMany({
      where: {
        content: { contains: term, mode: 'insensitive' },
        isArchived: false,
        authorId: { notIn: hidden },
        OR: [{ privacy: 'PUBLIC' }, { authorId: req.user.id }],
      },
      take: 8,
      orderBy: { createdAt: 'desc' },
      include: {
        author: { select: { id: true, username: true, fullName: true, profile: { select: { avatarUrl: true } } } },
        media: true,
        _count: { select: { reactions: true, comments: true, shares: true } },
      },
    }),
    prisma.group.findMany({
      where: {
        name: { contains: term, mode: 'insensitive' },
        ownerId: { notIn: hidden },
        OR: [{ privacy: 'PUBLIC' }, { ownerId: req.user.id }, { members: { some: { userId: req.user.id } } }],
      },
      take: 8,
      include: { _count: { select: { members: true } } },
    }),
    prisma.event.findMany({
      where: {
        name: { contains: term, mode: 'insensitive' },
        organizerId: { notIn: hidden },
        OR: [{ privacy: 'PUBLIC' }, { organizerId: req.user.id }, { members: { some: { userId: req.user.id } } }],
      },
      take: 8,
    }),
  ]);

  res.json({ success: true, users, posts, groups, events });
});

export const getSearchHistory = asyncHandler(async (req, res) => {
  const history = await prisma.searchHistory.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });
  res.json({ success: true, history });
});

export const addSearchHistory = asyncHandler(async (req, res) => {
  const { query } = req.body;
  const term = (query || '').trim().slice(0, 100);
  if (!term) return res.status(400).json({ success: false, message: 'Search query is required' });

  const entry = await prisma.searchHistory.upsert({
    where: { userId_query: { userId: req.user.id, query: term } },
    create: { userId: req.user.id, query: term },
    update: { createdAt: new Date() },
  });
  res.status(201).json({ success: true, entry });
});

export const clearSearchHistory = asyncHandler(async (req, res) => {
  await prisma.searchHistory.deleteMany({ where: { userId: req.user.id } });
  res.json({ success: true });
});

export const deleteSearchHistory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await prisma.searchHistory.deleteMany({ where: { id, userId: req.user.id } });
  res.json({ success: true });
});

export const getTrendingTopics = asyncHandler(async (req, res) => {
  const rows = await prisma.searchHistory.groupBy({
    by: ['query'],
    _count: { query: true },
    orderBy: { _count: { query: 'desc' } },
    take: 5,
  });
  res.json({ success: true, trending: rows.map((r) => r.query) });
});