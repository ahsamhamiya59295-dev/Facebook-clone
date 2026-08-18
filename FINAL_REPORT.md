# Final Report — Facebook Clone Security & Quality Hardening

Verification date: 2026-08-15

---

## A. Security vulnerabilities found

### A1. Socket.IO conversation/message injection
```text
Vulnerability: Any authenticated socket could emit message:send/typing/read into ANY conversation id
Severity: Critical
Affected file: backend/src/sockets/socket.js
Affected endpoint: socket.io events `message:send`, `typing`, `read`
Why it was dangerous: Full bypass of conversation privacy — send/read messages in any thread at will
Fix implemented: Member/participant check before every event; block checks between direct-message users; sendMessage now routed through messageService; in-memory rate limit (20 events / 10s window)
How it was tested: Code review + socket event path trace; rate limiter unit-walked
```

### A2. Profile PII exposure (email, dob, phone, etc.)
```text
Vulnerability: Email was returned on ANY public profile lookup
Severity: Critical
Affected file: backend/src/services/userService.js, controllers/userController.js
Affected endpoint: GET /users/:id, GET /users/by-username/:username
Why it was dangerous: Mass email harvesting for phishing/spam; dob/phone leaked globally
Fix implemented: sanitizePublicUser — viewer-aware. email visible only to self; dob only to friends or PUBLIC+birthdayVisibility profiles; private fields (phone/site/education) stripped for non-friends on non-PUBLIC profiles; BLOCKED users see bare identity only
How it was tested: Live — Bob blocked Alice; GET /users/:aliceId returned {id, username, fullName, profile{avatar,cover}} + relation BLOCKED, no email/dob
```

### A3. FRIENDS-privacy feed leak
```text
Vulnerability: Feed surfaced FRIENDS-only posts from FOLLOWERS (not real friends)
Severity: High
Affected file: backend/src/services/postService.js
Affected endpoint: GET /posts/feed
Why it was dangerous: Privacy mislabel; followers saw FRIENDS-only content
Fix implemented: FRIENDS posts filtered to actual friendIds (mutual friendship), plus hiddenUserIds (blocked/blocking users)
How it was tested: Live — non-friend viewing FRIENDS post returned 404; feed excludes blocked users' posts after blocking
```

### A5. Comments/reactions on posts you cannot view (IDOR)
```text
Vulnerability: Any user could comment/react/reply on a PUBLIC-visibility-evaluating post regardless of author privacy
Severity: High
Affected file: backend/src/services/postService.js, controllers/commentController.js
Affected endpoint: POST /posts/:id/comments, /comments/:id/reactions, GET /comments/:id/replies
Why it was dangerous: Interactions allowed against ONLY_ME/FRIENDS posts of strangers
Fix implemented: canViewPost enforced in toggleReaction, listComments, commentReplies, addComment, savePost, toggleCommentReaction
How it was tested: Live — Bob (non-friend) tried to comment on Alice's FRIENDS post → 404 Post not found
```

### A6. Comment delete passing commentId as postId
```text
Vulnerability: deleteComment(commentId) was called with the comment id, and post author looked up by postId=commentId
Severity: High
Affected file: backend/src/controllers/commentController.js
Affected endpoint: DELETE /comments/:id
Why it was dangerous: Broken ownership check → any user could be inferred as author or deletion could fail / mis-authorize
Fix implemented: new getCommentPostAuthor(commentId) resolves the post author from the comment; authority passed into deleteComment
How it was tested: Code review + route/controller trace
```

### A7. Group access control (CLOSED/PRIVATE)
```text
Vulnerability: Non-members could read members, view posts, and see member lists of closed groups; could not be blocked from join attempts
Severity: High
Affected file: backend/src/controllers/groupController.js
Affected endpoint: GET /groups/:id, GET /groups/:id/posts, POST /groups/:id/join, POST /groups/:id/posts
Why it was dangerous: Private group content and membership exposed by ID enumeration
Fix implemented: groupIdCanView gate; member lists stripped for non-visible; join blocked for PRIVATE; createGroupPost requires membership
How it was tested: Code review
```

### A8. Event access control (INVITE_ONLY/FRIENDS)
```text
Vulnerability: Event details and RSVP allowed for anyone knowing the id
Severity: High
Affected file: backend/src/controllers/eventController.js
Affected endpoint: GET /events/:id, POST /events/:id/rsvp
Why it was dangerous: Invite-only events were publicly enumerable and RSVP-able
Fix implemented: eventCanView (PUBLIC always, FRIENDS needs friendship, INVITE_ONLY needs membership); block check vs organizer; RSVP validates status + membership
How it was tested: Code review
```

