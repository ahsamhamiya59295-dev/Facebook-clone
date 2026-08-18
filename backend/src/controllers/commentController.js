import asyncHandler from '../utils/asyncHandler.js';
import AppError from '../utils/AppError.js';
import {
  addComment,
  listComments,
  commentReplies,
  updateComment,
  deleteComment,
  toggleCommentReaction,
} from '../services/postService.js';
import { createNotification } from '../services/notificationService.js';
import { getCommentPostAuthor } from '../services/postService.js';
import prisma from '../config/database.js';

export const getComments = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);
  const data = await listComments(req.params.id, req.user.id, { page, limit });
  res.json({ success: true, ...data });
});

export const getReplies = asyncHandler(async (req, res) => {
  const replies = await commentReplies(req.params.id, req.user.id);
  res.json({ success: true, replies });
});

export const createComment = asyncHandler(async (req, res) => {
  const { content, parentId } = req.body;
  if (!content || !content.trim()) throw new AppError('Comment content is required', 400);

  const comment = await addComment(req.params.id, req.user.id, { content, parentId });

  const post = await prisma.post.findFirst({
    where: { id: req.params.id, isArchived: false },
    select: { id: true, authorId: true },
  });
  if (!post) throw new AppError('Post not found', 404);

  if (post.authorId !== req.user.id) {
    await createNotification({
      recipientId: post.authorId,
      actorId: req.user.id,
      type: 'COMMENT',
      message: `${req.user.fullName} commented on your post`,
      entityId: post.id,
    });
  }

  // notify parent comment author of a reply
  if (parentId) {
    const parent = await prisma.comment.findUnique({ where: { id: parentId } });
    if (parent && parent.userId !== req.user.id && parent.userId !== post.authorId) {
      await createNotification({
        recipientId: parent.userId,
        actorId: req.user.id,
        type: 'COMMENT_REPLY',
        message: `${req.user.fullName} replied to your comment`,
        entityId: post.id,
      });
    }
  }

  res.status(201).json({ success: true, comment });
});

export const updateCommentHandler = asyncHandler(async (req, res) => {
  const { content } = req.body;
  if (!content || !content.trim()) throw new AppError('Comment content is required', 400);
  const comment = await updateComment(req.params.id, req.user.id, content);
  res.json({ success: true, comment });
});

export const deleteCommentHandler = asyncHandler(async (req, res) => {
  const postAuthorId = await getCommentPostAuthor(req.params.id);
  await deleteComment(req.params.id, req.user.id, { postAuthorId });
  res.json({ success: true });
});

export const reactToComment = asyncHandler(async (req, res) => {
  const { type } = req.body;
  const valid = ['LIKE', 'LOVE', 'CARE', 'HAHA', 'WOW', 'SAD', 'ANGRY'];
  if (!valid.includes(type)) throw new AppError('Invalid reaction type', 400);
  const result = await toggleCommentReaction(req.params.id, req.user.id, type);
  res.json({ success: true, ...result });
});