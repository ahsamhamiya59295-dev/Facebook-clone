import asyncHandler from '../utils/asyncHandler.js';
import prisma from '../config/database.js';

export const listVideos = asyncHandler(async (req, res) => {
  const videos = await prisma.video.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  res.json({ success: true, videos });
});