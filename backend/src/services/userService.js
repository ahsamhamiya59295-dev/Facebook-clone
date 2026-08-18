import prisma from '../config/database.js';
import AppError from '../utils/AppError.js';
import { deleteFile, publicUrl } from '../utils/helpers.js';

export const userDefaults = {
  id: true,
  username: true,
  fullName: true,
  isVerified: true,
  createdAt: true,
  profile: {
    select: {
      bio: true,
      avatarUrl: true,
      coverUrl: true,
      location: true,
      work: true,
      education: true,
      relationshipStatus: true,
    },
  },
};

// Friends may always see each other's birthday, mirroring sanitizePublicUser
export const friendSelect = {
  ...userDefaults,
  dob: true,
  profile: {
    select: {
      bio: true,
      avatarUrl: true,
      coverUrl: true,
      location: true,
      work: true,
      education: true,
      relationshipStatus: true,
      birthdayVisibility: true,
    },
  },
};

export const publicUserSelect = {
  id: true,
  username: true,
  fullName: true,
  isVerified: true,
  role: true,
  createdAt: true,
  profile: {
    select: {
      bio: true,
      avatarUrl: true,
      coverUrl: true,
      location: true,
      work: true,
      education: true,
      website: true,
      relationshipStatus: true,
      privacy: true,
      birthdayVisibility: true,
    },
  },
};

const PRIVATE_INFO_FIELDS = ['location', 'work', 'education', 'relationshipStatus', 'website'];

function stripPrivateFields(user) {
  const profile = { ...user.profile };
  for (const field of PRIVATE_INFO_FIELDS) delete profile[field];
  return { ...user, profile };
}

export function sanitizePublicUser(user, viewerId, relation) {
  if (!user) return user;
  if (viewerId && user.id === viewerId) return user;

  // Blocked users only get the barest identity info
  if (relation === 'BLOCKED') {
    return {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      isVerified: user.isVerified,
      profile: { avatarUrl: user.profile?.avatarUrl, coverUrl: user.profile?.coverUrl },
    };
  }

  const isFriend = relation === 'FRIENDS';
  const privacy = user.profile?.privacy || 'PUBLIC';

  // Private info fields only for the user themselves, friends, or PUBLIC profiles
  const canSeeInfo = isFriend || privacy === 'PUBLIC' || privacy === 'FRIENDS';
  let sanitized = canSeeInfo ? { ...user } : stripPrivateFields(user);

  // Email is never exposed to anyone other than the account owner
  delete sanitized.email;

  // dob only when the owner's profile says it is public, or when the viewer is a friend
  if (!(isFriend || (privacy === 'PUBLIC' && user.profile?.birthdayVisibility === true))) {
    delete sanitized.dob;
  }

  return sanitized;
}

export async function getUserByUsername(username, viewerId) {
  const user = await prisma.user.findUnique({
    where: { username },
    select: { ...publicUserSelect, email: true, dob: true },
  });
  if (!user) return null;
  if (!viewerId) return { user: sanitizePublicUser(user, null, 'NONE'), relation: 'NONE' };
  const relation = await getFriendRelation(viewerId, user.id);
  return { user: sanitizePublicUser(user, viewerId, relation), relation };
}

export async function getUserById(id, viewerId) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: { ...publicUserSelect, email: true, dob: true },
  });
  if (!user) return null;
  if (!viewerId) return { user: sanitizePublicUser(user, null, 'NONE'), relation: 'NONE' };
  const relation = await getFriendRelation(viewerId, user.id);
  return { user: sanitizePublicUser(user, viewerId, relation), relation };
}

export async function updateProfile(userId, data) {
  const { profile: profileData, ...userData } = data;

  const update = {};
  if (userData.fullName) update.fullName = userData.fullName.trim();
  if (userData.username) update.username = userData.username.toLowerCase().trim();
  if (userData.gender) update.gender = userData.gender;

  if (userData.username) {
    const count = await prisma.user.count({
      where: { username: update.username, NOT: { id: userId } },
    });
    if (count > 0) throw new AppError('Username is already taken', 409);
  }

  const profileUpdate = {};
  const allowed = ['bio', 'phone', 'website', 'location', 'work', 'education', 'relationshipStatus', 'privacy', 'birthdayVisibility'];
  for (const key of allowed) {
    if (profileData && profileData[key] !== undefined) profileUpdate[key] = profileData[key];
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      ...update,
      ...(Object.keys(profileUpdate).length > 0 ? { profile: { update: profileUpdate } } : {}),
    },
    select: publicUserSelect,
  });

  return updated;
}

