import fs from 'fs';
import prisma from '../src/config/database.js';

const TEST_PATTERNS = [
  { username: 'testuser' },
  { username: { startsWith: 'sec' } },
  { username: { startsWith: 'u' }, email: { endsWith: '@test.local' } },
  { username: { startsWith: 'o' }, email: { endsWith: '@test.local' } },
  { username: { startsWith: 'fa' }, email: { endsWith: '@test.local' } },
  { username: { startsWith: 'fb' }, email: { endsWith: '@test.local' } },
  { username: { startsWith: 'fc' }, email: { endsWith: '@test.local' } },
  { username: { startsWith: 'fadm' }, email: { endsWith: '@test.local' } },
  { username: { startsWith: 'fvic' }, email: { endsWith: '@test.local' } },
  { username: { startsWith: 'rp' }, email: { endsWith: '@test.local' } },
  { username: { startsWith: 'dp' }, email: { endsWith: '@test.local' } },
  { username: 'visualqa' },
  { username: 'visualqaf' },
];

const toDelete = new Set();
for (const pat of TEST_PATTERNS) {
  const found = await prisma.user.findMany({ where: pat, select: { id: true, username: true } });
  found.forEach((u) => toDelete.add(u.id));
}

const users = await prisma.user.findMany({ select: { id: true, username: true } });
const KEEP = users.filter((u) => !toDelete.has(u.id)).map((u) => u.username);
console.log('keeping:', KEEP.join(', '));
console.log('deleting test users:', (await prisma.user.findMany({ where: { id: { in: [...toDelete] } }, select: { username: true } })).map((u) => u.username).join(', '));

if (toDelete.size) {
  await prisma.user.deleteMany({ where: { id: { in: [...toDelete] } } });
}

// ---- orphaned uploads: any file in ./uploads not referenced anywhere ----
const refs = new Set();
(await prisma.profile.findMany({ select: { avatarUrl: true, coverUrl: true } }))
  .flatMap((p) => [p.avatarUrl, p.coverUrl]).filter(Boolean)
  .forEach((u) => refs.add(u.split('/').pop()));
(await prisma.postMedia.findMany({ select: { url: true } })).forEach((m) => refs.add(m.url.split('/').pop()));
(await prisma.story.findMany({ select: { url: true } })).forEach((m) => refs.add(m.url.split('/').pop()));
(await prisma.message.findMany({ select: { mediaUrl: true } })).forEach((m) => { if (m.mediaUrl) refs.add(m.mediaUrl.split('/').pop()); });
(await prisma.groupPost.findMany({ select: { mediaUrl: true } })).forEach((m) => { if (m.mediaUrl) refs.add(m.mediaUrl.split('/').pop()); });
(await prisma.event.findMany({ select: { coverUrl: true } })).forEach((m) => { if (m.coverUrl) refs.add(m.coverUrl.split('/').pop()); });
(await prisma.marketplaceListing.findMany({ select: { images: true } })).forEach((l) => (l.images || []).forEach((u) => refs.add(u.split('/').pop())));

const files = fs.readdirSync('./uploads').filter((f) => f !== '.gitkeep');
const orphans = files.filter((f) => !refs.has(f));
for (const f of orphans) {
  try { fs.unlinkSync(`./uploads/${f}`); } catch { /* ignore */ }
}
console.log(`upload files: ${files.length}, kept: ${files.length - orphans.length}, deleted orphans: ${orphans.length}`);
await prisma.$disconnect();