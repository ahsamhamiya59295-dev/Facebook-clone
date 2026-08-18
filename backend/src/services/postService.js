import prisma from '../config/database.js';
import AppError from '../utils/AppError.js';
import { friendIds, hiddenUserIds, areBlocked, canViewPost } from '../utils/authorization.js';
import { deleteFile } from '../utils/helpers.js';

export const postInclude = {
  author: {
    select: {
      id: true,
      username: true,
      fullName: true,
      profile: { select: { avatarUrl: true } },
    },
  },
  media: { orderBy: { createdAt: 'asc' } },
  _count: {
    select: {
      reactions: true,
      comments: true,
      shares: true,
    },
  },
};

export const withMyReaction = (post) => ({
  ...post,
  myReaction: post.reactions?.[0]?.type ?? null,
  reactions: undefined,
});

const postIncludeFor = (viewerId) => ({
  ...postInclude,
  ...(viewerId ? { reactions: { where: { userId: viewerId }, select: { type: true } } } : {}),
});

export async function createPost(authorId, { content, privacy, location, media }) {
  return prisma.post.create({
    data: {
      authorId,
      content: content || null,
      privacy: privacy || 'PUBLIC',
      location: location || null,
      media: media && media.length > 0 ? { create: media } : undefined,
    },
    include: postInclude,
  });
}

export async function getPostById(postId, viewerId) {
  const post = await prisma.post.findFirst({
    where: { id: postId, isArchived: false },
    include: postIncludeFor(viewerId),
  });
  if (!post) throw new AppError('Post not found', 404);
  return viewerId ? withMyReaction(post) : post;
}

export async function listUserPosts(userId, viewerId, { page = 1, limit = 10 } = {}) {
  const skip = (page - 1) * limit;

  if (viewerId !== userId && (await areBlocked(viewerId, userId))) {
    return { posts: [], total: 0, page, limit, hasMore: false };
  }

  const where = {
    authorId: userId,
    isArchived: false,
    OR: [
      { privacy: 'PUBLIC' },
      ...(viewerId === userId ? [{ privacy: 'ONLY_ME' }] : []),
      ...(viewerId !== userId && (await friendIds(userId)).includes(viewerId) ? [{ privacy: 'FRIENDS' }] : []),
    ],
  };

  const [posts, total] = await Promise.all([
    prisma.post.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit, include: postIncludeFor(viewerId) }),
    prisma.post.count({ where }),
  ]);
  return { posts: posts.map(withMyReaction), total, page, limit, hasMore: skip + posts.length < total };
}

export async function feedPosts(userId, { page = 1, limit = 10 } = {}) {
  const skip = (page - 1) * limit;

  const [friends, hidden] = await Promise.all([friendIds(userId), hiddenUserIds(userId)]);
  const hiddenSet = new Set(hidden);

  const followIds = await prisma.follow.findMany({
    where: { followerId: userId },
    select: { followingId: true },
  });

  const friendSet = new Set(friends);
  const ids = [...friendSet];
  followIds.forEach((f) => {
    if (!hiddenSet.has(f.followingId)) ids.push(f.followingId);
  });

  const where = {
    isArchived: false,
    authorId: { notIn: [...hiddenSet] },
    OR: [
      { privacy: 'PUBLIC', authorId: { in: ids } },
      { privacy: 'FRIENDS', authorId: { in: friendSet.size ? [...friendSet] : [] } },
      { authorId: userId },
    ],
  };

  const [posts, total] = await Promise.all([
    prisma.post.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit, include: postIncludeFor(userId) }),
    prisma.post.count({ where }),
  ]);

  return { posts: posts.map(withMyReaction), total, page, limit, hasMore: skip + posts.length < total };
}

export async function updatePost(postId, userId, { content, privacy, location }) {
  const existing = await prisma.post.findUnique({ where: { id: postId } });
  if (!existing) throw new AppError('Post not found', 404);
  if (existing.authorId !== userId) throw new AppError('You can only edit your own posts', 403);

  return prisma.post.update({
    where: { id: postId },
    data: { content: content ?? existing.content, privacy: privacy ?? existing.privacy, location: location ?? existing.location, isEdited: true },
    include: postInclude,
  });
}

export async function deletePost(postId, userId) {
  const existing = await prisma.post.findUnique({
    where: { id: postId },
    include: { media: { select: { url: true } } },
  });
  if (!existing) throw new AppError('Post not found', 404);
  if (existing.authorId !== userId) throw new AppError('You can only delete your own posts', 403);
  await prisma.post.delete({ where: { id: postId } });
  for (const m of existing.media) deleteFile(m.url);
  return { success: true };
}

export async function sharePost(postId, userId, content) {
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) throw new AppError('Post not found', 404);

  const shared = await prisma.postShare.create({
    data: { postId, sharedById: userId, content: content || null },
    include: { post: { include: postInclude } },
  });
  return shared;
}

export async function toggleReaction(postId, userId, type) {
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) throw new AppError('Post not found', 404);
  if (!(await canViewPost(userId, post.authorId, post.privacy))) {
    throw new AppError('Post not found', 404);
  }

  const existing = await prisma.reaction.findUnique({
    where: { userId_postId: { userId, postId } },
  });

  if (existing) {
    if (existing.type === type) {
      await prisma.reaction.delete({ where: { id: existing.id } });
      return { reaction: null, active: false };
    }
    const updated = await prisma.reaction.update({
      where: { id: existing.id },
      data: { type },
    });
    return { reaction: updated, active: true };
  }

  const reaction = await prisma.reaction.create({
    data: { userId, postId, type },
  });
  return { reaction, active: true };
}

