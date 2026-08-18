# Facebook-Style Social Network Clone

A complete, full-stack, high-fidelity Facebook-style social networking application. Real authentication, real friends, real-time messaging, notifications, stories, groups, events, marketplace, saved collections, blocking and reporting — all persisted in PostgreSQL.

## Tech Stack

| Layer     | Technology                                        |
| --------- | ------------------------------------------------- |
| Frontend  | React 18, Vite 5, React Router 6, Axios, Socket.IO client, Context API |
| Backend   | Node.js, Express.js, Socket.IO, REST API          |
| Database  | PostgreSQL 17 + Prisma ORM                        |
| Auth      | bcrypt password hashing, JWT in HTTP-only cookies, auth/authorization middleware |
| Security  | helmet, CORS, express-rate-limit, input validation (express-validator), upload validation, ownership checks |

## Project Structure

```
facebook-clone/
├── frontend/            # React + Vite SPA
│   ├── public/
│   └── src/
│       ├── components/  # navbar, sidebar, post, comments, stories, messenger, ...
│       ├── pages/       # auth, home, profile, friends, messages, groups, events, ...
│       ├── context/     # AuthContext, SocketContext, ToastContext
│       ├── services/    # api.js + typed service modules
│       ├── hooks/ utils/ constants/ routes/
│       ├── App.jsx main.jsx index.css
├── backend/             # Node.js + Express API
│   ├── src/
│   │   ├── config/      # env.js, database.js
│   │   ├── controllers/ services/ routes/ middleware/ validators/ utils/
│   │   ├── sockets/     # Socket.IO realtime
│   │   ├── uploads/     # local file storage (storage-abstraction ready)
│   │   ├── app.js server.js
│   ├── prisma/          # schema.prisma + migrations
│   └── test/            # security suites + E2E + cleanup helpers
└── package.json         # root scripts
```

## Requirements

- Node.js >= 18
- PostgreSQL >= 14 running on `localhost:5432`

## Database Setup

1. Create the database:

```sql
CREATE DATABASE facebook_clone;
```

2. Configure the backend environment:

```bash
cd backend
copy .env.example .env
# edit .env -> set DATABASE_URL and JWT_SECRET
```

3. Run migrations:

```bash
cd backend
npx prisma migrate dev
```

## Install & Run

```bash
# From the repository root
npm run install:all      # installs frontend + backend deps
npm run migrate          # applies Prisma migrations
npm run dev              # runs backend (:5000) + frontend (:5173) together
```

Or run them separately:

```bash
cd backend && npm run dev       # API + Socket.IO on http://localhost:5000
cd frontend && npm run dev      # SPA on http://localhost:5173
```

## Root Scripts

| Command | Description |
| --- | --- |
| `npm run install:all` | Installs frontend + backend dependencies (backend `postinstall` runs `prisma generate`) |
| `npm run dev` | Runs backend (:5000) + frontend (:5173) together via `concurrently` |
| `npm run dev:backend` / `dev:frontend` | Run one side only |
| `npm run build` | Builds the production frontend into `frontend/dist` |
| `npm start` | Starts the backend (serves the built SPA too, if `frontend/dist` exists) |
| `npm run migrate` / `migrate:deploy` | Apply Prisma migrations (dev / production) |
| `npm run seed` | Runs the Prisma seed |
| `npm run lint` / `lint:frontend` | ESLint for backend / frontend |
| `npm test` | Backend E2E API smoke test |

## Environment Variables

Backend `.env`:

```
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/facebook_clone?schema=public"
JWT_SECRET="a-long-random-secret"
PORT=5000
CLIENT_URL="http://localhost:5173"
ALLOWED_ORIGINS="http://localhost:5173"
NODE_ENV=development
MAX_UPLOAD_SIZE_MB=10
```

Frontend `.env` (optional — same-origin is the default):

```
VITE_API_URL=/api
VITE_SOCKET_URL=
VITE_APP_NAME=ornaConnect
```

When the backend serves the SPA (single-server deploys) no frontend values are
needed. Set `VITE_API_URL` / `VITE_SOCKET_URL` only when the API/Socket host
differs from the frontend host (see Option B below).

Never commit real `.env` files — only `.env.example` is committed.

## Deployment

### Option A — Single server (simplest)

One Node process serves both the built frontend and the API. When the backend
starts and `frontend/dist` exists, Express serves the SPA with `/api`,
`/uploads` and `/socket.io` handled by the backend (all same-origin, so no
cross-origin config needed).

