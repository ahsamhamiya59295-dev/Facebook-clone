import asyncHandler from '../utils/asyncHandler.js';
import prisma from '../config/database.js';
import { areBlocked, hiddenUserIds } from '../utils/authorization.js';

const groupInclude = {
  owner: { select: { id: true, username: true, fullName: true, profile: { select: { avatarUrl: true } } } },
  members: { select: { userId: true, role: true } },
  _count: { select: { members: true, posts: true } },
};

function groupIdCanView(group, userId) {
  return group.privacy === 'PUBLIC' || group.ownerId === userId || group.members.some((m) => m.userId === userId);
}

export const getGroups = asyncHandler(async (req, res) => {
  const hidden = await hiddenUserIds(req.user.id);
  const groups = await prisma.group.findMany({
    where: {
      ownerId: { notIn: hidden },
      OR: [{ privacy: 'PUBLIC' }, { members: { some: { userId: req.user.id } } }, { ownerId: req.user.id }],
    },
    orderBy: { updatedAt: 'desc' },
    take: 50,
    include: groupInclude,
  });
  // Strip member lists from CLOSED groups the user can't see
  const sanitized = groups.map((g) => {
    if (groupIdCanView(g, req.user.id)) return g;
    const rest = { ...g };
    delete rest.members;
    return rest;
  });
  res.json({ success: true, groups: sanitized });
});

export const getGroupById = asyncHandler(async (req, res) => {
  const group = await prisma.group.findUnique({
    where: { id: req.params.id },
    include: groupInclude,
  });
  if (!group) return res.status(404).json({ success: false, message: 'Group not found' });

  if (await areBlocked(req.user.id, group.ownerId)) {
    return res.status(404).json({ success: false, message: 'Group not found' });
  }

  const isMember = group.members.some((m) => m.userId === req.user.id) || group.ownerId === req.user.id;
  const canView = groupIdCanView(group, req.user.id);

  if (!canView) {
    return res.status(403).json({ success: false, message: 'This is a private group' });
  }

  // CLOSED groups: hide member list from non-members
  const payload = group.privacy === 'CLOSED' && !isMember ? { ...group, members: undefined, _count: undefined } : group;
  res.json({ success: true, group: payload, isMember });
});

export const createGroup = asyncHandler(async (req, res) => {
  const { name, description, privacy } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ success: false, message: 'Group name is required' });

  const group = await prisma.group.create({
    data: {
      name,
      description: description || null,
      privacy: privacy || 'PRIVATE',
      ownerId: req.user.id,
      members: { create: { userId: req.user.id, role: 'ADMIN' } },
    },
    include: groupInclude,
  });
  res.status(201).json({ success: true, group });
});

export const joinGroup = asyncHandler(async (req, res) => {
  const group = await prisma.group.findUnique({ where: { id: req.params.id } });
  if (!group) return res.status(404).json({ success: false, message: 'Group not found' });
  if (await areBlocked(req.user.id, group.ownerId)) {
    return res.status(403).json({ success: false, message: 'Action not allowed' });
  }
  if (group.privacy === 'PRIVATE') {
    return res.status(403).json({ success: false, message: 'Joining a private group requires an invitation' });
  }

  await prisma.groupMember.upsert({
    where: { groupId_userId: { groupId: group.id, userId: req.user.id } },
    create: { groupId: group.id, userId: req.user.id },
    update: {},
  });
  res.json({ success: true });
});

export const leaveGroup = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: id, userId: req.user.id } },
  });
  if (membership && membership.role !== 'ADMIN') {
    await prisma.groupMember.delete({ where: { id: membership.id } });
  }
  res.json({ success: true });
});

export const getGroupPosts = asyncHandler(async (req, res) => {
  const [group, membership] = await Promise.all([
    prisma.group.findUnique({ where: { id: req.params.id } }),
    prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: req.params.id, userId: req.user.id } },
    }),
  ]);
  if (!group) return res.status(404).json({ success: false, message: 'Group not found' });
  if (await areBlocked(req.user.id, group.ownerId)) {
    return res.status(404).json({ success: false, message: 'Group not found' });
  }
  const canView = group.privacy === 'PUBLIC' || group.ownerId === req.user.id || Boolean(membership);
  if (!canView) return res.status(403).json({ success: false, message: 'You must join this group to see its posts' });

  const posts = await prisma.groupPost.findMany({
    where: { groupId: req.params.id },
    orderBy: { createdAt: 'desc' },
    include: {
      author: { select: { id: true, username: true, fullName: true, profile: { select: { avatarUrl: true } } } },
    },
  });
  res.json({ success: true, posts });
});

export const createGroupPost = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const [membership, group] = await Promise.all([
    prisma.groupMember.findUnique({ where: { groupId_userId: { groupId: id, userId: req.user.id } } }),
    prisma.group.findUnique({ where: { id } }),
  ]);
  if (!group) return res.status(404).json({ success: false, message: 'Group not found' });
  if (!membership && group.ownerId !== req.user.id) {
    return res.status(403).json({ success: false, message: 'You must join the group first' });
  }

  const media = req.file ? { mediaUrl: `/uploads/${req.file.filename}` } : {};

  const post = await prisma.groupPost.create({
    data: {
      groupId: id,
      authorId: req.user.id,
      content: req.body.content || null,
      ...media,
    },
    include: {
      author: { select: { id: true, username: true, fullName: true, profile: { select: { avatarUrl: true } } } },
    },
  });
  res.status(201).json({ success: true, post });
});