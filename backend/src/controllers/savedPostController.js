import asyncHandler from '../utils/asyncHandler.js';
import AppError from '../utils/AppError.js';
import prisma from '../config/database.js';
import { savedPosts, listCollections, createCollection } from '../services/postService.js';
import { areBlocked, canViewPost, friendIds } from '../utils/authorization.js';

export const getSavedPosts = asyncHandler(async (req, res) => {
  const posts = await savedPosts(req.user.id);
  const collections = await listCollections(req.user.id);
  res.json({ success: true, posts, collections });
});

export const toggleSavePost = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const post = await prisma.post.findUnique({ where: { id } });
  if (!post) throw new AppError('Post not found', 404);
  if (!(await canViewPost(req.user.id, post.authorId, post.privacy))) {
    throw new AppError('Post not found', 404);
  }
  const { collectionId } = req.body || {};
  if (collectionId) {
    const owned = await prisma.collection.findFirst({
      where: { id: collectionId, userId: req.user.id },
      select: { id: true },
    });
    if (!owned) throw new AppError('Collection not found', 404);
  }
  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.savedPost.findUnique({ where: { userId_postId: { userId: req.user.id, postId: id } } });
    if (existing) {
      if (collectionId) {
        await tx.savedPost.update({ where: { id: existing.id }, data: { collectionId } });
        return { saved: true };
      }
      await tx.savedPost.delete({ where: { id: existing.id } });
      return { saved: false };
    }
    await tx.savedPost.create({ data: { userId: req.user.id, postId: id, collectionId } });
    return { saved: true };
  });
  res.json({ success: true, ...result });
});

export const addCollection = asyncHandler(async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) throw new AppError('Collection name is required', 400);
  const collection = await createCollection(req.user.id, name.trim());
  res.status(201).json({ success: true, collection });
});

export const removeCollection = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await prisma.collection.deleteMany({ where: { id, userId: req.user.id } });
  res.json({ success: true });
});

export const getUserMedia = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const type = req.query.type || 'all';

  if (req.user.id !== id && (await areBlocked(req.user.id, id))) {
    return res.json({ success: true, media: [] });
  }

  const mediaFilter = type === 'video' ? { mediaType: 'VIDEO' } : type === 'photo' ? { mediaType: 'IMAGE' } : {};
  const canSeeFriendsPosts = req.user.id === id || (await friendIds(id)).includes(req.user.id);
  const where = {
    authorId: id,
    isArchived: false,
    OR: [
      { privacy: 'PUBLIC' },
      ...(canSeeFriendsPosts ? [{ privacy: 'FRIENDS' }] : []),
      ...(req.user.id === id ? [{ privacy: 'ONLY_ME' }] : []),
    ],
  };

  const posts = await prisma.post.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 60,
    select: {
      id: true,
      media: { where: mediaFilter, select: { url: true, mediaType: true } },
    },
  });

  res.json({
    success: true,
    media: posts.flatMap((p) => p.media.map((m) => ({ postId: p.id, url: m.url, mediaType: m.mediaType }))),
  });
});