```bash
# 1. Install (postinstall runs `prisma generate` automatically)
npm run install:all

# 2. Configure environment (production)
cd backend
copy .env.example .env
#   DATABASE_URL  -> your PostgreSQL connection string
#   JWT_SECRET    -> random, >= 32 characters
#   NODE_ENV=production
#   CLIENT_URL=https://your-domain.com
#   ALLOWED_ORIGINS=https://your-domain.com
#   TRUST_PROXY=1 (when behind nginx/caddy, so rate limiting uses real client IPs)

# 3. Apply database migrations
npm run migrate:deploy

# 4. Build the frontend (produces frontend/dist)
cd .. && npm run build

# 5. Start the server
npm start        # or: cd backend && npm start
```

Recommended: run under a process manager (`pm2 start backend/src/server.js --name facebook-clone`)
and put nginx/caddy in front for TLS:

```nginx
location / {
    proxy_pass http://127.0.0.1:5000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;     # needed for Socket.IO
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

### Option B — Split hosting (frontend + API separately)

Build the frontend and serve `frontend/dist` from any static host; point the
API and Socket.IO URLs at the backend host:

```
VITE_API_URL=https://api.your-domain.com/api
VITE_SOCKET_URL=https://api.your-domain.com
```

Set `CLIENT_URL` and `ALLOWED_ORIGINS` on the backend to the frontend origin
and set `TRUST_PROXY=1` behind the TLS proxy. Cookies are `Secure` when
`NODE_ENV=production`, so the site must be served over HTTPS.

### Deployment checklist

- `JWT_SECRET` is set to a random ≥32-char value (the server refuses to start otherwise).
- `DATABASE_URL` points at the production PostgreSQL; run `npm run migrate:deploy`.
- `NODE_ENV=production` and `TRUST_PROXY=1` behind a reverse proxy.
- `ALLOWED_ORIGINS` / `CLIENT_URL` match your frontend origin.
- Persistent storage: keep `backend/uploads` outside the deployment directory
  (set `UPLOAD_DIR`), and back it up — uploaded media lives there.
- Reset/verification tokens are shown on screen (no mail server is configured).
- Never commit `.env` files.

## Features

- **Auth**: register (name, username, email, password, DOB, gender), login by email/username, HTTP-only JWT cookie, `/api/auth/me` session restore, logout.
- **Home**: three-column desktop layout (left nav, feed, right sidebar), dedicated mobile layout with bottom navigation.
- **Posts**: composer modal, multiple image/video upload with previews, audience selector (Public/Friends/Only Me), privacy-aware feed, lazy infinite scroll, edit/delete/save/hide/report/copy-link.
- **Reactions**: Like, Love, Haha, Wow, Sad, Angry — hover picker, persisted, optimistic updates, live summary.
- **Comments**: nested replies, reactions, edit, delete, load-more pagination.
- **Friends**: request → accept/reject, mutual friends, friend suggestions, friend pages, states NONE / REQUEST_SENT / REQUEST_RECEIVED / FRIENDS / BLOCKED.
- **Follow**: follow/unfollow with follow counts.
- **Messenger**: conversation list, real-time messages via Socket.IO, typing indicator, online status, unread badges, read receipts, message persistence in PostgreSQL.
- **Notifications**: real events for likes, comments, replies, friend requests/accepts, follows, messages; read/unread state, dropdown + page, notification preferences.
- **Search**: debounced backend search across users, posts, groups with navbar dropdown + full search page.
- **Stories**: create (image/video) with 24h expiration, progress viewer, next/prev, viewed status.
- **Groups**: create, join/leave, group posts, public/private/closed.
- **Events**: create, RSVP (going/interested), public/friends.
- **Saved**: save posts, view saved, collections.
- **Marketplace**: listings with categories, conditions, prices, images; create/update/delete.
- **Settings**: edit profile, notification preferences, blocked users (block/unblock).
- **Safety**: block users, report posts/users/comments; rate limiting.
- **Responsive**: fully responsive from 320px to 1920px+.

## API Overview

All endpoints under `/api`. Auth-protected via HTTP-only cookie (all non-GET
requests also require the `X-CSRF-Token` header — see Security Notes).

```
POST /api/auth/register | login | logout          GET /api/auth/me
POST /api/auth/me/verify-email  POST /api/auth/me/change-password
GET  /api/users/:id   PATCH /api/users/me   PATCH /api/users/me/avatar | cover
GET  /api/users/:id/posts|friends|followers|following
POST/DELETE /api/users/:id/follow
GET  /api/posts/feed   POST /api/posts   GET/PATCH/DELETE /api/posts/:id
POST/DELETE /api/posts/:id/reactions
GET/POST /api/posts/:id/comments   PATCH/DELETE /api/comments/:id
POST /api/friends/request|accept|reject|cancel/:userId   DELETE /api/friends/:userId
GET  /api/notifications   PATCH /api/notifications/:id/read
PATCH /api/notifications/read-all   GET/PATCH /api/notifications/settings
GET/POST /api/conversations   GET/POST /api/conversations/:id/messages
PATCH /api/conversations/:id/read
GET/POST /api/stories   POST /api/stories/:id/view
GET /api/stories/:id/viewers   DELETE /api/stories/:id
GET  /api/search?q=   GET /api/search/trending
GET/POST /api/groups   GET /api/groups/:id
POST /api/groups/:id/join|leave   GET/POST /api/groups/:id/posts
GET/POST /api/events   GET /api/events/:id
GET/POST /api/marketplace   GET/PATCH/DELETE /api/marketplace/:id
GET  /api/saved   POST /api/saved/:postId
POST/DELETE /api/saved/collections
GET  /api/safety/blocked   POST/DELETE /api/safety/blocks/:userId
POST /api/reports
GET  /api/admin/dashboard|users|reports
```

Full route list: `backend/src/routes/`.

## Database Schema

28 models in `backend/prisma/schema.prisma`: User, Profile, Post, PostMedia, Reaction, Comment, CommentReaction, FriendRequest, Friendship, Follow, Notification, NotificationSetting, Conversation, ConversationParticipant, Message, MessageRead, Story, StoryView, Group, GroupMember, GroupPost, Event, EventMember, SavedPost, Collection, MarketplaceListing, Block, Report.

UUID primary keys, foreign keys, unique constraints, indexes, timestamps and cascade behavior throughout.

## Testing

All backend suites require the backend to be running (`npm run dev`):

| Command | What it checks |
| --- | --- |
| `npm run test:security` | 35 security checks — auth + token revocation, rate limiting, upload validation & sanitization, path traversal, HPP, prototype pollution, oversized payloads |
| `npm run test:final` | 68 final security checks — Socket.IO auth/membership, IDOR, malformed & deeply nested input (no 500s) |
| `npm test` | E2E API smoke test — register → friends → posts → reactions → comments → notifications → messaging → search → logout |
| `node test/media-sanitize-check.mjs` | Socket media URL sanitization (6 checks) |
| `node test/realtime-test.mjs` | Real-time Socket.IO round-trip test |
| `node test/cleanup-test-data.mjs` | Removes test users + orphaned uploads (keeps the `saam` / `sam` demo accounts) |

Linting:

```bash
npm run lint            # backend ESLint (root or backend/)
npm run lint:frontend   # frontend ESLint
npm run build           # verifies the frontend production build
```

The upload rate limiter allows ~20 uploads/minute/IP, so keep a short pause
between running `test:security` and `test:final` back-to-back.

## File Uploads

Uploads are stored in `backend/uploads/` and served at `/uploads/*`. The
storage location is configured via `UPLOAD_DIR` (defaults to
`backend/uploads`) and isolated in `backend/src/services/storageService.js` so
it can be swapped for S3/cloud storage without touching controllers.

Media is removed from disk whenever its post / story / marketplace listing is
deleted, and a scheduled job (`utils/mediaCleanup.js`) sweeps expired 24h
stories plus any orphaned files at startup and hourly.

## Security Notes

- Passwords hashed with bcrypt (12 rounds) — never stored in plaintext.
- JWT in a secure HTTP-only `SameSite` cookie; a `tokenVersion` claim lets
  logout / account deactivation invalidate every issued token instantly.
- CSRF protection via double-submit: every non-GET request must match the
  `fb_clone_csrf` cookie with the `X-CSRF-Token` header (timing-safe compare).
- Media validated (extension + MIME + magic bytes), re-encoded via `sharp`,
  and served with `X-Content-Type-Options: nosniff` plus a CSP `sandbox`.
- Privacy enforced server-side: `ONLY_ME` / `Friends` posts are hidden from
  feeds, profiles, search and saved lists unless the viewer has access.
- Blocking enforced app-wide (feeds, marketplace, friend states) — a block
  always wins over a pre-existing friendship.
- Rate limiting: strict on auth routes, 20 uploads/min/IP, plus API-wide
  limiter; the server refuses to boot without a ≥32-char `JWT_SECRET`.
- Input validation with `express-validator` (including UUID params); malformed
  JSON and oversized bodies return 4xx — never 500.
- Ownership + authorization checks on every read/edit/delete route (posts,
  comments, messages, groups, events, marketplace, saves).
- Socket.IO connections authenticated against the same JWT, rate-limited, and
  restricted to conversations the caller is a member of; multi-tab presence
  is tracked per socket.
- Centralized error middleware returns `{ success: false, message }` — never
  raw stack traces or internals.
- SQL injection protection via Prisma parameterized queries; `helmet` security
  headers; strict CORS allow-list.
- Frontend: app-wide error boundary, bounded Socket.IO reconnection, and
  object-URL cleanup to prevent memory leaks.
