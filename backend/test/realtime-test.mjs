import { io } from 'socket.io-client';

const BASE = process.env.VITE_SOCKET_URL || 'http://localhost:5000';

async function api(path, { method = 'GET', token = null, body = null } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Cookie = `fb_clone_token=${token}`;
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

async function loginToGetToken(identifier, password) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password }),
  });
  const setCookie = res.headers.get('set-cookie');
  const match = setCookie.match(/fb_clone_token=([^;]+)/);
  return decodeURIComponent(match[1]);
}

async function main() {
  const token1 = await loginToGetToken('test1@example.com', 'password123');
  const token2 = await loginToGetToken('alice', 'password123');

  const aliceMe = await api('/auth/me', { token: token2 });
  const aliceId = aliceMe.user.id;

  let convId = process.argv[2];
  if (!convId) {
    const conv = await api('/conversations', { method: 'POST', token: token1, body: { userId: aliceId } });
    convId = conv.conversation.id;
    console.log('created conv', convId);
  }

  const client1 = io(BASE, { auth: { token: token1 }, transports: ['websocket'] });
  const client2 = io(BASE, { auth: { token: token2 }, transports: ['websocket'] });

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timeout waiting for socket events')), 15000);

    client2.on('connect', () => console.log('alice connected'));
    client2.on('message:new', (data) => {
      console.log('REALTIME OK: alice received:', data?.message?.content);
      clearTimeout(timeout);
      client1.close();
      client2.close();
      resolve('PASS');
    });
    client2.on('connect_error', (e) => console.error('alice err', e.message));

    client1.on('connect', async () => {
      console.log('test user connected');
      client1.emit('message:send', {
        conversationId: convId,
        content: `Realtime hello ${new Date().toISOString()}`,
      });
    });
    client1.on('connect_error', (e) => console.error('testuser err', e.message));
  });
}

main()
  .then((r) => { console.log(r); process.exit(0); })
  .catch((e) => { console.error('FAIL:', e.message); process.exit(1); });