### A9. Story view IDOR
```text
Vulnerability: Any authenticated user could mark any story as viewed and view viewer lists
Severity: High
Affected file: backend/src/controllers/storyController.js
Affected endpoint: GET /stories, POST /stories/:id/view, GET /stories/:id/viewers
Why it was dangerous: Story privacy violated; viewer enumeration
Fix implemented: viewStory requires friend or author and non-expired story; friends list filtered by hiddenUserIds
How it was tested: Code review
```

### A10. Marketplace multipart field mismatch (`file` vs `files`)
```text
Vulnerability: Client sent `file`, server consumed `files` → images silently dropped
Severity: High (integrity)
Affected file: frontend/src/services/index.js
Affected endpoint: POST /marketplace
Why it was dangerous: Listings claimed images that never persisted
Fix implemented: create() now appends to `files` (upload.array('files'))
How it was tested: Live frontend build passes; backend accepts files field
```

### A11. Marketplace ownership & price abuse
```text
Vulnerability: saveListing could mark ANY listing SOLD; price unbounded / NaN
Severity: High
Affected file: backend/src/controllers/marketplaceController.js
Affected endpoint: PATCH /marketplace/:id (save), POST /marketplace
Why it was dangerous: IDOR (mark others' listings sold) + price manipulation / DoS via absurd values
Fix implemented: seller-ownership required to SAVE/SOLD; price range 0..1e9 validated on create & update
How it was tested: Code review
```

### A12. Unbounded pagination
```text
Vulnerability: No caps on page/limit across feed, comments, messages, notifications, suggestions
Severity: High (availability)
Affected file: postController, commentController, messageController, notificationController, marketplaceController, userController
Affected endpoint: all list endpoints
Why it was dangerous: DB hammering / memory exhaustion via `?limit=99999999`
Fix implemented: caps: feed/userPosts 50, comments 50, messages 100, notifications 50, marketplace 50, suggestions 20, admin 100
How it was tested: Code review
```

### A13. No password recovery / email verification / token revocation
```text
Vulnerability: Users had no way to recover an account; leaked tokens could never be invalidated; email never verified
Severity: High
Affected file: authService.js, authController.js, authMiddleware.js, authRoutes.js
Affected endpoint: new POST /auth/forgot-password, /auth/reset-password, /auth/me/change-password, /auth/verify-email, /auth/me/verify-email
Why it was dangerous: Account lockout, unbounded token lifetime after compromise
Fix implemented: hashed reset tokens (sha256, 1h expiry, single-use); JWT carries `ver` (tokenVersion); protect() rejects stale-version tokens; change/reset bump tokenVersion (kills all prior sessions); verify-by-JWT (7d)
How it was tested: Live — reset → old password 401, new works; after change-password the pre-change session cookie returned 401 Session expired; verify token → isEmailVerified true
```

### A14. Cosmetic blocking
```text
Vulnerability: block only removed friendships; blocked users still appeared in search/suggestions/feed and could message
Severity: High
Affected file: utils/authorization.js (+ consumers)
Affected endpoint: /search, /users/suggestions, /posts/feed, /conversations, /saved/users/:id/media
Why it was dangerous: Harassment vector — blocked users could still reach you
Fix implemented: centralized areBlocked/hiddenUserIds; applied to search, suggestions, feed, saved media, follow toggle, conversation create/send
How it was tested: Live — blocked user create conversation → 403 You cannot message this user
```

### A15. No CSRF protection
```text
Vulnerability: State-changing requests could be forged cross-origin (cookies sent automatically)
Severity: Medium
Affected file: middleware/csrfMiddleware.js (new), app.js, frontend api.js
Affected endpoint: all POST/PUT/PATCH/DELETE
Why it was dangerous: Account/action CSRF on a cookie-authed API
Fix implemented: double-submit cookie fb_clone_csrf (SameSite=Lax, non-httpOnly) must be echoed in X-CSRF-Token header via timingSafeEqual; safe methods exempt
How it was tested: Live — POST register without x-csrf-token → 403; with correct token → 201/200
```

