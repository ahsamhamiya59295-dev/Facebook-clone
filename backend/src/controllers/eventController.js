import asyncHandler from '../utils/asyncHandler.js';
import prisma from '../config/database.js';
import { areBlocked, hiddenUserIds, friendIds, isFriends } from '../utils/authorization.js';

const eventInclude = {
  organizer: { select: { id: true, username: true, fullName: true, profile: { select: { avatarUrl: true } } } },
  members: { select: { userId: true, status: true } },
  _count: { select: { members: true } },
};

function eventCanView(event, userId) {
  if (event.privacy === 'PUBLIC') return true;
  if (event.organizerId === userId) return true;
  if (event.members.some((m) => m.userId === userId)) return true;
  if (event.privacy === 'FRIENDS') return false; // resolved in helper below with async
  return false;
}

export const getEvents = asyncHandler(async (req, res) => {
  const hidden = await hiddenUserIds(req.user.id);
  const friendIdsArr = await friendIds(req.user.id);

  const events = await prisma.event.findMany({
    where: {
      organizerId: { notIn: hidden },
      OR: [
        { privacy: 'PUBLIC' },
        { organizerId: req.user.id },
        { members: { some: { userId: req.user.id } } },
        { privacy: 'FRIENDS', organizerId: { in: friendIdsArr } },
      ],
    },
    orderBy: { startsAt: 'asc' },
    include: eventInclude,
  });
  res.json({ success: true, events });
});

export const getEvent = asyncHandler(async (req, res) => {
  const event = await prisma.event.findUnique({ where: { id: req.params.id }, include: eventInclude });
  if (!event) return res.status(404).json({ success: false, message: 'Event not found' });
  if (await areBlocked(req.user.id, event.organizerId)) {
    return res.status(404).json({ success: false, message: 'Event not found' });
  }

  const canView = eventCanView(event, req.user.id) || (event.privacy === 'FRIENDS' && (await isFriends(req.user.id, event.organizerId)));
  if (!canView) return res.status(403).json({ success: false, message: 'This is an invite-only event' });

  const member = event.members.find((m) => m.userId === req.user.id);
  res.json({ success: true, event, memberStatus: member?.status || null });
});

export const createEvent = asyncHandler(async (req, res) => {
  const { name, description, location, startsAt, endsAt, privacy } = req.body;
  if (!name || !startsAt) return res.status(400).json({ success: false, message: 'Name and start date are required' });
  if (Number.isNaN(new Date(startsAt).getTime())) return res.status(400).json({ success: false, message: 'Invalid start date' });

  const event = await prisma.event.create({
    data: {
      name,
      description: description || null,
      location: location || null,
      organizerId: req.user.id,
      startsAt: new Date(startsAt),
      endsAt: endsAt ? new Date(endsAt) : null,
      privacy: privacy || 'PUBLIC',
      coverUrl: req.file ? `/uploads/${req.file.filename}` : null,
    },
    include: eventInclude,
  });
  res.status(201).json({ success: true, event });
});

export const rsvpEvent = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const allowed = ['INTERESTED', 'GOING', 'MAYBE'];
  if (!allowed.includes(status)) return res.status(400).json({ success: false, message: 'Invalid status' });

  const event = await prisma.event.findUnique({ where: { id: req.params.id } });
  if (!event) return res.status(404).json({ success: false, message: 'Event not found' });
  if (await areBlocked(req.user.id, event.organizerId)) {
    return res.status(403).json({ success: false, message: 'Action not allowed' });
  }
  if (event.privacy === 'INVITE_ONLY') {
    const invited = await prisma.eventMember.findUnique({
      where: { eventId_userId: { eventId: event.id, userId: req.user.id } },
    });
    if (!invited) return res.status(403).json({ success: false, message: 'You must be invited to RSVP' });
  }

  await prisma.eventMember.upsert({
    where: { eventId_userId: { eventId: req.params.id, userId: req.user.id } },
    create: { eventId: req.params.id, userId: req.user.id, status },
    update: { status },
  });
  res.json({ success: true });
});