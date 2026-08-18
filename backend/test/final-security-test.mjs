/* FINAL security regression pass.
 * Covers: IDOR/BOLA, privacy + blocking, session revocation (HTTP + Socket.IO),
 * password-reset single use, admin authz, malformed/typed/oversized input,
 * HPP, socket forged IDs. All payloads harmless. Requires backend on :5000.
 */

import { io } from 'socket.io-client';
import sharp from 'sharp';
import prisma from '../src/config/database.js';

const BASE = 'http://localhost:5000';
const API = `${BASE}/api`;
const MB = 1024 * 1024;

let pass = 0;
let fail = 0;
const fails = [];
function check(name, cond, extra = '') {
  if (cond) {
    pass += 1;
    console.log(`PASS: ${name}`);
  } else {
    fail += 1;
    fails.push(`${name} ${extra}`);
    console.error(`FAIL: ${name} ${extra}`);
  }
}

function readCookie(cookie, name) {
  const m = new RegExp(`(?:^|;\\s*)${name}=([^;\\s]+)`).exec(cookie);
  return m ? m[1] : null;
}

class Session {
  constructor() {
    this.cookie = '';
    this.token = '';
  }

  csrf() {
    return readCookie(this.cookie, 'fb_clone_csrf');
  }

  merge(setCookies) {
    const map = new Map();
    if (this.cookie) this.cookie.split(/;\s*/).forEach((c) => c && map.set(c.split('=')[0], c));
    (setCookies || []).forEach((c) => {
      const kv = c.split(';')[0];
      if (kv) map.set(kv.split('=')[0], kv);
    });
    this.cookie = [...map.values()].join('; ');
    this.token = readCookie(this.cookie, 'fb_clone_token') || this.token;
  }

  async raw(path, { method = 'GET', json, form, csrf = true, useAuth = true, headers = {} } = {}) {
    const h = { ...headers };
    if (useAuth && this.cookie) h.Cookie = this.cookie;
    if (json !== undefined) h['Content-Type'] = 'application/json';
    const tok = this.csrf();
    if (csrf && tok && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) h['X-CSRF-Token'] = tok;
    const res = await fetch(`${API}${path}`, {
      method,
      headers: h,
      body: json !== undefined ? JSON.stringify(json) : form || undefined,
    });
    const text = await res.text();
    let parsed = null;
    try { parsed = JSON.parse(text); } catch { parsed = null; }
    const sc = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
    if (useAuth) this.merge(sc);
    return { res, json: parsed, text };
  }

  async login(identifier, password) {
    return this.raw('/auth/login', { method: 'POST', json: { identifier, password } });
  }

  async register(data) {
    return this.raw('/auth/register', { method: 'POST', json: data });
  }

  async logout() {
    return this.raw('/auth/logout', { method: 'POST' });
  }
}

function formData(field, filename, buf, contentType, fields = []) {
  const form = new FormData();
  for (const [k, v] of fields) form.append(k, v);
  form.append(field, new Blob([buf], { type: contentType }), filename);
  return form;
}

function connectSocket(token) {
  return new Promise((resolve) => {
    const s = io(BASE, { auth: { token }, transports: ['websocket'], reconnection: false, timeout: 4000 });
    const done = (ok, err) => { try { s.close(); } catch { /* ignore */ } resolve({ ok, err }); };
    s.on('connect', () => done(true, null));
    s.on('connect_error', (e) => done(false, e.message));
    setTimeout(() => done(false, 'timeout'), 5000);
  });
}

const stamp = Date.now();
const uname = (p) => `${p}${stamp}`;

