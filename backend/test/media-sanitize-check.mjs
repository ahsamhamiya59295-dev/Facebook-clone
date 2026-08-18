import { sendMessage } from '../src/services/messageService.js';
import prisma from '../src/config/database.js';

async function findConversation() {
  const convs = await prisma.conversation.findMany({
    where: { isGroup: false },
    take: 20,
    include: { participants: { select: { userId: true } } },
  });
  for (const c of convs) {
    if (c.participants.length === 2 && c.participants[0].userId !== c.participants[1].userId) return c;
  }
  const users = await prisma.user.findMany({ take: 2, select: { id: true } });
  const created = await prisma.conversation.create({
    data: {
      createdById: users[0].id,
      isGroup: false,
      participants: { create: [{ userId: users[0].id }, { userId: users[1].id }] },
    },
  });
  return created;
}

const conv = await findConversation();
const { participants } = await prisma.conversation.findUnique({
  where: { id: conv.id },
  include: { participants: { select: { userId: true } } },
});
const senderId = participants[0].userId;

const cases = [
  ['javascript:alert(1)', 'IMAGE'],
  ['https://evil.example/x.png', 'IMAGE'],
  ['/uploads/1234567890123-bad$name.png', 'IMAGE'],
  ['/uploads/..%2f..%2fpackage.json', 'VIDEO'],
  ['data:text/html,<script>1</script>', 'VIDEO'],
];

let pass = 0;
const createdIds = [];
for (const [url, type] of cases) {
  const m = await sendMessage(conv.id, senderId, { content: 'sanitize probe', mediaUrl: url, mediaType: type });
  createdIds.push(m.id);
  const ok = m.mediaUrl === null && m.mediaType === null;
  console.log(`${ok ? 'PASS' : 'FAIL'}: malicious mediaUrl '${url}' sanitized (stored=${m.mediaUrl || 'null'})`);
  if (ok) pass += 1;
}

const good = await sendMessage(conv.id, senderId, { content: 'sanitize probe', mediaUrl: '/uploads/1787060624382-_c1NGYUpkJ.jpg', mediaType: 'IMAGE' });
createdIds.push(good.id);
const goodOk = good.mediaUrl === '/uploads/1787060624382-_c1NGYUpkJ.jpg' && good.mediaType === 'IMAGE';
console.log(`${goodOk ? 'PASS' : 'FAIL'}: legit /uploads/ mediaUrl preserved`);
if (goodOk) pass += 1;

await prisma.message.deleteMany({ where: { id: { in: createdIds } } });
console.log(`\nSocket mediaUrl sanitization: ${pass}/${createdIds.length} checks passed`);
process.exit(pass === createdIds.length ? 0 : 1);