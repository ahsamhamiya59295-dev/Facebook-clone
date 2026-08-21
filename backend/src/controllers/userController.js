import asyncHandler from '../utils/asyncHandler.js';
import AppError from '../utils/AppError.js';
import {
  getUserById,
  updateProfile,
  updateAvatar,
  updateCover,
  removeAvatar,
  removeCover,
  getFriendRelation,
  getFriends,
  getFollowers,
  getFollowing,
  getFriendRequests,
  getSuggestions,
  getUserByUsername,
} from '../services/userService.js';
import { listUserPosts } from '../services/postService.js';
import prisma from '../config/database.js';
import { createNotification } from '../services/notificationService.js';
import { areBlocked } from '../utils/authorization.js';

const userBriefSelect = {
  id: true,
  username: true,
  fullName: true,
  profile: { select: { avatarUrl: true } },
};

export const getUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const result = await getUserById(id, req.user.id);
  if (!result?.user) throw new AppError('User not found', 404);

  return res.json({ success: true, user: result.user, relation: result.relation });
});

export const getUserByUsernameHandler = asyncHandler(async (req, res) => {
  const { username } = req.params;
  const result = await getUserByUsername(username, req.user.id);
  if (!result?.user) throw new AppError('User not found', 404);

  const [friendsCount, followersCount, followingCount, postsCount] = await Promise.all([
    prisma.friendship.count({
      where: { OR: [{ userOneId: result.user.id }, { userTwoId: result.user.id }] },
    }),
    prisma.follow.count({ where: { followingId: result.user.id } }),
    prisma.follow.count({ where: { followerId: result.user.id } }),
    prisma.post.count({ where: { authorId: result.user.id, isArchived: false } }),
  ]);

  const userWithCount = {
    ...result.user,
    _count: {
      posts: postsCount,
      friends: friendsCount,
      followers: followersCount,
      following: followingCount,
    },
  };

  return res.json({ success: true, user: userWithCount, relation: result.relation });
});

export const updateMe = asyncHandler(async (req, res) => {
  const user = await updateProfile(req.user.id, req.body);
  res.json({ success: true, user });
});

export const uploadAvatar = asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError('No file uploaded', 400);
  const user = await updateAvatar(req.user.id, req.file.filename);
  res.json({ success: true, user, avatarUrl: `/uploads/${req.file.filename}` });
});

export const uploadCover = asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError('No file uploaded', 400);
  const user = await updateCover(req.user.id, req.file.filename);
  res.json({ success: true, user, coverUrl: `/uploads/${req.file.filename}` });
});

export const removeAvatarHandler = asyncHandler(async (req, res) => {
  const user = await removeAvatar(req.user.id);
  res.json({ success: true, user, avatarUrl: null });
});

export const removeCoverHandler = asyncHandler(async (req, res) => {
  const user = await removeCover(req.user.id);
  res.json({ success: true, user, coverUrl: null });
});

export const getUserPosts = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const page = parseInt(req.query.page, 10) || 1;
  const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);
  const data = await listUserPosts(id, req.user.id, { page, limit });
  res.json({ success: true, ...data });
});

export const getFriendsHandler = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (id === req.user.id) {
    const friends = await getFriends(id);
    return res.json({ success: true, friends });
  }
  const relation = await getFriendRelation(req.user.id, id);
  if (relation !== 'FRIENDS') {
    return res.json({ success: true, friends: [] });
  }
  const friends = await getFriends(id);
  return res.json({ success: true, friends });
});

export const getFollowersHandler = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (await areBlocked(req.user.id, id)) {
    return res.json({ success: true, followers: [] });
  }
  const followers = await getFollowers(id);
  res.json({ success: true, followers });
});

export const getFollowingHandler = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (await areBlocked(req.user.id, id)) {
    return res.json({ success: true, following: [] });
  }
  const following = await getFollowing(id);
  res.json({ success: true, following });
});

export const getFriendRequestsHandler = asyncHandler(async (req, res) => {
  const requests = await getFriendRequests(req.user.id);
  res.json({ success: true, requests });
});

export const getSuggestionsHandler = asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 6, 20);
  const suggestions = await getSuggestions(req.user.id, limit);
  res.json({ success: true, users: suggestions });
});

export const getMutualFriends = asyncHandler(async (req, res) => {
  if (await areBlocked(req.user.id, req.params.id)) {
    return res.json({ success: true, users: [], count: 0 });
  }

  const myFriends = await prisma.friendship.findMany({
    where: { OR: [{ userOneId: req.user.id }, { userTwoId: req.user.id }] },
    select: { userOneId: true, userTwoId: true },
  });
  const mySet = new Set(myFriends.flatMap((f) => [f.userOneId, f.userTwoId]));
  mySet.delete(req.user.id);

  const targetFriends = await prisma.friendship.findMany({
    where: { OR: [{ userOneId: req.params.id }, { userTwoId: req.params.id }] },
    select: { userOneId: true, userTwoId: true },
  });
  const targetSet = new Set(targetFriends.flatMap((f) => [f.userOneId, f.userTwoId]));
  targetSet.delete(req.params.id);

  const mutualIds = [...mySet].filter((id) => targetSet.has(id));

  const users = await prisma.user.findMany({
    where: { id: { in: mutualIds } },
    select: userBriefSelect,
  });

  res.json({ success: true, users, count: users.length });
});

export const toggleFollow = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (id === req.user.id) throw new AppError('You cannot follow yourself', 400);

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) throw new AppError('User not found', 404);
  if (await areBlocked(req.user.id, id)) throw new AppError('Action not allowed', 403);

  const existing = await prisma.follow.findUnique({
    where: { followerId_followingId: { followerId: req.user.id, followingId: id } },
  });

  if (existing) {
    await prisma.follow.delete({ where: { id: existing.id } });
    return res.json({ success: true, following: false });
  }

  await prisma.follow.create({
    data: { followerId: req.user.id, followingId: id },
  });
  await createNotification({
    recipientId: id,
    actorId: req.user.id,
    type: 'FOLLOW',
    message: `${req.user.fullName} started following you`,
  });
  return res.json({ success: true, following: true });
});