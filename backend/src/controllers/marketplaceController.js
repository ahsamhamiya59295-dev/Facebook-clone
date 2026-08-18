import asyncHandler from '../utils/asyncHandler.js';
import AppError from '../utils/AppError.js';
import prisma from '../config/database.js';
import { hiddenUserIds } from '../utils/authorization.js';
import { deleteFile } from '../utils/helpers.js';

const listingInclude = {
  seller: { select: { id: true, username: true, fullName: true, profile: { select: { avatarUrl: true } } } },
};

export const getListings = asyncHandler(async (req, res) => {
  const { q, category } = req.query;
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
  const skip = (page - 1) * limit;

  const hidden = await hiddenUserIds(req.user.id);

  const where = {
    status: 'ACTIVE',
    sellerId: { notIn: hidden },
    ...(category ? { category } : {}),
    ...(q ? { title: { contains: q, mode: 'insensitive' } } : {}),
  };

  const [listings, total] = await Promise.all([
    prisma.marketplaceListing.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: listingInclude,
    }),
    prisma.marketplaceListing.count({ where }),
  ]);

  res.json({ success: true, listings, total, page, hasMore: skip + listings.length < total });
});

export const getListing = asyncHandler(async (req, res) => {
  const listing = await prisma.marketplaceListing.findUnique({
    where: { id: req.params.id },
    include: listingInclude,
  });
  if (!listing) throw new AppError('Listing not found', 404);
  res.json({ success: true, listing });
});

export const createListing = asyncHandler(async (req, res) => {
  const { title, description, price, category, condition, location, currency } = req.body;
  if (!title || !price || !category) throw new AppError('Title, price and category are required', 400);
  const priceNum = parseFloat(price);
  if (Number.isNaN(priceNum) || priceNum < 0 || priceNum > 1e9) {
    throw new AppError('Invalid price', 400);
  }

  const images = (req.files || []).map((f) => `/uploads/${f.filename}`);

  const listing = await prisma.marketplaceListing.create({
    data: {
      sellerId: req.user.id,
      title,
      description: description || null,
      price: priceNum,
      currency: currency || 'USD',
      category,
      condition: condition || null,
      location: location || null,
      images,
    },
    include: listingInclude,
  });
  res.status(201).json({ success: true, listing });
});

export const updateListing = asyncHandler(async (req, res) => {
  const existing = await prisma.marketplaceListing.findUnique({ where: { id: req.params.id } });
  if (!existing) throw new AppError('Listing not found', 404);
  if (existing.sellerId !== req.user.id) throw new AppError('Not authorized', 403);

  const { title, description, price, condition, status } = req.body;
  let priceNum;
  if (price !== undefined) {
    priceNum = parseFloat(price);
    if (Number.isNaN(priceNum) || priceNum < 0 || priceNum > 1e9) throw new AppError('Invalid price', 400);
  }
  const updated = await prisma.marketplaceListing.update({
    where: { id: req.params.id },
    data: {
      ...(typeof title === 'string' ? { title } : {}),
      ...(typeof description === 'string' ? { description } : {}),
      ...(priceNum !== undefined ? { price: priceNum } : {}),
      ...(typeof condition === 'string' ? { condition } : {}),
      ...(status ? { status } : {}),
    },
    include: listingInclude,
  });
  res.json({ success: true, listing: updated });
});

export const deleteListing = asyncHandler(async (req, res) => {
  const listing = await prisma.marketplaceListing.findUnique({ where: { id: req.params.id } });
  if (!listing) throw new AppError('Listing not found', 404);
  if (listing.sellerId !== req.user.id) throw new AppError('Not authorized', 403);
  await prisma.marketplaceListing.delete({ where: { id: req.params.id } });
  for (const img of listing.images || []) deleteFile(img);
  res.json({ success: true });
});

export const getCategories = asyncHandler(async (req, res) => {
  const categories = ['Vehicles', 'Electronics', 'Furniture', 'Home & Garden', 'Clothing', 'Sports', 'Toys', 'Other'];
  res.json({ success: true, categories });
});

export const saveListing = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const listing = await prisma.marketplaceListing.findUnique({ where: { id } });
  if (!listing) throw new AppError('Listing not found', 404);
  if (listing.sellerId !== req.user.id) throw new AppError('Not authorized', 403);
  await prisma.marketplaceListing.update({
    where: { id },
    data: { status: 'SOLD' },
  });
  res.json({ success: true });
});