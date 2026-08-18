/* Simple E2E API smoke test. Requires the backend running on :5000. */

const BASE = 'http://localhost:5000/api';
const CSRF_COOKIE = 'fb_clone_csrf';

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exitCode = 1;
    throw new Error(msg);
  }
  console.log('PASS:', msg);
}

function mergeCookie(existing, setCookies) {
  const map = new Map();
  if (existing) {
    existing.split(/;\s*/).forEach((c) => {
      if (c) map.set(c.split('=')[0], c);
    });
  }
  (setCookies || []).forEach((c) => {
    const kv = c.split(';')[0];
    if (kv) map.set(kv.split('=')[0], kv);
  });
  return [...map.values()].join('; ');
}

async function api(path, { method = 'GET', cookie = null, body = null } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (cookie) headers.Cookie = cookie;

  const csrf = cookie ? /(?:^|;\s*)fb_clone_csrf=([^;\s]+)/.exec(cookie)?.[1] : null;
  if (csrf && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    headers['X-CSRF-Token'] = csrf;
  }

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();

  // Node exposes each Set-Cookie header separately via getSetCookie().
  const setCookies = typeof res.headers.getSetCookie === 'function'
    ? res.headers.getSetCookie()
    : (res.headers.get('set-cookie') ? [res.headers.get('set-cookie')] : []);
  const merged = mergeCookie(cookie, setCookies);

  return { res, json, cookie: merged };
}

async function main() {
  const stamp = Date.now();
  const user = `u${stamp}`;
  const other = `o${stamp}`;
  const suffix = `${stamp}@test.local`;

  // register both users
  const reg = await api('/auth/register', {
    method: 'POST',
    body: { fullName: 'Test User', username: user, email: `t-${suffix}`, password: 'password123', dob: '1995-05-05', gender: 'MALE' },
  });
  assert(reg.json.success === true, 'register user');

  const reg2 = await api('/auth/register', {
    method: 'POST',
    body: { fullName: 'Other User', username: other, email: `o-${suffix}`, password: 'password123', dob: '1996-06-06', gender: 'FEMALE' },
  });
  assert(reg2.json.success === true, 'register second user');
  const cookie1 = reg.cookie;
  const cookie2 = reg2.cookie;

  // login via username
  const login = await api('/auth/login', { method: 'POST', body: { identifier: user, password: 'password123' } });
  assert(login.json.success === true, 'login with username');

  // me
  const user1 = (await api('/auth/me', { cookie: cookie1 })).json.user;
  const user2 = (await api('/auth/me', { cookie: cookie2 })).json.user;
  assert(user1 && user1.username === user, 'auth/me returns current user');

  // friend request + accept
  const fr = await api(`/friends/request/${user2.id}`, { method: 'POST', cookie: cookie1 });
  assert(fr.json.status === 'REQUEST_SENT', 'friend request sent');
  const ac = await api(`/friends/accept/${user1.id}`, { method: 'POST', cookie: cookie2 });
  assert(ac.json.status === 'FRIENDS', 'friend request accepted');

  // create post with media via multipart is skipped (fileless core covered)
  const post = (await api('/posts', { method: 'POST', cookie: cookie1, body: { content: `Hello ${stamp}` } })).json.post;
  assert(post && post.id, 'create post');

  // feed
  const feed = (await api('/posts/feed?limit=5', { cookie: cookie2 })).json;
  assert(feed.posts.some((p) => p.id === post.id), 'post appears in friend feed');

  // like + comment + reply
  const like = (await api(`/posts/${post.id}/reactions`, { method: 'POST', cookie: cookie2, body: { type: 'LIKE' } })).json;
  assert(like.active === true, 'reaction added');

  const comment = (await api(`/posts/${post.id}/comments`, { method: 'POST', cookie: cookie2, body: { content: 'Nice!' } })).json.comment;
  assert(comment.id, 'comment created');

  const reply = (await api(`/posts/${post.id}/comments`, { method: 'POST', cookie: cookie1, body: { content: 'Thanks', parentId: comment.id } })).json.comment;
  assert(reply.parentId === comment.id, 'reply created');

  // notifications
  const notifs = (await api('/notifications', { cookie: cookie1 })).json;
  assert(notifs.total >= 2, 'notifications generated for liked/commented post');

  // conversation + message
  const conv = (await api('/conversations', { method: 'POST', cookie: cookie1, body: { userId: user2.id } })).json.conversation;
  assert(conv.id, 'conversation created');

  const msg = (await api(`/conversations/${conv.id}/messages`, { method: 'POST', cookie: cookie1, body: { content: 'hi' } })).json.message;
  assert(msg.id, 'message persisted');

  const readBack = (await api(`/conversations/${conv.id}/messages`, { cookie: cookie2 })).json.messages;
  assert(readBack.some((m) => m.id === msg.id), 'message readable by recipient');

  // search
  const search = (await api(`/search?q=${other}`, { cookie: cookie1 })).json;
  assert(search.users.some((u) => u.username === other), 'search finds user');

  // logout + login again
  await api('/auth/logout', { method: 'POST', cookie: cookie1 });
  const again = (await api('/auth/login', { method: 'POST', body: { identifier: `t-${suffix}`, password: 'password123' } }));
  assert(again.json.success === true, 'login again after logout');

  console.log('\nAll backend E2E checks passed.');
}

main().catch((e) => {
  if (process.exitCode !== 1) console.error('E2E failed:', e.message);
  process.exit(process.exitCode || 1);
});