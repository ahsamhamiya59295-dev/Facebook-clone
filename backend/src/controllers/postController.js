import asyncHandler from '../utils/asyncHandler.js';
import AppError from '../utils/AppError.js';
import {
  createPost,
  getPostById,
  feedPosts,
  listUserPosts,
  updatePost,
  deletePost,
} from '../services/postService.js';
import prisma from '../config/database.js';
import { inferMediaType } from '../middleware/uploadMiddleware.js';
import { canViewPost } from '../utils/authorization.js';

export const getFeed = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);
  const data = await feedPosts(req.user.id, { page, limit });
  res.json({ success: true, ...data });
});

export const createPostHandler = asyncHandler(async (req, res) => {
  const { content, privacy, location } = req.body;

  const media = (req.files || []).map((file) => ({
    mediaType: inferMediaType(file.filename, file.mimetype),
    url: `/uploads/${file.filename}`,
  }));

  if (!content && media.length === 0) {
    throw new AppError('Post must have content or media', 400);
  }

  const post = await createPost(req.user.id, { content, privacy, location, media });
  res.status(201).json({ success: true, post });
});

export const getPost = asyncHandler(async (req, res) => {
  const post = await getPostById(req.params.id, req.user.id);
  if (!(await canViewPost(req.user.id, post.authorId, post.privacy))) {
    throw new AppError('Post not found', 404);
  }
  res.json({ success: true, post });
});

export const getUserPostsHandler = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);
  const data = await listUserPosts(req.params.userId, req.user.id, { page, limit });
  res.json({ success: true, ...data });
});

export const updatePostHandler = asyncHandler(async (req, res) => {
  const post = await updatePost(req.params.id, req.user.id, req.body);
  res.json({ success: true, post });
});

export const deletePostHandler = asyncHandler(async (req, res) => {
  await deletePost(req.params.id, req.user.id);
  res.json({ success: true });
});

export const sharePostHandler = asyncHandler(async (req, res) => {
  const post = await getPostById(req.params.id, req.user.id);
  if (!(await canViewPost(req.user.id, post.authorId, post.privacy))) {
    throw new AppError('Post not found', 404);
  }
  const share = await prisma.postShare.create({
    data: { postId: post.id, sharedById: req.user.id, content: req.body.content || null },
    include: {
      post: {
        include: {
          author: { select: { id: true, username: true, fullName: true, profile: { select: { avatarUrl: true } } } },
          media: true,
          _count: { select: { reactions: true, comments: true, shares: true } },
        },
      },
    },
  });
  res.status(201).json({ success: true, share });
});

export const postAuthorName = (req) => req.user.fullName;