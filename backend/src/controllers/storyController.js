import asyncHandler from '../utils/asyncHandler.js';
import AppError from '../utils/AppError.js';
import prisma from '../config/database.js';
import { inferMediaType } from '../middleware/uploadMiddleware.js';
import { hiddenUserIds, isFriends, areBlocked } from '../utils/authorization.js';
import { deleteFile } from '../utils/helpers.js';

const STORY_TTL_HOURS = 24;

export const getStories = asyncHandler(async (req, res) => {
  const now = new Date();

  const myFriends = await prisma.friendship.findMany({
    where: { OR: [{ userOneId: req.user.id }, { userTwoId: req.user.id }] },
    select: { userOneId: true, userTwoId: true },
  });
  const hidden = new Set(await hiddenUserIds(req.user.id));
  const friendIds = new Set(myFriends.flatMap((f) => [f.userOneId, f.userTwoId]));
  friendIds.add(req.user.id);
  hidden.forEach((id) => friendIds.delete(id));

  const stories = await prisma.story.findMany({
    where: {
      userId: { in: [...friendIds] },
      expiresAt: { gt: now },
    },
    include: {
      user: { select: { id: true, username: true, fullName: true, profile: { select: { avatarUrl: true } } } },
      views: { select: { viewerId: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  // group by user
  const groups = new Map();
  for (const story of stories) {
    if (!groups.has(story.user.id)) {
      groups.set(story.user.id, { user: story.user, stories: [], allViewed: true });
    }
    const viewed = story.views.some((v) => v.viewerId === req.user.id);
    if (!viewed) groups.get(story.user.id).allViewed = false;
    groups.get(story.user.id).stories.push(story);
  }

  const result = [...groups.values()];
  // my stories first if I have any
  result.sort((a, b) => (a.user.id === req.user.id ? -1 : b.user.id === req.user.id ? 1 : b.stories[0].createdAt - a.stories[0].createdAt));

  res.json({ success: true, groups: result });
});

export const createStory = asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError('Story media is required', 400);

  const story = await prisma.story.create({
    data: {
      userId: req.user.id,
      mediaType: inferMediaType(req.file.filename, req.file.mimetype),
      url: `/uploads/${req.file.filename}`,
      caption: req.body.caption || null,
      expiresAt: new Date(Date.now() + STORY_TTL_HOURS * 60 * 60 * 1000),
    },
    include: {
      user: { select: { id: true, username: true, fullName: true, profile: { select: { avatarUrl: true } } } },
    },
  });

  res.status(201).json({ success: true, story });
});

export const viewStory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const story = await prisma.story.findUnique({ where: { id } });
  if (!story) throw new AppError('Story not found', 404);

  // Only friends (or the author) can view, and only while the story is live
  if (story.userId !== req.user.id) {
    if (story.expiresAt <= new Date()) throw new AppError('Story not found', 404);
    if (await areBlocked(req.user.id, story.userId)) throw new AppError('Story not found', 404);
    if (!(await isFriends(req.user.id, story.userId))) throw new AppError('Story not found', 404);
  }

  await prisma.storyView.upsert({
    where: { storyId_viewerId: { storyId: id, viewerId: req.user.id } },
    create: { storyId: id, viewerId: req.user.id },
    update: {},
  });

  res.json({ success: true });
});

export const deleteStory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const story = await prisma.story.findUnique({ where: { id } });
  if (!story) throw new AppError('Story not found', 404);
  if (story.userId !== req.user.id) throw new AppError('Not authorized', 403);
  await prisma.story.delete({ where: { id } });
  deleteFile(story.url);
  res.json({ success: true });
});

export const getStoryViewers = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const story = await prisma.story.findUnique({ where: { id } });
  if (!story) throw new AppError('Story not found', 404);
  if (story.userId !== req.user.id) throw new AppError('Not authorized', 403);

  const views = await prisma.storyView.findMany({
    where: { storyId: id },
    include: { viewer: { select: { id: true, username: true, fullName: true, profile: { select: { avatarUrl: true } } } } },
    orderBy: { viewedAt: 'desc' },
  });
  res.json({ success: true, views });
});