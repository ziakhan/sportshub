---
updated: 2026-07-10
status: committed
tier: 1
area: platform
effort: XL
source: owner
tags: [theme/platform, type/plan, status/committed]
---

# 🚀 Native app execution plan — realtime, push, iOS + Android

**The execution companion to [[native-mobile-platform]]** (which holds the architecture and the
adversarial review — read it first). This doc turns that architecture into an ordered,
step-by-step build: milestones M0–M4 inside the current Fable window, M5+ after. Owner
direction (2026-07-10): *native app (Android + iOS) very important · push important · realtime
sockets · live scoring with live push. Build lower infrastructure first, in phases.*

## Three deviations from the architecture doc (decided for speed; owner may veto)

1. **Incremental hosting, not Phase-0 self-host first.** The web app STAYS on Vercel for now.
   Only the net-new sidecar (sockets + workers) gets an always-on host (Railway). The doc
   itself concedes Vercel was only ever the blocker for *sockets + long jobs* — the sidecar
   removes exactly that. The full Vercel→Linux migration (doc §11–13) remains on the roadmap
   as its own project; nothing built here has to be redone when it happens (the sidecar just
   moves onto the same box).
2. **Extend the current auth stack, don't migrate to Auth.js v5 now.** Bearer-token endpoints
   are added *beside* NextAuth v4 (same User store, same password hashes, same
   `getSessionUserId()` downstream). The v5 evaluation stays coupled to the Node-20 upgrade in
   the deferred self-host phase, exactly as the doc recommends.
3. **Expo Push Service first, FCM-direct later.** Expo push (via `expo-notifications`) brokers
   to both APNs and FCM with no `firebase-admin`, no APNs key management, and no Firebase
   project — the fastest path to working push on both platforms. The `Device` table carries a
   `provider` column so swapping to FCM-direct (doc §7, for rich notifications/channels via
   Notifee) is a worker change, not a schema change.

## Explicitly OUT of this window (unchanged from the doc)

Full self-hosting (Docker/Nginx/Kamal/Node 20/managed-PG choice) · object-storage migration —
therefore **no chat photos in app v1** (doc §10) · chat block/report/moderation (required
before PUBLIC store launch, not TestFlight — doc §14) · operator/referee mobile surfaces ·
Family Pass entitlement UI · rebuilding the scoring console in RN (webview only, per doc §6).

---

## M0 — Accounts + scaffolding (owner in parallel; ~half a session)

**Owner (start immediately — calendar lead times):**
1. **Apple Developer Program** enrollment ($99/yr) — org verification can take days; the long
   pole for TestFlight. → needed by M4.
2. **Google Play Console** ($25 one-time) → needed by M4.
3. **Railway account** (or Fly.io — either works; plan assumes Railway) → needed by M0/M1.
4. Later, with M4: an **Expo (EAS) account**.

**Build:**
- `apps/sidecar` — new workspace in the turborepo: Node 20 + TypeScript + Fastify (health +
  internal endpoints) + Socket.IO + BullMQ + ioredis. `tsup` build, `turbo` wired for
  lint/type-check/build. No Prisma at first (workers gain a read-only client in M3).
- Railway service: deploy from the repo (nixpacks or a small Dockerfile), plus a **Railway
  Redis** instance (private network). Health check `/healthz`, auto-restart, staging variables.
- **Trust seam**: `SIDECAR_SHARED_SECRET` — every server-to-sidecar call is HMAC-signed
  (timestamp + body), verified in Fastify middleware. Vercel gets `SIDECAR_URL` +
  `SIDECAR_SHARED_SECRET`; browser/app get `NEXT_PUBLIC_SOCKET_URL`.
- CI: sidecar added to the existing GitHub Actions lint/type-check/build matrix.

*Verify: `curl /healthz` on the deployed sidecar; a signed test publish round-trips.*

## M1 — Realtime backbone (web gets live chat + live scores) — the foundation

**Architecture (adapted §5–6):**
- **Publish path (serverless-safe):** `apps/web/src/lib/realtime/publish.ts` →
  `publishRealtime(event)` does a fire-and-forget HMAC-signed
  `POST ${SIDECAR_URL}/internal/publish`. No Redis client inside Vercel functions. The sidecar
  re-broadcasts through `@socket.io/redis-adapter` (so a second sidecar replica later is
  config, not code). **If the sidecar is down, nothing user-visible breaks** — DB writes
  already happened; clients fall back to today's polling.
