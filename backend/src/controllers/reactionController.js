import asyncHandler from '../utils/asyncHandler.js';
import AppError from '../utils/AppError.js';
import {
  toggleReaction,
  reactionSummary,
} from '../services/postService.js';
import { createNotification } from '../services/notificationService.js';
import prisma from '../config/database.js';

export const setReaction = asyncHandler(async (req, res) => {
  const { type } = req.body;
  const valid = ['LIKE', 'LOVE', 'CARE', 'HAHA', 'WOW', 'SAD', 'ANGRY'];
  if (!valid.includes(type)) throw new AppError('Invalid reaction type', 400);

  const post = await prisma.post.findFirst({
    where: { id: req.params.id, isArchived: false },
    select: { id: true, authorId: true },
  });
  if (!post) throw new AppError('Post not found', 404);

  const result = await toggleReaction(post.id, req.user.id, type);
  const summary = await reactionSummary(post.id);

  if (result.active && post.authorId !== req.user.id) {
    await createNotification({
      recipientId: post.authorId,
      actorId: req.user.id,
      type: 'LIKE',
      message: `${req.user.fullName} reacted ${type.toLowerCase()} to your post`,
      entityId: post.id,
    });
  }

  res.json({ success: true, ...result, summary });
});

export const removeReaction = asyncHandler(async (req, res) => {
  const post = await prisma.post.findFirst({
    where: { id: req.params.id, isArchived: false },
    select: { id: true },
  });
  if (!post) throw new AppError('Post not found', 404);
  await prisma.reaction.deleteMany({ where: { userId: req.user.id, postId: post.id } });
  const summary = await reactionSummary(post.id);
  res.json({ success: true, reaction: null, active: false, summary });
});