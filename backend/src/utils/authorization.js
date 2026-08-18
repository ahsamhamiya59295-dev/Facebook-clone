import prisma from '../config/database.js';
import AppError from './AppError.js';

// ---------- block helpers ----------

export async function areBlocked(userIdA, userIdB) {
  if (!userIdA || !userIdB || userIdA === userIdB) return false;
  const block = await prisma.block.findFirst({
    where: {
      OR: [
        { blockerId: userIdA, blockedId: userIdB },
        { blockerId: userIdB, blockedId: userIdA },
      ],
    },
  });
  return Boolean(block);
}

export async function blockedUserIds(userId) {
  const blocks = await prisma.block.findMany({
    where: { blockerId: userId },
    select: { blockedId: true },
  });
  return blocks.map((b) => b.blockedId);
}

export async function usersBlockingMe(userId) {
  const blocks = await prisma.block.findMany({
    where: { blockedId: userId },
    select: { blockerId: true },
  });
  return blocks.map((b) => b.blockerId);
}

// Returns every id that a viewer should never see content from (either direction).
export async function hiddenUserIds(userId) {
  const [blocked, blockers] = await Promise.all([blockedUserIds(userId), usersBlockingMe(userId)]);
  return [...new Set([...blocked, ...blockers])];
}

// ---------- friend helpers ----------

export async function isFriends(userIdA, userIdB) {
  if (userIdA === userIdB) return true;
  const friendship = await prisma.friendship.findFirst({
    where: {
      OR: [
        { userOneId: userIdA, userTwoId: userIdB },
        { userOneId: userIdB, userTwoId: userIdA },
      ],
    },
  });
  return Boolean(friendship);
}

export async function friendIds(userId) {
  const friendships = await prisma.friendship.findMany({
    where: { OR: [{ userOneId: userId }, { userTwoId: userId }] },
    select: { userOneId: true, userTwoId: true },
  });
  const set = new Set(friendships.flatMap((f) => [f.userOneId, f.userTwoId]));
  set.delete(userId);
  return [...set];
}

// ---------- content access ----------

// Returns true when viewer can view a post authored by authorId with given privacy.
export async function canViewPost(viewerId, authorId, privacy) {
  if (viewerId === authorId) return true;
  if (await areBlocked(viewerId, authorId)) return false;

  if (privacy === 'PUBLIC') return true;
  if (privacy === 'ONLY_ME') return false;
  if (privacy === 'FRIENDS') return isFriends(viewerId, authorId);
  return false;
}

export async function assertCanViewPost(viewerId, authorId, privacy) {
  if (!(await canViewPost(viewerId, authorId, privacy))) {
    throw new AppError('Post not found', 404);
  }
}

export async function isConversationMember(conversationId, userId) {
  const participant = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
  });
  return Boolean(participant);
}

export async function assertCanAccessConversation(conversationId, userId) {
  if (!(await isConversationMember(conversationId, userId))) {
    throw new AppError('Conversation not found', 404);
  }
}