export async function updateAvatar(userId, filename) {
  const current = await prisma.profile.findUnique({ where: { userId } });
  const avatarUrl = publicUrl(filename);
  const updated = await prisma.profile.update({
    where: { userId },
    data: { avatarUrl },
    select: { user: { select: userDefaults } },
  });
  if (current?.avatarUrl) deleteFile(current.avatarUrl);
  return updated.user;
}

export async function updateCover(userId, filename) {
  const current = await prisma.profile.findUnique({ where: { userId } });
  const coverUrl = publicUrl(filename);
  const updated = await prisma.profile.update({
    where: { userId },
    data: { coverUrl },
    select: { user: { select: userDefaults } },
  });
  if (current?.coverUrl) deleteFile(current.coverUrl);
  return updated.user;
}

export async function getFriendRelation(currentUserId, targetUserId) {
  if (currentUserId === targetUserId) return 'SELF';

  const [request, friendship, block] = await Promise.all([
    prisma.friendRequest.findFirst({
      where: {
        OR: [
          { senderId: currentUserId, receiverId: targetUserId },
          { senderId: targetUserId, receiverId: currentUserId },
        ],
      },
    }),
    prisma.friendship.findFirst({
      where: {
        OR: [
          { userOneId: currentUserId, userTwoId: targetUserId },
          { userOneId: targetUserId, userTwoId: currentUserId },
        ],
      },
    }),
    prisma.block.findFirst({
      where: { OR: [{ blockerId: currentUserId, blockedId: targetUserId }, { blockerId: targetUserId, blockedId: currentUserId }] },
    }),
  ]);

  // A block takes precedence over any other relationship so that a blocked
  // user can never retain FRIENDS-level visibility of profile data or lists.
  if (block) return 'BLOCKED';

  if (request) {
    if (request.status === 'PENDING') {
      return request.senderId === currentUserId ? 'REQUEST_SENT' : 'REQUEST_RECEIVED';
    }
    if (request.status === 'ACCEPTED') return 'FRIENDS';
  }

  if (friendship) return 'FRIENDS';

  return 'NONE';
}

export async function getFriends(userId) {
  const friendships = await prisma.friendship.findMany({
    where: { OR: [{ userOneId: userId }, { userTwoId: userId }] },
    include: {
      userOne: { select: friendSelect },
      userTwo: { select: friendSelect },
    },
    orderBy: { createdAt: 'desc' },
  });
  return friendships.map((f) => (f.userOne.id === userId ? f.userTwo : f.userOne));
}

export async function getFollowers(userId) {
  const follows = await prisma.follow.findMany({
    where: { followingId: userId },
    include: { follower: { select: userDefaults } },
    orderBy: { createdAt: 'desc' },
  });
  return follows.map((f) => f.follower);
}

export async function getFollowing(userId) {
  const follows = await prisma.follow.findMany({
    where: { followerId: userId },
    include: { following: { select: userDefaults } },
    orderBy: { createdAt: 'desc' },
  });
  return follows.map((f) => f.following);
}

export async function getFriendRequests(userId) {
  return prisma.friendRequest.findMany({
    where: { receiverId: userId, status: 'PENDING' },
    include: { sender: { select: userDefaults } },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getSuggestions(userId, limit = 6) {
  const friendIds = await prisma.friendship.findMany({
    where: { OR: [{ userOneId: userId }, { userTwoId: userId }] },
    select: { userOneId: true, userTwoId: true },
  });
  const ids = new Set(friendIds.flatMap((f) => [f.userOneId, f.userTwoId]));
  ids.add(userId);

  const requests = await prisma.friendRequest.findMany({
    where: { OR: [{ senderId: userId }, { receiverId: userId }] },
    select: { senderId: true, receiverId: true },
  });
  requests.forEach((r) => { ids.add(r.senderId); ids.add(r.receiverId); });

  const blocks = await prisma.block.findMany({
    where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
    select: { blockerId: true, blockedId: true },
  });
  blocks.forEach((b) => { ids.add(b.blockerId); ids.add(b.blockedId); });

  const suggestions = await prisma.user.findMany({
    where: { id: { notIn: [...ids] }, isActive: true },
    take: limit,
    orderBy: { createdAt: 'desc' },
    select: userDefaults,
  });

  return suggestions.filter((u) => !u.profile || u.profile.privacy === 'PUBLIC');
}