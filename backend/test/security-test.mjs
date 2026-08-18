/* Security regression tests. Runs against the live backend on :5000.
 * All payloads are harmless (fake HTML/SVG/EXE bytes, oversized junk, crafted
 * multipart names) — nothing here can damage the machine or the database.
 * Usage: npm run test:security   (requires backend running)
 */

import sharp from 'sharp';
import http from 'http';

const BASE = 'http://localhost:5000';
const API = `${BASE}/api`;

let cookie = '';

const results = [];
function check(name, cond, extra = '') {
  if (cond) {
    console.log(`PASS: ${name}`);
    results.push(true);
  } else {
    console.error(`FAIL: ${name} ${extra}`);
    results.push(false);
  }
}

function csrfToken() {
  const m = /(?:^|;\s*)fb_clone_csrf=([^;\s]+)/.exec(cookie);
  return m ? m[1] : null;
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

async function request(path, { method = 'GET', json, form, csrf = true, authed = true } = {}) {
  const headers = {};
  if (authed && cookie) headers.Cookie = cookie;
  if (json !== undefined) headers['Content-Type'] = 'application/json';
  const tok = csrfToken();
  if (csrf && tok && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) headers['X-CSRF-Token'] = tok;

  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: json !== undefined ? JSON.stringify(json) : form || undefined,
  });
  const text = await res.text();
  let parsed = null;
  try { parsed = JSON.parse(text); } catch { parsed = null; }
  const setCookies = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
  if (authed) cookie = mergeCookie(cookie, setCookies);
  return { res, json: parsed, text };
}

async function loginOrRegister(identifier, password) {
  let r = await request('/auth/login', { method: 'POST', json: { identifier, password } });
  if (r.json && r.json.success) return r.json.user;
  const stamp = Date.now();
  const uname = `sec${stamp}`;
  const reg = await request('/auth/register', {
    method: 'POST',
    json: {
      fullName: `Sec ${stamp}`,
      username: uname,
      email: `sec-${stamp}@test.local`,
      password: 'password123',
      dob: '1990-01-01',
      gender: 'MALE',
    },
  });
  if (!reg.json || !reg.json.success) throw new Error('could not login or register');
  return reg.json.user;
}

function uploadForm(field, filename, buf, contentType, fields = []) {
  const form = new FormData();
  for (const [k, v] of fields) form.append(k, v);
  form.append(field, new Blob([buf], { type: contentType }), filename);
  return form;
}

