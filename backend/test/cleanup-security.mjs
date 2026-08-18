import prisma from '../src/config/database.js';

const events = await prisma.event.deleteMany({ where: { name: 'Sec Event' } });
const groups = await prisma.group.deleteMany({ where: { name: { startsWith: 'Sec Group' } } });
console.log(`deleted ${events.count} test event(s), ${groups.count} test group(s)`);

const secUsers = await prisma.user.findMany({
  where: { username: { startsWith: 'sec' }, AND: { username: { not: { startsWith: 'sec2' } } } },
  select: { id: true, username: true },
});
const testIds = secUsers
  .filter((u) => /^sec\d+$/.test(u.username))
  .map((u) => u.id);
const convs = testIds.length
  ? await prisma.conversation.findMany({
      where: { participants: { some: { userId: { in: testIds } } } },
      select: { id: true },
    })
  : [];
if (convs.length) {
  await prisma.conversation.deleteMany({ where: { id: { in: convs.map((c) => c.id) } } });
}
console.log(`cleaned ${convs.length} test conversation(s)`);
await prisma.$disconnect();