### A16. No per-endpoint rate limiting
```text
Vulnerability: Upload/report/message endpoints unbounded beyond the coarse global limiter
Severity: Medium
Affected file: middleware/rateLimitMiddleware.js
Affected endpoint: /posts, /conversations/:id/messages, /safety/reports, /marketplace, uploads
Why it was dangerous: Disk/DB exhaustion via bulk uploads/reports/messages
Fix implemented: uploadLimiter(20/min), reportLimiter(10/min), messageLimiter(120/min), postLimiter(30/min)
How it was tested: Config code review + backend boots
```

### A17. Uploads trusted MIME/extension blindly
```text
Vulnerability: A non-image renamed with a .jpg/.png could be accepted as media
Severity: Medium
Affected file: middleware/uploadMiddleware.js
Affected endpoint: avatar/cover/story/post/group-post/event/marketplace/message uploads
Why it was dangerous: Malware/scanner evasion, broken media
Fix implemented: magic-byte sniffing after multer — JPEG/PNG/GIF/WEBP/HEIC/MP4/MOV/WEBM/AVI signatures verified against declared mimetype; mismatch → 400 + file unlinked
How it was tested: Live — text file named fake.jpg (type image/jpeg) → 400 "JPEG file header mismatch"; real PNG header → 200 accepted
```

### A18. No input validation on most endpoints
```text
Vulnerability: Malformed/oversized/abusable body/query params on most routes
Severity: Medium
Affected file: routes/*.js (all except auth)
Affected endpoint: all
Why it was dangerous: 500s, bad DB writes, injection of invalid enum/privacy/status values
Fix implemented: express-validator chains added across post/comment/reaction/message/group/event/marketplace/saved/safety/notification/search/friend/user/admin routes; uuid param checks everywhere
How it was tested: Live — register payload with short password + bad dob → 400 validation error; all routes pass node --check
```

### A19. protect() loaded password hash on every request
```text
Vulnerability: passwordHash selected into memory for all authenticated requests
Severity: Low
Affected file: backend/src/middleware/authMiddleware.js
Affected endpoint: all protected
Why it was dangerous: Unnecessary secret handling in the hot path
Fix implemented: lean select (no passwordHash)
How it was tested: Code review
```

---

## B. Features completed

- Admin dashboard (stats overview + user management + moderation queue) — page + `/api/admin` API
- Forgot password flow (request token page → reset page)
- Password reset with hashed single-use tokens (1h expiry)
- Email verification (request + verify token, `devVerificationUrl` in dev)
- Change password with session revocation (tokenVersion bump)
- Account lockout-avoidance via token revocation (`ver` claim in JWT)
- Marketplace detail page (gallery, price, seller card, owner delete)
- Event detail page (cover, date box, RSVP buttons)
- CSRF protection (double-submit cookie + header)
- Per-endpoint rate limiting (upload/report/message/post)
- Magic-byte upload sniffing
- Input schema validation across all routes
- Dead-code cleanup: removed 15 orphan duplicate pages + 8 orphan components + 7 duplicate service files

## C. Features that existed but were fixed

- Feed privacy (FRIENDS filter now real-friends-only, hidden users excluded)
- Comment/reaction/save on private posts (now blocked)
- Comment delete authorization (commentId vs postId bug)
- Story viewing (friend-gated + expiry)
- Group access (CLOSED/PRIVATE membership gates, member-list stripping)
- Event access (INVITE_ONLY membership + FRIENDS friendship gates)
- Direct messages (block checks, membership)
- Search (hidden/blocked users excluded)
- User suggestions (blocked/non-PUBLIC excluded, capped)
- Saved media (privacy + block aware)
- Marketplace create (client `files` field) and save/update (seller ownership + price bounds)
- Unbounded pagination (caps added)
- Login page "Forgotten password" now a real link
- Settings Page Security tab (real change-password form replaced dead button)
- Frontend service layer (consolidated to single services/index.js)

## D. Security improvements

- Centralized authorization utilities (`authorization.js`): areBlocked, hiddenUserIds, friendIds, isFriends, canViewPost, assertCanViewPost, conversation membership
- Viewer-aware profile sanitization
- JWT token-version revocation on password change/reset
- Lease RSVP privacy
- CSRF double-submit
- Rate limiting per endpoint + socket rate limit
- File magic-byte sniffing
- UUID + value validation on params/body/query
- Global API limiter, helmet, CORS (kept)

## E. Database changes