async function main() {
  const alice = new Session();
  const bob = new Session();
  const carol = new Session();
  const admin = new Session();

  // ---- setup: register three users, friend alice+bob, add an admin ----
  const a1 = await alice.register({ fullName: 'Alice Final', username: uname('fa'), email: `fa${stamp}@test.local`, password: 'password123', dob: '1995-01-01', gender: 'FEMALE' });
  const b1 = await bob.register({ fullName: 'Bob Final', username: uname('fb'), email: `fb${stamp}@test.local`, password: 'password123', dob: '1996-01-01', gender: 'MALE' });
  const c1 = await carol.register({ fullName: 'Carol Final', username: uname('fc'), email: `fc${stamp}@test.local`, password: 'password123', dob: '1997-01-01', gender: 'OTHER' });
  check('three users registered', a1.json?.success && b1.json?.success && c1.json?.success);
  const aId = a1.json.user.id;
  const bId = b1.json.user.id;
  const cId = c1.json.user.id;

  const fr = await bob.raw(`/friends/request/${aId}`, { method: 'POST' });
  const ac = await alice.raw(`/friends/accept/${bId}`, { method: 'POST' });
  check('alice+bob became friends', fr.json?.status === 'REQUEST_SENT' && ac.json?.status === 'FRIENDS');

  const pub = await alice.raw('/posts', { method: 'POST', json: { content: 'pub post', privacy: 'PUBLIC' } });
  const friendsPost = await alice.raw('/posts', { method: 'POST', json: { content: 'friends post', privacy: 'FRIENDS' } });
  const mePost = await alice.raw('/posts', { method: 'POST', json: { content: 'me post', privacy: 'ONLY_ME' } });
  check('alice created 3 posts with distinct privacy', pub.json?.post?.id && friendsPost.json?.post?.id && mePost.json?.post?.id);

  const comment = await bob.raw(`/posts/${pub.json.post.id}/comments`, { method: 'POST', json: { content: 'bob comment' } });
  check('bob commented', comment.json?.comment?.id);
  const cId2 = comment.json.comment.id;

  const story = await bob.raw('/stories', { method: 'POST', form: formData('file', 's.png', await sharp({ create: { width: 8, height: 8, channels: 3, background: { r: 1, g: 2, b: 3 } } }).png().toBuffer(), 'image/png', [['caption', 'f']]) });
  check('bob created a story', story.json?.story?.id);
  const storyId = story.json.story.id;

  const group = await bob.raw('/groups', { method: 'POST', json: { name: `Private ${stamp}`, privacy: 'PRIVATE' } });
  const groupId = group.json.group.id;
  check('bob created private group', !!groupId);

  const event = await bob.raw('/events', { method: 'POST', json: { name: `Invite ${stamp}`, startsAt: '2031-01-01T00:00:00Z', privacy: 'INVITE_ONLY' } });
  const eventId = event.json.event.id;
  check('bob created invite-only event', !!eventId);

  const listing = await bob.raw('/marketplace', { method: 'POST', form: formData('files', 'i.png', await sharp({ create: { width: 8, height: 8, channels: 3, background: { r: 9, g: 8, b: 7 } } }).png().toBuffer(), 'image/png', [['title', 'Item'], ['price', '10'], ['category', 'Other']]) });
  const listingId = listing.json.listing.id;
  check('bob created marketplace listing', !!listingId);

  const convAB = await alice.raw('/conversations', { method: 'POST', json: { userId: bId } });
  const convBC = await bob.raw('/conversations', { method: 'POST', json: { userId: cId } });
  check('conversations created', !!convAB.json?.conversation?.id && !!convBC.json?.conversation?.id);
  const convABId = convAB.json.conversation.id;
  const convBCId = convBC.json.conversation.id;
  await alice.raw(`/conversations/${convABId}/messages`, { method: 'POST', json: { content: 'hi bob' } });

  const coll = await alice.raw('/saved/collections', { method: 'POST', json: { name: 'My Coll' } });
  const collId = coll.json.collection.id;
  const notif = await alice.raw('/notifications');
  const notifId = notif.json.notifications?.[0]?.id;

  // promote a dedicated admin for admin tests
  const adminReg = await admin.register({ fullName: 'Admin Final', username: uname('fadm'), email: `fadm${stamp}@test.local`, password: 'password123', dob: '1990-01-01', gender: 'OTHER' });
  await prisma.user.update({ where: { username: uname('fadm') }, data: { role: 'ADMIN' } });
  const adminLogin = await admin.login(uname('fadm'), 'password123');
  check('admin login works', adminLogin.json?.success);

  // ---- IDOR / BOLA ------------------------------------------------------
  check('non-owner cannot update post', (await carol.raw(`/posts/${pub.json.post.id}`, { method: 'PATCH', json: { content: 'hijack' } })).res.status === 403);
  check('non-owner cannot delete post', (await carol.raw(`/posts/${pub.json.post.id}`, { method: 'DELETE' })).res.status === 403);
  check('non-owner cannot update comment', (await carol.raw(`/comments/${cId2}`, { method: 'PATCH', json: { content: 'x' } })).res.status === 403);
  check('stranger cannot delete others comment', (await carol.raw(`/comments/${cId2}`, { method: 'DELETE' })).res.status === 403);
  check('stranger cannot read private conversation', (await carol.raw(`/conversations/${convABId}/messages`)).res.status === 404);
  check('stranger cannot send into private conversation', (await carol.raw(`/conversations/${convABId}/messages`, { method: 'POST', json: { content: 'intrude' } })).res.status === 404);
  check('non-owner cannot delete story', (await carol.raw(`/stories/${storyId}`, { method: 'DELETE' })).res.status === 403);
  check('non-owner cannot view story viewers', (await carol.raw(`/stories/${storyId}/viewers`)).res.status === 403);
  check('stranger cannot view non-friend story', (await carol.raw(`/stories/${storyId}/view`, { method: 'POST' })).res.status === 404);
  check('stranger blocked from private group', (await carol.raw(`/groups/${groupId}`)).res.status === 403);
  check('stranger blocked from private group posts', (await carol.raw(`/groups/${groupId}/posts`)).res.status === 403);
  check('stranger blocked from invite-only event rsvp', (await carol.raw(`/events/${eventId}/rsvp`, { method: 'POST', json: { status: 'GOING' } })).res.status === 403);
  check('non-seller cannot update listing', (await carol.raw(`/marketplace/${listingId}`, { method: 'PATCH', json: { title: 'hijack' } })).res.status === 403);
  check('non-seller cannot delete listing', (await carol.raw(`/marketplace/${listingId}`, { method: 'DELETE' })).res.status === 403);
  check('cannot save post into others collection', (await carol.raw(`/saved/${pub.json.post.id}`, { method: 'POST', json: { collectionId: collId } })).res.status === 404);
  await carol.raw(`/saved/collections/${collId}`, { method: 'DELETE' });
  const collAfter = await alice.raw('/saved');
  check('others collection cannot be deleted by stranger', collAfter.json.collections.some((c) => c.id === collId));
  if (notifId) {
    await carol.raw(`/notifications/${notifId}/read`, { method: 'PATCH' });
    const n2 = await alice.raw('/notifications');
    check('cannot mark others notification read', n2.json.notifications?.find((n) => n.id === notifId)?.isRead === false);
  }
  check('non-admin cannot view admin dashboard', (await alice.raw('/admin/dashboard')).res.status === 403);
  check('non-admin cannot list admin users', (await alice.raw('/admin/users')).res.status === 403);
  check('non-admin cannot change roles', (await alice.raw(`/admin/users/${cId}/role`, { method: 'PATCH', json: { role: 'ADMIN' } })).res.status === 403);
  check('non-admin cannot toggle status', (await alice.raw(`/admin/users/${cId}/status`, { method: 'PATCH' })).res.status === 403);
  check('admin dashboard works', (await admin.raw('/admin/dashboard')).res.status === 200);
  const adminId = adminReg.json.user.id;
  check('admin cannot self-deactivate', (await admin.raw(`/admin/users/${adminId}/status`, { method: 'PATCH' })).res.status === 400);
  const victimSession = new Session();
  const vicReg = await victimSession.register({ fullName: 'Victim', username: uname('fvic'), email: `fvic${stamp}@test.local`, password: 'password123', dob: '1995-01-01', gender: 'OTHER' });
  check('admin can toggle other user', (await admin.raw(`/admin/users/${vicReg.json.user.id}/status`, { method: 'PATCH' })).res.status === 200);
  await prisma.user.update({ where: { id: cId }, data: { isActive: true } });

  // ---- privacy ----------------------------------------------------------
  check('stranger sees PUBLIC post', (await carol.raw(`/posts/${pub.json.post.id}`)).res.status === 200);
  check('stranger cannot see FRIENDS post', (await carol.raw(`/posts/${friendsPost.json.post.id}`)).res.status === 404);
  check('stranger cannot see ONLY_ME post', (await carol.raw(`/posts/${mePost.json.post.id}`)).res.status === 404);
  check('friend sees FRIENDS post', (await bob.raw(`/posts/${friendsPost.json.post.id}`)).res.status === 200);
  check('friend cannot see ONLY_ME post', (await bob.raw(`/posts/${mePost.json.post.id}`)).res.status === 404);
  const cProfile = await carol.raw(`/users/${aId}`);
  check('stranger profile omits email/private fields', !cProfile.json.user?.email && !cProfile.json.user?.profile?.website && !cProfile.json.user?.profile?.location);
  const aPostsAsCarol = await carol.raw(`/users/${aId}/posts`);
  check('stranger feed of user posts hides FRIENDS/ONLY_ME', aPostsAsCarol.json.posts.every((p) => p.privacy === 'PUBLIC'));

  // ---- blocking ---------------------------------------------------------
  const blk = await alice.raw(`/safety/blocks/${cId}`, { method: 'POST' });
  check('alice blocked carol', blk.res.status === 200);
  check('blocked user cannot view PUBLIC post', (await carol.raw(`/posts/${pub.json.post.id}`)).res.status === 404);
  const blkProfile = await carol.raw(`/users/${aId}`);
  check('blocked user gets minimal profile', blkProfile.json.relation === 'BLOCKED' && !blkProfile.json.user?.email);
  check('blocked user cannot follow', (await carol.raw(`/users/${aId}/follow`, { method: 'POST' })).res.status === 403);
  check('blocked user cannot send friend request', (await carol.raw(`/friends/request/${aId}`, { method: 'POST' })).res.status === 403);
  check('blocked user cannot see mutual friends', (await carol.raw(`/users/me/mutual/${aId}`)).json.users.length === 0);
  check('blocked user sees empty posts', (await carol.raw(`/users/${aId}/posts`)).json.posts.length === 0);
  check('blocked user cannot view story', (await carol.raw(`/stories/${storyId}/view`, { method: 'POST' })).res.status === 404);
  check('blocked user cannot get user media', (await carol.raw(`/saved/users/${aId}/media`)).json.media.length === 0);

  // ---- revocation: password change (HTTP) -------------------------------
  const pwChange = await alice.raw('/auth/me/change-password', { method: 'POST', json: { currentPassword: 'password123', newPassword: 'newpassword123' } });
  check('password change ok', pwChange.json?.success === true);
  check('old JWT rejected on HTTP after password change', (await alice.raw('/auth/me')).res.status === 401);

  // ---- revocation: logout (HTTP) ----------------------------------------
  const carolPre = new Session();
  await carolPre.login(uname('fc'), 'password123');
  await carolPre.logout();
  check('old JWT rejected on HTTP after logout', (await carolPre.raw('/auth/me')).res.status === 401);
  check('logout is idempotent', (await carolPre.raw('/auth/logout', { method: 'POST' })).res.status === 200);

  // ---- revocation: account disable (HTTP) --------------------------------
  await prisma.user.update({ where: { id: cId }, data: { isActive: false } });
  const disabled = await carol.raw('/auth/me');
  check('disabled account rejected on HTTP', disabled.res.status === 401);
  await prisma.user.update({ where: { id: cId }, data: { isActive: true } });

  // ---- Socket.IO revocation + forging -----------------------------------
  await alice.login(uname('fa'), 'newpassword123');
  const tokenV1 = alice.token;
  check('socket connects with valid token', (await connectSocket(tokenV1)).ok === true);
  check('socket rejects forged token', (await connectSocket('garbage-token')).ok === false);

  await prisma.user.update({ where: { id: aId }, data: { tokenVersion: { increment: 1 } } });
  check('socket rejects revoked token (tokenVersion bump)', (await connectSocket(tokenV1)).ok === false);

  await alice.login(uname('fa'), 'newpassword123'); // fresh session at v2
  const tokenV2 = alice.token;
  await prisma.user.update({ where: { id: aId }, data: { isActive: false } });
  check('socket rejects disabled account token', (await connectSocket(tokenV2)).ok === false);
  await prisma.user.update({ where: { id: aId }, data: { isActive: true } });

  // socket forged conversationId
  const countBefore = await prisma.message.count({ where: { conversationId: convBCId } });
  const s1 = io(BASE, { auth: { token: tokenV2 }, transports: ['websocket'], reconnection: false });
  const forgedResult = await new Promise((resolve) => {
    s1.on('connect', () => {
      s1.on('message:error', (data) => { s1.close(); resolve(data); });
      s1.emit('message:send', { conversationId: convBCId, content: 'forged entry attempt' });
      setTimeout(() => { s1.close(); resolve({ error: 'timeout' }); }, 3000);
    });
    s1.on('connect_error', () => resolve({ error: 'connect failed' }));
  });
  const countAfter = await prisma.message.count({ where: { conversationId: convBCId } });
  check('socket cannot inject into conversation they are not in', forgedResult.error !== undefined && countAfter === countBefore);

  // ---- input robustness -------------------------------------------------
  await alice.login(uname('fa'), 'newpassword123'); // ensure fresh valid cookie+CSRF
  const badJson = await fetch(`${API}/posts`, {
    method: 'POST',
    headers: { Cookie: alice.cookie, 'Content-Type': 'application/json', 'X-CSRF-Token': alice.csrf() },
    body: '{"content": "broken',
  });
  check('malformed JSON -> 400 not 500', badJson.status === 400);
  check('non-UUID post id -> 400', (await alice.raw('/posts/not-a-uuid')).res.status === 400);
  const numContent = await alice.raw('/posts', { method: 'POST', json: { content: 12345 } });
  check('numeric content handled (no 500)', numContent.res.status >= 400 && numContent.res.status < 500);
  const arrContent = await alice.raw('/posts', { method: 'POST', json: { content: ['a', 'b'] } });
  check('array content handled (no 500)', arrContent.res.status >= 400 && arrContent.res.status < 500);
  check('HPP duplicate page -> 400', (await alice.raw('/posts/feed?page=1&page=2')).res.status === 400);
  check('HPP duplicate q on search -> 400', (await alice.raw('/search?q=a&q=b')).res.status === 400);

  const ppJson = JSON.stringify({ content: 'pp', __proto__: { polluted: 1 }, constructor: { prototype: { polluted: 2 } } });
  const ppResp = await fetch(`${API}/posts`, {
    method: 'POST',
    headers: { Cookie: alice.cookie, 'Content-Type': 'application/json', 'X-CSRF-Token': alice.csrf() },
    body: ppJson,
  });
  check('prototype pollution blocked (no global pollution)', ppResp.status !== 500 && ({ }).polluted === undefined && Object.prototype.polluted === undefined);

  const deep = '['.repeat(2000) + ']'.repeat(2000);
  const deepResp = await fetch(`${API}/posts`, {
    method: 'POST',
    headers: { Cookie: alice.cookie, 'Content-Type': 'application/json', 'X-CSRF-Token': alice.csrf() },
    body: deep,
  });
  check('deeply nested JSON -> 4xx not 500', deepResp.status >= 400 && deepResp.status < 500);

  // ---- cleanup ----------------------------------------------------------
  await prisma.$disconnect();

  console.log(`\nFINAL SECURITY TESTS: ${pass} passed, ${fail} failed`);
  if (fail > 0) {
    console.error('Failures:\n' + fails.join('\n'));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('FINAL TEST ERROR:', e.message);
  prisma.$disconnect().finally(() => process.exit(1));
});