async function main() {
  const user = await loginOrRegister('testuser', 'TestPass123');
  const user2 = await loginOrRegister(`sec2-${Date.now()}`, 'password123');
  // register() sets the session cookie to the new user; switch back to testuser
  await loginOrRegister('testuser', 'TestPass123');
  console.log(`authed as ${user.username}`);

  // ---- media fixtures -------------------------------------------------
  const png = await sharp({ create: { width: 12, height: 12, channels: 3, background: { r: 255, g: 0, b: 0 } } }).png().toBuffer();
  const jpg = await sharp({ create: { width: 12, height: 12, channels: 3, background: { r: 0, g: 0, b: 255 } } }).jpeg().toBuffer();
  const gif = await sharp({ create: { width: 12, height: 12, channels: 3, background: { r: 0, g: 255, b: 0 } } }).gif().toBuffer();
  const webp = await sharp({ create: { width: 12, height: 12, channels: 3, background: { r: 0, g: 0, b: 255 } } }).webp().toBuffer();
  const fakeMp4 = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypisom'), Buffer.alloc(16)]);
  const html = Buffer.from('<!DOCTYPE html><html><body><script>alert(1)</script></body></html>');
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><rect width="10" height="10"/></svg>');

  const rejections = [
    ['svg payload', 'evil.svg', svg, 'image/svg+xml', []],
    ['html disguised as jpg', 'photo.html', html, 'image/jpeg', []],
    ['exe disguised as jpg', 'malware.exe', jpg, 'image/jpeg', []],
    ['php', 'evil.php', Buffer.from('<?php system($_GET["c"]); ?>'), 'image/jpeg', []],
    ['double extension', 'img.jpg.exe', jpg, 'image/jpeg', []],
    ['mismatched content (html bytes as jpg)', 'x.jpg', html, 'image/jpeg', []],
    ['path traversal name', '..\\..\\..\\server.js', jpg, 'image/jpeg', []],
  ];

  for (const [label, filename, buf, mime, fields] of rejections) {
    let r;
    try {
      r = await request('/users/me/avatar', { method: 'PATCH', form: uploadForm('file', filename, buf, mime, fields) });
    } catch {
      r = { res: { status: 0 } };
    }
    check(`reject upload: ${label} (got ${r.res.status})`, r.res.status >= 400);
  }

  // oversized file on a 5MB-limited route (avatar) -> 413
  const big = Buffer.alloc(6 * 1024 * 1024, 0xff);
  const bigRes = await request('/users/me/avatar', { method: 'PATCH', form: uploadForm('file', 'big.jpg', big, 'image/jpeg') });
  check(`reject oversized file (avatar >5MB) got ${bigRes.res.status}`, bigRes.res.status === 413);

  // control char in filename -> either rejected outright, or (if the client
  // strips it) the stored name must still be server-generated, never the raw
  // user input.
  const ctrlRes = await request('/users/me/avatar', { method: 'PATCH', form: uploadForm('file', 'bad\nname.jpg', jpg, 'image/jpeg') });
  const storedName = ctrlRes.json?.user?.profile?.avatarUrl || '';
  const serverControlled = /^\/uploads\/\d+-[A-Za-z0-9]+\.jpg$/.test(storedName);
  check(`control char in filename handled safely (got ${ctrlRes.res.status}, stored=${storedName || 'none'})`, ctrlRes.res.status >= 400 || serverControlled);

  // no CSRF header -> 403
  const noCsrf = await fetch(`${API}/posts`, {
    method: 'POST',
    headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: 'no csrf attempt' }),
  });
  check(`reject state-changing request without CSRF token (got ${noCsrf.status})`, noCsrf.status === 403);

  // no auth -> 401
  const noAuth = await fetch(`${API}/posts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: 'anon attempt' }),
  });
  check(`reject request without auth (got ${noAuth.status})`, noAuth.status === 401);

  // ---- valid uploads --------------------------------------------------
  const av = await request('/users/me/avatar', { method: 'PATCH', form: uploadForm('file', 'me.jpg', jpg, 'image/jpeg') });
  check('valid avatar upload', av.json && av.json.user && av.json.user.profile && /^\/uploads\//.test(av.json.user.profile.avatarUrl || ''), av.text);
  const avatarUrl = av.json?.user?.profile?.avatarUrl;

  const post = await request('/posts', { method: 'POST', form: uploadForm('files', 'a.png', png, 'image/png', [['content', 'sec test post']]) });
  check('valid post upload', post.json && post.json.post && post.json.post.media && post.json.post.media.length === 1, post.text);

  const post2 = await request('/posts', { method: 'POST', form: uploadForm('files', 'b.webp', webp, 'image/webp', [['content', 'sec test post 2']]) });
  check('valid multi-file post upload', post2.json && post2.json.post && post2.json.post.media && post2.json.post.media.length === 1, post2.text);

  const story = await request('/stories', { method: 'POST', form: uploadForm('file', 's.gif', gif, 'image/gif', [['caption', 'sec story']]) });
  check('valid story upload', story.json && story.json.story && /^\/uploads\//.test(story.json.story.url || ''), story.text);

  const listing = await request('/marketplace', {
    method: 'POST',
    form: uploadForm('files', 'item.webp', webp, 'image/webp', [['title', 'sec item'], ['price', '9.99'], ['category', 'Electronics']]),
  });
  check('valid marketplace upload', listing.json && listing.json.listing && listing.json.listing.images && listing.json.listing.images.length === 1, listing.text);

  const group = await request('/groups', { method: 'POST', json: { name: `Sec Group ${Date.now()}`, privacy: 'PUBLIC' } });
  check('create group for group-post test', group.json && group.json.group && group.json.group.id, group.text);
  if (group.json?.group?.id) {
    const gp = await request(`/groups/${group.json.group.id}/posts`, { method: 'POST', form: uploadForm('file', 'g.jpg', jpg, 'image/jpeg', [['content', 'sec group post']]) });
    check('valid group post upload', gp.json && gp.json.post && gp.json.post.mediaUrl && /^\/uploads\//.test(gp.json.post.mediaUrl), gp.text);
  }

  const event = await request('/events', {
    method: 'POST',
    form: uploadForm('file', 'cover.png', png, 'image/png', [['name', 'Sec Event'], ['startsAt', '2030-01-01T10:00:00Z']]),
  });
  check('valid event cover upload', event.json && event.json.event && event.json.event.coverUrl && /^\/uploads\//.test(event.json.event.coverUrl), event.text);

  const conv = await request('/conversations', { method: 'POST', json: { userId: user2.id } });
  check('create conversation for message test', conv.json && conv.json.conversation && conv.json.conversation.id, conv.text);
  if (conv.json?.conversation?.id) {
    const msg = await request(`/conversations/${conv.json.conversation.id}/messages`, {
      method: 'POST',
      form: uploadForm('file', 'clip.mp4', fakeMp4, 'video/mp4', [['content', 'sec clip']]),
    });
    check('valid message media upload', msg.json && msg.json.message && msg.json.message.mediaType === 'VIDEO' && /^\/uploads\/.*\.mp4$/.test(msg.json.message.mediaUrl || ''), msg.text);
  }

  // ---- media serving headers ------------------------------------------
  if (avatarUrl) {
    const media = await fetch(`${BASE}${avatarUrl}`);
    check(`media served with 200 (${avatarUrl})`, media.status === 200);
    check('media nosniff header', (media.headers.get('x-content-type-options') || '').toLowerCase() === 'nosniff');
    check('media CSP sandbox header', (media.headers.get('content-security-policy') || '').includes('sandbox'));
    check('media content-type allowlisted', ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes((media.headers.get('content-type') || '').split(';')[0]));
  }

  // ---- media access hardening -----------------------------------------
  const trav1 = await fetch(`${BASE}/uploads/..%2f..%2fpackage.json`);
  check(`path traversal via uploads 404 (got ${trav1.status})`, trav1.status === 404);
  const trav2 = await fetch(`${BASE}/uploads/..%2F..%2F.env`);
  check(`path traversal to .env 404 (got ${trav2.status})`, trav2.status === 404);
  const rand = await fetch(`${BASE}/uploads/1234567890123-NopeNopeNope.jpg`);
  check(`nonexistent media 404 (got ${rand.status})`, rand.status === 404);
  const weird = await fetch(`${BASE}/uploads/../../src/server.js`);
  const weirdText = await weird.text();
  // fetch normalizes ../ and %2e%2e client-side, so this becomes a plain SPA
  // route in single-server production mode. The property that matters: it must
  // never disclose backend source — either a 404, or the SPA shell (no code).
  check(`raw traversal path never discloses server files (got ${weird.status})`, weird.status === 404 || !weirdText.includes('createServer'));

  // Send the literal ".." path un-normalized (as curl --path-as-is / custom
  // clients do) — the server-side traversal guard must reject it outright.
  const raw = await new Promise((resolve, reject) => {
    const req = http.request({ host: 'localhost', port: 5000, path: '/uploads/../../src/server.js', method: 'GET' }, (res) => {
      let body = '';
      res.on('data', (d) => { body += d; });
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.end();
  });
  check(`raw ../ traversal rejected by server (got ${raw.status})`, raw.status === 404, raw.body);

  // ---- app-level guards -----------------------------------------------
  const pollute = await request('/posts', { method: 'POST', json: { content: 'pollute probe', __proto__: { polluted: true } } });
  check(`prototype pollution probe does not break post creation (got ${pollute.res.status})`, pollute.json && pollute.json.post && pollute.json.post.content === 'pollute probe', pollute.text);

  const hpp = await fetch(`${API}/search?q=zz&q=yy`, { headers: { Cookie: cookie } });
  check(`HPP probe handled (got ${hpp.status})`, hpp.status === 200 || hpp.status === 400);

  const bigJson = Buffer.alloc(3 * 1024 * 1024, 0x61).toString();
  const bigJsonRes = await request('/posts', { method: 'POST', json: { content: bigJson } });
  check(`oversized JSON body rejected (got ${bigJsonRes.res.status})`, bigJsonRes.res.status === 413, bigJsonRes.text);

  const badLogin = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'testuser', password: 'wrong-password' }),
  });
  check(`wrong password rejected (got ${badLogin.status})`, badLogin.status === 401);

  const missing = await fetch(`${API}/nope`, { headers: { Cookie: cookie } });
  check(`unknown route 404 (got ${missing.status})`, missing.status === 404);

  // ---- best-effort cleanup --------------------------------------------
  if (post.json?.post?.id) await request(`/posts/${post.json.post.id}`, { method: 'DELETE' });
  if (story.json?.story?.id) await request(`/stories/${story.json.story.id}`, { method: 'DELETE' });
  if (listing.json?.listing?.id) await request(`/marketplace/${listing.json.listing.id}`, { method: 'DELETE' });

  const passed = results.filter(Boolean).length;
  const failed = results.length - passed;
  console.log(`\nSecurity tests: ${passed} passed, ${failed} failed (of ${results.length})`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error('SECURITY TEST ERROR:', e.message);
  process.exit(1);
});