- **Rooms:** `team:{id}` (chat) · `game:{id}` (live events + score) · `scores` (global
  scoreboard strip) · `league:{id}:scores` · `user:{id}` (bell). Public data (scores, live
  games) allows anonymous socket connections; private rooms require an auth ticket.
- **Socket auth (web, pre-M2):** `GET /api/realtime/ticket` (session-cookie-authed) returns a
  60-second signed JWT `{ userId, rooms[] }`; the socket handshake presents it. In M2+ the
  native bearer token is accepted directly in the handshake — same verification code.
- **Publish points wired:** `teams/[id]/messages` POST → `chat.message` · scoring-console
  event-sync route → `game.event` + score snapshot → `game:{id}` and the scores rooms ·
  `games/[id]` PATCH + finalize → `game.status` · `notify()` in `lib/notifications.ts` gains
  the seam → `user:{id}` bell event (and, from M3, enqueues push).
- **Client:** one `useRealtime(room, { onEvent, fallbackPoll })` hook on `socket.io-client`;
  when connected, existing polls stretch to a slow safety interval; on disconnect they resume.
  Reconnect gap-fill reuses the existing `?after=<timestamp>` fetches (doc §6 — no new resume
  protocol). Wired into: team chat, `/scores` strip, public game page, homepage scoreboard,
  notification bell.

*Verify: two browsers in a team chat (typing indicator included — Redis presence); a live
demo-world game scored on a tablet updates `/scores` and the game page with no reload;
sidecar killed mid-demo → polling silently takes over; Playwright test for both paths.*

## M2 — Native auth (bearer tokens beside NextAuth v4)

