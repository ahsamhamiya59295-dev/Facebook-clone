import asyncHandler from '../utils/asyncHandler.js';
import prisma from '../config/database.js';

const adminUserSelect = {
  id: true,
  username: true,
  email: true,
  fullName: true,
  role: true,
  isActive: true,
  isVerified: true,
  isEmailVerified: true,
  lastLoginAt: true,
  createdAt: true,
  _count: { select: { posts: true, comments: true } },
};

export const getDashboard = asyncHandler(async (req, res) => {
  const [users, posts, comments, groups, events, listings, reports, stories] = await Promise.all([
    prisma.user.count(),
    prisma.post.count(),
    prisma.comment.count(),
    prisma.group.count(),
    prisma.event.count(),
    prisma.marketplaceListing.count(),
    prisma.report.count({ where: { resolved: false } }),
    prisma.story.count(),
  ]);
  res.json({
    success: true,
    stats: { users, posts, comments, groups, events, listings, openReports: reports, stories },
  });
});

export const listUsers = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';

  const where = q
    ? {
        OR: [
          { username: { contains: q, mode: 'insensitive' } },
          { fullName: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
        ],
      }
    : {};

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: adminUserSelect,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);

  res.json({ success: true, users, total, page, hasMore: (page - 1) * limit + users.length < total });
});

export const toggleUserStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (id === req.user.id) return res.status(400).json({ success: false, message: 'You cannot deactivate your own account' });

  const user = await prisma.user.findUnique({ where: { id }, select: { id: true, isActive: true } });
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });

  const updated = await prisma.user.update({
    where: { id },
    data: { isActive: !user.isActive },
  });
  res.json({ success: true, isActive: updated.isActive });
});

export const setUserRole = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;
  if (!['USER', 'ADMIN'].includes(role)) {
    return res.status(400).json({ success: false, message: 'Invalid role' });
  }
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });
  if (id === req.user.id) return res.status(400).json({ success: false, message: 'You cannot change your own role' });

  const updated = await prisma.user.update({ where: { id }, data: { role }, select: { id: true, role: true } });
  res.json({ success: true, role: updated.role });
});

export const deleteUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (id === req.user.id) return res.status(400).json({ success: false, message: 'You cannot delete your own account' });

  const user = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });

  await prisma.user.delete({ where: { id } });
  res.json({ success: true });
});

export const listReports = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);

  const [reports, total] = await Promise.all([
    prisma.report.findMany({
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: { reporter: { select: { id: true, username: true, fullName: true } } },
    }),
    prisma.report.count(),
  ]);

  res.json({ success: true, reports, total, page, hasMore: (page - 1) * limit + reports.length < total });
});

export const resolveReport = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const report = await prisma.report.findUnique({ where: { id } });
  if (!report) return res.status(404).json({ success: false, message: 'Report not found' });

  const updated = await prisma.report.update({ where: { id }, data: { resolved: true } });
  res.json({ success: true, resolved: updated.resolved });
});