Applied via `npx prisma db push` (schema-only; no migration file generated):

- `User.isEmailVerified Boolean @default(false)`
- `User.tokenVersion Int @default(0)`
- New model `PasswordReset`
  - `id`, `userId` (FK), `tokenHash`, `expiresAt`, `used`, `createdAt`, `@@index([userId])`
- Prisma Client regenerated (v6.19.3)

## F. API changes

New endpoints:

- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `POST /api/auth/verify-email`
- `POST /api/auth/me/change-password`
- `POST /api/auth/me/verify-email`
- `GET /api/admin/dashboard`
- `GET /api/admin/users`
- `PATCH /api/admin/users/:id/status`
- `PATCH /api/admin/users/:id/role`
- `DELETE /api/admin/users/:id`
- `GET /api/admin/reports`
- `PATCH /api/admin/reports/:id/resolve`

Modified endpoints (behavior): all list endpoints pagination caps; marketplace save/update ownership+price; comments/reactions privacy gates; message create/send block checks; group/event/story access gates; search/suggestions filtering; upload routes now sniff magic bytes; all routes accept/validate JSON input via express-validator.

## G. Socket.IO changes

- `message:send`: participant + block check; routed through messageService.sendMessage; content trimmed/sliced; validated types
- `typing` / `read`: participant membership required
- New in-memory rate limit: 20 events per 10s per socket
- Only `message:send` for direct (non-group) conversations carries the file-payload restriction

## H. Testing

Tests run:

1. Backend syntax (`node --check`) on all modified files + route files — **passed**
2. Frontend `npm run build` — **passed** (172 modules)
3. Backend boot + `GET /api/health` — **passed** (200)
4. Live CSRF check: register without `X-CSRF-Token` → **403**; with token → **201**
5. Live register validation: weak password + invalid dob → **400** with validation details
6. Live login/me via cookie session → **200**
7. Live magic-byte sniffing:
   - text named `fake.jpg` (image/jpeg) → **400** "JPEG file header mismatch"
   - valid PNG header → **200** accepted, avatar URL persisted
8. Live forgot-password → **200** (anti-enumeration message + devResetToken)
9. Live reset-password → **200**; old password login → **401**; new password → **200**
10. Live change-password → **200**; prior session cookie `/api/auth/me` → **401** "Session expired"
11. Live email verify → **200**, isEmailVerified true
12. Live privacy: non-friend viewing FRIENDS post → **404**; commenting → **404**
13. Live block: Bob blocked Alice → Alice profile bare identity + `relation: BLOCKED` for Bob; Bob create conversation with Alice → **403** "You cannot message this user"; Alice's feed excludes Bob's public post
14. Live admin gate: non-admin → **403** "Admin access required"

Tests passed: all of the above except none.
Tests failed: none.

Remaining issues:
- Group/event/story access gates verified by code review only (not live flows — no seeded groups/events/stories during test run)
- Socket.handshake auth and event authorization reviewed in code, not exercised live (no browser client connected during testing)

## I. Remaining risks

Be honest:

1. **Real email delivery is not wired** — verification/reset links are returned to the client in development and logged; no SMTP provider is configured (`JWT`-based verify, sha256-hash reset tokens). In production you must add an email provider and stop returning `devResetToken`/`devVerificationUrl`.
2. **Rate limiting is in-memory** — resets on process restart and does not scale across multiple node processes; upgrade to Redis store for multi-instance deployments.
3. **Socket rate limiting is per-socket in-memory** bespoke counter — same scaling caveat.
4. **Group/event/story authorization paths** were reviewed but not live-tested end to end because the test DB had no such records; a fuller manual QA pass with seeded data is recommended.
5. **Password reset token brute-force** — 128-bit hashed tokens are used (good), but there is no per-token attempt lockout; rate limits cover the endpoint. Acceptable for this scope.
6. **`optionalAuth` still loads the full user** (not the lean select) — minor perf, not a security issue.
7. **HEIC magic check** relies on the ISO-BMFF `ftyp` box; some HEIC variants use `heix`/`mif1` brands which are still ftyp-compatible — acceptable.
8. **CORS dev regex** allows any localhost origin in non-production (deliberate for the dev server).
9. **Uploaded orphan files** remain in `backend/src/uploads` from earlier development; safe to delete, not cleaned automatically.
10. **No automated test suite** exists in the repo (no Jest/Vitest configured) — hardening is verified manually as documented in section H.