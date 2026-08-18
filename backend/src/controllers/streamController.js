import asyncHandler from '../utils/asyncHandler.js';
import prisma from '../config/database.js';

export const listStreams = asyncHandler(async (req, res) => {
  const streams = await prisma.stream.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  res.json({ success: true, streams });
});