export async function reactionSummary(postId) {
  const reactions = await prisma.reaction.groupBy({
    by: ['type'],
    where: { postId },
    _count: { type: true },
  });
  const map = {};
  reactions.forEach((r) => { map[r.type] = r._count.type; });
  const total = reactions.reduce((sum, r) => sum + r._count.type, 0);
  return { counts: map, total };
}

export async function listComments(postId, viewerId, { page = 1, limit = 10 } = {}) {
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) throw new AppError('Post not found', 404);
  if (!(await canViewPost(viewerId, post.authorId, post.privacy))) {
    throw new AppError('Post not found', 404);
  }

  const skip = (page - 1) * limit;
  const where = { postId, parentId: null };

  const [comments, total] = await Promise.all([
    prisma.comment.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      skip,
      take: limit,
      include: {
        user: { select: { id: true, username: true, fullName: true, profile: { select: { avatarUrl: true } } } },
        _count: { select: { replies: true, reactions: true } },
        reactions: { select: { type: true } },
      },
    }),
    prisma.comment.count({ where }),
  ]);

  return { comments, total, page, hasMore: skip + comments.length < total };
}

export async function commentReplies(commentId, viewerId) {
  const comment = await prisma.comment.findUnique({ where: { id: commentId } });
  if (!comment) throw new AppError('Comment not found', 404);
  const post = await prisma.post.findUnique({ where: { id: comment.postId } });
  if (!post || !(await canViewPost(viewerId, post.authorId, post.privacy))) {
    throw new AppError('Post not found', 404);
  }

  return prisma.comment.findMany({
    where: { parentId: commentId },
    orderBy: { createdAt: 'asc' },
    include: {
      user: { select: { id: true, username: true, fullName: true, profile: { select: { avatarUrl: true } } } },
      _count: { select: { replies: true, reactions: true } },
      reactions: { select: { type: true } },
    },
  });
}

export async function addComment(postId, userId, { content, parentId }) {
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) throw new AppError('Post not found', 404);
  if (!(await canViewPost(userId, post.authorId, post.privacy))) {
    throw new AppError('Post not found', 404);
  }

  if (parentId) {
    const parent = await prisma.comment.findUnique({ where: { id: parentId } });
    if (!parent || parent.postId !== postId) throw new AppError('Parent comment not found', 404);
  }

  return prisma.comment.create({
    data: { postId, userId, content, parentId: parentId || null },
    include: {
      user: { select: { id: true, username: true, fullName: true, profile: { select: { avatarUrl: true } } } },
      _count: { select: { replies: true, reactions: true } },
    },
  });
}

export async function updateComment(commentId, userId, content) {
  const comment = await prisma.comment.findUnique({ where: { id: commentId } });
  if (!comment) throw new AppError('Comment not found', 404);
  if (comment.userId !== userId) throw new AppError('Not authorized', 403);
  return prisma.comment.update({
    where: { id: commentId },
    data: { content, isEdited: true },
    include: {
      user: { select: { id: true, username: true, fullName: true, profile: { select: { avatarUrl: true } } } },
    },
  });
}

export async function deleteComment(commentId, userId, { postAuthorId = null } = {}) {
  const comment = await prisma.comment.findUnique({ where: { id: commentId } });
  if (!comment) throw new AppError('Comment not found', 404);
  if (comment.userId !== userId && postAuthorId !== userId) {
    throw new AppError('Not authorized', 403);
  }
  await prisma.comment.delete({ where: { id: commentId } });
  return { success: true };
}

export async function toggleCommentReaction(commentId, userId, type) {
  const comment = await prisma.comment.findUnique({ where: { id: commentId } });
  if (!comment) throw new AppError('Comment not found', 404);

  const post = await prisma.post.findUnique({ where: { id: comment.postId } });
  if (!post || !(await canViewPost(userId, post.authorId, post.privacy))) {
    throw new AppError('Post not found', 404);
  }

  const existing = await prisma.commentReaction.findUnique({
    where: { userId_commentId: { userId, commentId } },
  });

  if (existing) {
    if (existing.type === type) {
      await prisma.commentReaction.delete({ where: { id: existing.id } });
      return { reaction: null, active: false };
    }
    const updated = await prisma.commentReaction.update({ where: { id: existing.id }, data: { type } });
    return { reaction: updated, active: true };
  }

  const reaction = await prisma.commentReaction.create({ data: { userId, commentId, type } });
  return { reaction, active: true };
}

export async function savePost(postId, userId, collectionId = null) {
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post || !(await canViewPost(userId, post.authorId, post.privacy))) {
    throw new AppError('Post not found', 404);
  }

  const existing = await prisma.savedPost.findUnique({
    where: { userId_postId: { userId, postId } },
  });

  if (existing) {
    if (collectionId) {
      await prisma.savedPost.update({ where: { id: existing.id }, data: { collectionId } });
      return { saved: true };
    }
    await prisma.savedPost.delete({ where: { id: existing.id } });
    return { saved: false };
  }

  await prisma.savedPost.create({ data: { userId, postId, collectionId } });
  return { saved: true };
}

export async function savedPosts(userId) {
  const saved = await prisma.savedPost.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: { post: { include: postInclude }, collection: { select: { id: true, name: true } } },
  });
  return saved.map((s) => s.post);
}

export async function listCollections(userId) {
  return prisma.collection.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
}

export async function createCollection(userId, name) {
  return prisma.collection.create({ data: { userId, name } });
}

export async function getPostAuthor(postId) {
  const post = await prisma.post.findUnique({ where: { id: postId }, select: { authorId: true } });
  return post?.authorId;
}

export async function getCommentPostAuthor(commentId) {
  const comment = await prisma.comment.findUnique({ where: { id: commentId }, select: { post: { select: { authorId: true } } } });
  return comment?.post?.authorId;
}