- **Schema (runbook #21):** `RefreshToken` — id, `userId`, `tokenHash` (sha256), `familyId`
  (rotation lineage), `deviceLabel`, `expiresAt` (60d), `revokedAt`, `createdAt`,
  `lastUsedAt`. Reuse of a rotated-out token revokes the whole family (theft detection).
- **Endpoints:** `POST /api/auth/token` (email+password → 15-min access JWT via `jose`,
  signed with new `AUTH_TOKEN_SECRET` + refresh token; rate-limited; same bcrypt + ACTIVE
  checks as `auth-credentials.ts`) · `POST /api/auth/refresh` (rotate) · `POST /api/auth/revoke`
  (this device or all).
- **Dual acceptance:** `getSessionUserId()` gains the bearer path — `Authorization: Bearer`
  verified → identical return shape, so all 139 routes work for the app with **zero per-route
  changes**. Middleware passes Bearer requests through to route-level auth.
  **Impersonation stays web-only** (decision, doc §8).
- The M1 socket handshake accepts these tokens natively from here on.

*Verify: integration tests — login/refresh/rotation/reuse-detection/revoke; a curl with a
bearer token exercises representative family routes (offers, chat, notifications).*

## M3 — Push notifications

- **Schema (runbook #22):** `Device` — id, `userId`, `platform` (IOS|ANDROID), `provider`
  (EXPO now, FCM later), `token @unique`, `appVersion`, `lastSeenAt`, `revokedAt`. Plus
  `User.pushQuietStart`/`pushQuietEnd` ("22:00"/"08:00" wall-time, `APP_TIMEZONE` semantics —
  the existing `reminderPush` preference is finally wired up.
- **Endpoints:** `POST /api/devices` (bearer-auth register/refresh on every app launch) ·
  `DELETE /api/devices` (sign-out).
- **Fan-out (doc §7 — queued, never inline):** the `notify()` seam enqueues to BullMQ `push`
  queue → sidecar worker resolves devices, filters prefs + quiet hours, chunks 100/call to
  the Expo Push API, then processes **receipts**: `DeviceNotRegistered` → revoke the device
  row (the token-lifecycle work the doc warns about). Collapse keys per user+type so a busy
  chat is one updating notification, not twenty.
- **v1 push triggers** (all existing notification types — the seam makes this a filter list):
  chat message · offer received/rescinded · game final + **game live-start for followed
  teams** (the "live push activation") · schedule/practice change · announcement.
- **Deep links:** notification `link` paths already exist for the web bell — the app maps the
  same paths to screens via `sportshub://` scheme + Expo Router.

*Verify: register a dev-build device, fire each trigger from the demo world, receive on a
real phone; quiet-hours + pruning covered by worker unit tests.*

## M4 — React Native app v1 (Expo, Android + iOS)

- **Scaffold:** `apps/mobile` — Expo (managed workflow, dev-build), TypeScript, **Expo
  Router**, **NativeWind** consuming new `packages/design-tokens` (ink/hoop/play/court/gold,
  radii, Barlow via `expo-font`). Monorepo metro config. New `packages/api-client` — typed
  fetch wrapper with token storage (`expo-secure-store`), auto-refresh interceptor, and the
  socket client; web can adopt it incrementally later.
- **The five screens (doc §3, written in stone):**
  1. **Home / Scores** — your-teams rail (Follow model), live scores via `game:{id}` sockets,
     upcoming schedule (practices + games + events from the M-calendar APIs).
  2. **Team chat** — socket-fed, optimistic send, read cursors (`TeamChatRead`), unread
     badges; *text only in v1* (photos wait for object storage).
  3. **Notifications inbox** — existing `/api/notifications` + dismiss + deep links.
  4. **Offers & pay** — family offers list; accept with **Stripe Payment Sheet**
     (`@stripe/stripe-react-native`, Apple Pay/Google Pay) hitting the **existing**
     `payment-info`/`pay-intent` APIs (destination charges, installments, saved cards).
     ⚠️ First M4 task: a 1-hour spike proving Payment Sheet against a Connect destination
     charge in test mode — it's the only integration with real unknown risk.
  5. **Profile & kids** — players, settings (push prefs, quiet hours), sign-out (revoke).
  Plus: sign-in screen (M2 endpoints) and the **sanctioned webview** for the scoring console
  (refs/scorekeepers) — the one webview allowed.
- **Min-version handshake from v1** (doc §14): `GET /api/mobile/config` → `{ minVersion }`;
  the app gates with a forced-upgrade screen. Old binaries live for months — this ships first,
  not later.
- **Build & distribute:** `eas.json` (development / preview / production), bundle IDs
  `com.sportshub.app`, icons/splash from brand assets, **EAS Build** (cloud — no local Mac
  needed) → **TestFlight + Play internal** via EAS Submit; `expo-updates` OTA on the preview
  channel for JS-only fixes.

*Verify: end-to-end on physical devices — sign in as `parent@sportshub.demo`, watch a live
demo game tick, chat with unread → push → deep link, accept the open fall offer and pay with
the Payment Sheet (test mode), quiet hours respected.*

## M5+ — after the window (ordered)

1. Owner click-through of the app → fix batch → wider TestFlight group.
2. **Chat safety** (block/report/filter + moderation queue; buy-decision Hive vs OpenAI
   moderation) — gates public store submission (doc §14).
3. Store listing, privacy labels, review → **public launch** (doc phase 6).
4. Object storage → chat/team photos; operator + referee thin surfaces.
5. The deferred **self-host Phase 0** (Node 20 + Auth.js v5 evaluation + Docker/Kamal +
   managed-PG decision) — the sidecar relocates onto the same box; FCM-direct swap if rich
   notifications are wanted.

## Configuration matrix (new, by environment)

| Where | Keys |
|---|---|
| **Vercel** | `SIDECAR_URL`, `SIDECAR_SHARED_SECRET`, `AUTH_TOKEN_SECRET`, `NEXT_PUBLIC_SOCKET_URL` |
| **Railway (sidecar)** | `REDIS_URL` (internal), `SIDECAR_SHARED_SECRET`, `AUTH_TOKEN_SECRET` (socket handshake verify), `DATABASE_URL` (M3 workers, pooled), `EXPO_ACCESS_TOKEN` (push), `APP_TIMEZONE` |
| **EAS / app** | `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_SOCKET_URL`, Stripe publishable key, bundle IDs, store credentials (EAS-managed) |
| **GitHub Actions** | sidecar in build matrix; EAS builds stay manual for now |

Schema runbook entries to append when built: **#21 RefreshToken**, **#22 Device (+ user quiet
hours)** — both additive.

## Sizing honesty (Fable window ≈ a couple of days)

M0 ½ · M1 1 · M2 ½ · M3 ½–1 · M4 1½–2 sessions. **M0–M3 fit comfortably and each is
independently shippable** (the site gets realtime + push infrastructure even if the window
closes there). M4 core lands to internal-testing builds; polish and the wider TestFlight loop
spill past the window by design. Biggest external risk is Apple enrollment lead time —
mitigation: Android internal testing first; iOS follows the moment enrollment clears.

⬅ [[native-mobile-platform]] (architecture) · [[_dashboard|Roadmap dashboard]] · [[_moc-platform]]
