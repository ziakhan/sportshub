---
updated: 2026-07-09
status: planned
tier: 1
area: platform
effort: XL
source: owner
tags: [theme/platform, type/plan, status/planned]
---

# 📱 Native mobile platform + self-hosted backend (architecture & migration)

**Tier 1 · effort XL · owner-directed · PLANNED (implement later).**
The authoritative plan for taking SportsHub from a Vercel-hosted web app to a **native
iOS + Android app (React Native/Expo) + a self-hosted backend that owns realtime & push**,
with the web app kept for operator/admin work. Incorporates the adversarial review
([[#appendix-a-adversarial-review-corrections]]) — notably: **keep Next.js as the API**,
**rent the database**, and treat **native auth / App-Store economics / child-safety** as
first-class workstreams, not afterthoughts.

---

## 0. The revised spine (read this first)

- **Native RN (Expo) app** for the family/consumer experience (and a thin, action-first
  surface for operators/refs). **Not** a Capacitor webview, **not** a PWA.
- **Keep the existing Next.js app** as (a) the web/admin console and (b) the **HTTP API** —
  once off Vercel's serverless model, Next.js *is* a long-running server; its ~139 route
  handlers are a perfectly good API tier. **Do not re-port them into a new framework.**
- Add **one small always-on sidecar**: WebSocket gateway (Socket.IO) + background workers
  (BullMQ). `notify()` publishes to **Redis pub/sub** → fans out to bell + socket + push + email.
- **Own realtime & push** (self-hosted app tier makes this honest). **Rent the state tier**:
  managed Postgres on a separate host, Redis, object storage.
- **No IAP tax on the money that matters**: tryout/camp/house-league/season fees are
  real-world services → native **Stripe Payment Sheet** in-app, 0% to Apple. The Family Pass
  digital subscription uses the **reader-app / club-bundle** model.
- Mobile **v1 = ~5 screens**, not a port. Scope discipline is the whole game.

---

## 1. Principles

1. **Native where it matters, web where it's heavy.** Phone-first flows go native; dense admin
   (page customizer, schedule/playoff generation, bulk ops, exports) stays on web.
2. **One mobile codebase** (iOS + Android) sharing everything *below the UI* with web.
3. **Own the app tier, rent the state tier.** Reliability budget goes to app code, not to
   babysitting a database.
4. **Every event flows through one seam** (`notify()` → Redis pub/sub → all channels).
5. **Ship in thin, independently-deployable phases.** No big-bang cutover.
6. **Design for the App Store from day one** (IAP avoidance, child-safety, min-version gates).

---

## 2. Target topology

```
                        ┌──────────────────────────────────────────┐
   iOS app (RN/Expo) ───┤                                          │
   Android app (RN) ────┤   APP TIER  (self-hosted Linux, Docker)  │
                        │                                          │
   Web browser ─────────┤   ┌────────────────┐  ┌───────────────┐  │
        │               │   │ Next.js        │  │ Realtime/Jobs │  │
        │               │   │ (web + HTTP    │  │ SIDECAR       │  │
   Nginx (TLS,          │   │  API, 139      │  │ Socket.IO WS  │  │
   reverse proxy,       │   │  routes,       │  │ + BullMQ      │  │
   rate-limit) ─────────┼──▶│  standalone)   │  │ workers       │  │
                        │   └───────┬────────┘  └──────┬────────┘  │
                        │           │  publish/consume │           │
                        │           └──────── Redis ───┘           │
                        └───────────────┬──────────────────────────┘
                                        │
             ┌──────────────────────────┼───────────────────────────┐
             │       DATA TIER (managed / separate host)             │
             │   Postgres (RDS / Oracle / Neon)   Object storage     │
             │   Redis (managed or co-located)    (S3 / R2 / OCI)    │
             └───────────────────────────────────────────────────────┘

   External:  Stripe (Connect)   ·   APNs + FCM (push)   ·   SMTP (email)
```

Key point: the **only net-new server process** is the sidecar. Everything else is the app you
already have, relocated.

---

## 3. Product split — mobile (limited, action-first) vs web (full console)

| Persona | Native app | Web (heavy console) |
|---|---|---|
| **Parent / Player** | Full: scores/follow, schedule/calendar, chat, RSVP, roster, registration + **native pay**, accept offers, stats, notifications | Anything rare |
| **Coach / Staff** | Team chat, roster view, schedule, attendance, announcements/polls; **live scoring = tablet web / sanctioned webview, NOT rebuilt in RN** | Deep roster mgmt, season setup, bulk edits |
| **Referee / Scorekeeper** | My assignments, accept/decline shifts, **open scoring console (web/webview)**, PIN sign-off, availability | Payout history, profile |
| **Club Owner / Manager** | Glance metrics, "needs attention," approve/decline offers, send announcement, reply in chat, view registrations | **Full dashboard**: create/edit teams·tryouts·offers·camps·house-leagues, **page customizer**, staff mgmt, payments admin, capacity |
| **League Owner / Manager** | Standings/scores glance, approve submissions, assign refs/scorekeepers on game day, announcements | **Full league console**: season/division/schedule/**playoff** generation, roster locks, submissions |

**Written-in-stone "never in the app v1" list** (get owner sign-off; operators will push):
page customizer (@dnd-kit), schedule/playoff generation, bulk roster + league-submission
workflows, scoresheet PDF, admin tables/exports, public marketing/SEO pages.

**Mobile v1 (the only screens that ship first):** (1) Scores/your-teams, (2) Schedule/calendar,
(3) Team chat, (4) Notifications/inbox, (5) Registration + pay-what's-owed. Everything else is a
later phase or stays web.

---

## 4. Monorepo & shared code

Current reality (verified): `packages/` has only `db`, `payments`, `test-worlds`. Auth, Zod
schemas, and business logic live in `apps/web/src/lib`. So "share below the UI" is partly an
**extraction refactor** — do it *surgically*, share only what's safe:

- **`packages/types`** — Prisma-generated **types only** (never the Prisma *client* — it must not
  enter the RN bundle).
- **`packages/validation`** — the Zod schemas (already in `apps/web/src/lib/validations`).
- **`packages/api-client`** — a typed client (fetch wrapper / tRPC-style) both web and mobile call.
- **`packages/design-tokens`** — the Tailwind token values (`ink/hoop/play/court/gold`, spacing,
  radii, Barlow fonts) consumed by web Tailwind **and** by **NativeWind** in RN.
- **`apps/mobile`** — the Expo RN app.

**Do NOT share**: server business logic (stays behind the API), the Prisma client, anything
Node-only. Budget "70% of the *feel* ports" for NativeWind — fonts need `expo-font`, and
shadows/gradients/`position:sticky`/`:hover` don't translate; screens are rebuilt in RN primitives.

---

## 5. Backend evolution — keep Next.js, add a sidecar

**Do NOT build a standalone NestJS/API service.** Instead:

1. Run **Next.js in `output: 'standalone'`** on the Linux box — this serves web *and* the existing
   API routes as a long-running server (no serverless limits anymore).
2. Add the **sidecar** (a small Node/TS service) for the two things Next.js can't do well:
   **persistent WebSockets** and **background jobs** (BullMQ on Redis).
3. Refactor the notification seam: `notify()/notifyMany()/notifyBatch()` (already the single
   fan-out point in `apps/web/src/lib/notifications.ts`) **publishes to Redis pub/sub**. Consumers:
   - in-app bell row (DB write, as today),
   - **socket** push to connected clients (via the sidecar),
   - **native push** dispatch (queued job → APNs/FCM),
   - email (as today).
   This is a **~2-week seam**, not a rewrite, and it's the backbone for chat, push, and live scoring.

---

## 6. Realtime — chat + live scoring

- **Transport:** Socket.IO + `@socket.io/redis-adapter` in the sidecar (horizontal-scale ready).
- **Auth handshake:** the socket connection authenticates with the **native bearer token**
  (see §8); reject/rotate on expiry.
- **Reconnect backfill:** reuse the existing `?after=<timestamp>` fetch as the gap-fill on
  reconnect (event push + fetch-after-gap). Don't invent a resume protocol.
- **Presence / typing / read receipts:** natural once sockets exist; keep in Redis.
- **Chat stays Postgres-backed** (source of truth); sockets are a transport upgrade over the
  current polling, and **polling stays as the graceful fallback.**
- **Live scoring:** the console is **already offline-first** (append-only event log, idempotent
  `clientEventId` sync, session-lock heartbeat, iPad-Safari-tuned). **Do not rebuild it in RN v1.**
  Keep it on tablet web, or embed it as the *one* sanctioned webview screen inside the app.
- **⚠️ Child-safety is mandatory scope, not polish** (chat involves minors): **block, report, and
  filter** (Apple guideline 1.2), a moderation queue, and a COPPA-reviewed policy are required for
  store approval. See §14.

---

## 7. Push notifications

- **Delivery:** **FCM via `firebase-admin`** server-side reaches **both** Android and iOS
  (FCM proxies APNs) — one path, not two. Direct APNs only if you refuse Google services.
- **Client:** `react-native-firebase/messaging` + **Notifee** (rich notifications, channels,
  background handling) in the RN app.
- **Schema:** a `Device` table — `userId`, `platform`, `token`, `createdAt`, `lastSeenAt`.
  (`reminderPush` preference flag already exists in schema — wire it up.)
- **Token lifecycle (the real work, not the send):** multi-device per user, token rotation,
  prune on uninstall (FCM unregistered errors), per-user **preferences + quiet hours** (no 11pm
  pings), and **deep-link routing** (tapped notification → correct RN screen).
- **Fan-out via BullMQ, never inline:** publishing a schedule to 2,000 parents is thousands of
  FCM sends — queue it, or requests time out.

---

## 8. Native auth — the critical prerequisite (biggest gap today)

Today: NextAuth **v4** (in maintenance mode) issues a **cookie-bound JWT** for browsers.
Impersonation is cookie-based too. A native app needs bearer tokens. This is a **workstream**:

- **Token model:** short-lived **access token** + rotating **refresh token**; store in
  **`expo-secure-store`** (Keychain / Keystore), never AsyncStorage.
- **Endpoints:** `/auth/token` (login → tokens), `/auth/refresh` (rotate), `/auth/revoke`
  (logout / device removal). Web keeps its cookie session; native uses `Authorization: Bearer`.
- **Shared identity:** one `User` store; middleware accepts *either* a session cookie (web) or a
  bearer token (native) → same `getSessionUserId()` semantics downstream.
- **Decision (open):** extend NextAuth v4 with a credentials-token flow **vs** migrate to
  **Auth.js v5** (actively maintained, better token story) **vs** a small dedicated auth service.
  Recommend evaluating Auth.js v5 during the Node-20 upgrade (kill three EOL birds at once).
- **Impersonation:** define how admin impersonation works over bearer tokens (or keep it web-only).

---

## 9. Payments across web + native (+ App Store / Canada compliance)

**Real-world services stay native, 0% to Apple:**
- Tryout / camp / house-league / **season fees + installments** are real-world services
  (guideline 3.1.3(e)) → **must** use non-IAP. Use the **Stripe React Native SDK Payment Sheet**
  (Apple Pay / Google Pay / card) in-app. Reuse the **existing backend**: same PaymentIntent +
  Connect destination charge + obligations + `resolveChargeContext`. First installment = native
  sheet; later installments = off-session server charges. **No browser detour.**

**Family Pass (digital subscription) — reader-app / bundle model (Canada-safe):**
- **Do not sell it via IAP** (would cost 15–30%) and **do not put a "Buy on web" link/button in the
  app** — in **Canada** that's anti-steering (no US-style external-link freedom, no EU DMA).
- **Primary path — bundle into a club obligation:** the club includes/comps the pass as part of a
  season/registration fee (real-world service). No consumer digital purchase exists → nothing to
  steer → Apple has nothing to object to. Best fit for the B2B2C money flow.
- **Fallback — quiet reader-app (Netflix model):** app *describes* the benefit ("Season keepsakes
  are part of Family Pass"), locked features say "Included with Family Pass" + informational
  "Learn more" (**no buy button, no checkout link**). Families acquire it on **web/email/club**;
  the app **unlocks on login** via entitlement.
- **Where conversion actually lives:** website + email (out-of-app comms are allowed) + the club.
- **US upside (later):** the 2025 external-link ruling lets US builds add an in-app web-checkout
  link commission-free — region-gate that; **don't** design Canada around it.

---

## 10. Media storage (prerequisite infra)

Today: page-customizer images are **data URLs stored in Postgres**. Chat photos on mobile will
detonate that. Move to **object storage** (S3 / Cloudflare R2 / Oracle OCI Object Storage) with
**signed upload + read URLs**; store only the key in Postgres. Do this **before** shipping mobile
media (chat photos, team photos, avatars).

---

## 11. Hosting & infra — Vercel → self-hosted Linux (+ separate/managed DB)

**App tier (self-hosted, containerized):**
- `docker compose` (start here; k8s only if you truly outgrow one box) running:
  **Next.js (standalone)**, the **sidecar (WS + workers)**, **Nginx** (TLS via Let's Encrypt,
  reverse proxy, rate-limit).
- **Rolling / blue-green deploys** are mandatory — a naive restart drops **all sockets mid-game**.
  Run two app replicas behind Nginx; drain then swap.
- **Node 20 LTS** (fix the Node-18-EOL debt during this move).

**Data tier — does NOT live on the app box (owner's note, and the right call):**
- **Postgres = managed / separate machine** — **AWS RDS**, **Oracle Cloud**, or **stay on Neon**.
  Rationale: youth-sports load spikes every Saturday 9am–6pm; a single box that also runs Postgres
  is "scheduled to fail during your only high-stakes window." Managed gives backups, PITR, HA,
  and upgrades you shouldn't hand-roll. Put **pgbouncer / pool discipline** in front (Next + sidecar
  + workers all hold Prisma pools).
- **Redis** — managed (Upstash/ElastiCache/OCI) or co-located; it's pub/sub + queues + presence.
- **Object storage** — S3 / R2 / OCI (see §10).

**Observability & ops (you are now the SRE):** centralized logs, metrics, uptime + error
alerting (e.g. Grafana/Loki or a hosted APM), TLS renewal, OS patching cadence, DB backups +
**restore drills**, and a Saturday-morning on-call plan.

---

## 12. CI/CD migration

**Current:** GitHub Actions (lint / type-check / build) + **Vercel auto-deploy on push to master**.

**Target (web/backend):**
1. GitHub Actions on push: lint → type-check → unit + integration tests → **build Docker images**
   (Next.js standalone + sidecar) → push to a **registry** (GHCR / ECR / OCIR).
2. **Deploy step**: SSH + `docker compose pull && up -d` with a rolling swap, or a lightweight CD
   agent (Watchtower/Portainer/Kamal). **Kamal** (from 37signals) is a strong fit — it's purpose-built
   for "deploy Docker to your own Linux box with zero-downtime, from GitHub Actions."
3. **Environments:** `staging` (mirror on the same or a second box) → `production`, promotion-gated.
4. **Secrets:** move Vercel env vars → a secrets manager (Doppler / SOPS / cloud secrets) injected
   at deploy; never bake into images.
5. **DB migrations:** Prisma `migrate deploy` as a gated release step (with a backup first).

**Target (mobile):**
- **EAS Build** (cloud native builds — no Mac farm) + **EAS Submit** (App Store / Play upload).
- **`expo-updates`** for OTA JS hotfixes (ship fixes without waiting on store review).
- Channels: `preview` (TestFlight / Play internal) → `production`.

---

## 13. How hard is the Vercel → Linux move? (honest effort)

**The web app itself moves easily.** Next.js has first-class self-hosting: `output: 'standalone'`
produces a runnable server; it runs anywhere Node runs. Low-medium effort.

The real work is the **net-new pieces and the Vercel assumptions**, roughly in order:

| Item | Effort | Notes |
|---|---|---|
| Next.js standalone + Docker + Nginx/TLS | **Low-Med** | Mechanical; `output:'standalone'`, compose, certs |
| Env/secrets off Vercel | **Low** | Move vars to a secrets manager |
| Managed Postgres + pgbouncer | **Low-Med** | Point `DATABASE_URL`; add pooling |
| Object storage migration (data-URLs → S3) | **Med** | One-time data migration + upload path change |
| The sidecar (WS + workers) | **Med-High** | Net-new service (but small) |
| Redis + `notify()`→pub/sub refactor | **Med** | The fan-out backbone |
| Native auth (bearer tokens) | **High** | Real workstream (§8) |
| Push (FCM + tokens + fan-out) | **Med-High** | Send is easy; lifecycle/prefs/deep-links are the work |
| Blue-green deploy so sockets survive | **Med** | 2 replicas + drain |
| Vercel-isms audit | **Low-Med** | `force-dynamic`, image optimization, edge, cron |
| Ops/observability standup | **Med** | Logs, alerts, backups, on-call |

**Bottom line:** *moving the web app is not the hard part* — it's a weekend-to-a-week of infra.
The effort is the **new capabilities** (realtime, push, native auth) that you're adding *at the same
time*, which you'd need regardless of host. Vercel was never the blocker for the web; it was the
blocker for **sockets + long jobs**, and self-hosting removes exactly that.

---

## 14. Child-safety & store compliance (design in, don't retrofit)

- **UGC safety (chat/photos with minors):** block, report, filter (Apple 1.2); moderation queue;
  reporting → action SLA. Build alongside chat, not after.
- **COPPA / age gates:** under-13 handling (you already model parent-registered players); privacy
  labels; data-minimization for minors.
- **IAP avoidance by design** (§9): real-world-services exemption for fees; reader-app/bundle for
  Family Pass; no in-app steering in Canada.
- **Min-version / kill-switch:** old binaries live for months — ship an API version handshake and a
  forced-upgrade gate from v1.
- **Privacy nutrition labels, ATT** (if any tracking), and store metadata for a kids-adjacent app.

---

## 15. Phased roadmap (each phase shippable)

- **Phase 0 — Self-host groundwork (backend, no app yet):** Next.js standalone + Docker + Nginx;
  managed Postgres + Redis; object storage + migrate data-URLs; Node 20; CI builds images + Kamal
  deploy; staging. *Outcome: identical product, self-hosted, deploy pipeline proven.*
- **Phase 1 — Realtime + fan-out seam:** sidecar (Socket.IO + Redis adapter) + `notify()`→pub/sub;
  chat upgraded from polling to sockets (fallback kept). *Outcome: realtime chat/scores on web.*
- **Phase 2 — Native auth:** bearer-token endpoints + refresh rotation + revoke; decide NextAuth v4
  vs Auth.js v5. *Outcome: a mobile client can authenticate.*
- **Phase 3 — Push:** `Device` table, FCM via `firebase-admin`, token lifecycle, prefs/quiet hours,
  deep-links, BullMQ fan-out. *Outcome: push works to web + (soon) app.*
- **Phase 4 — RN app v1 (5 screens):** Expo app, NativeWind tokens, scores/schedule/chat/notifs/
  pay; **Stripe Payment Sheet** for fees; scoring console as sanctioned webview; EAS build+submit
  → TestFlight/Play internal. *Outcome: a real native app in testers' hands.*
- **Phase 5 — Chat safety + operator/ref surfaces:** moderation (block/report/filter), then the
  thin operator + referee/scorekeeper mobile surfaces. *Outcome: store-submittable + operators onboard.*
- **Phase 6 — Store launch:** privacy labels, min-version gate, App Store/Play review, Family Pass
  via bundle/reader-app. *Outcome: public launch.*

---

## 16. Open decisions & risks

- **Auth:** extend NextAuth v4 vs Auth.js v5 vs dedicated service (recommend v5 during Node-20).
- **Single box vs 2 nodes** for the app tier from day one (reliability vs simplicity).
- **Which managed Postgres** (RDS / Oracle / Neon) — owner preference; all fine.
- **Moderation tooling** — build vs buy (Hive/OpenAI moderation API for text/image).
- **The 2× feature tax** — every family-facing feature ships twice (web + RN) *forever*; velocity
  roughly halves. Keep mobile scope ruthlessly small.
- **Scale bites first at:** Postgres connections Saturday morning → push fan-out bursts → the single
  box. Mitigate with pgbouncer, queued fan-out, and 2 app replicas.

---

## Appendix A — adversarial review corrections (what changed vs the first draft)

1. **Keep Next.js as the API** (don't build a standalone service — re-porting 139 routes is a
   rewrite trap). Add a *sidecar* instead.
2. **Rent Postgres** (managed / separate host) — self-hosting the DB contradicts "reliability
   paramount" given Saturday-morning spikes.
3. **Native auth is a first-class workstream**, not a detail (NextAuth v4 is cookie-bound + EOL-ish).
4. **App Store economics on Family Pass** must be modeled → bundle/reader-app, never in-app steering
   in Canada.
5. **Child-safety/moderation** is mandatory store scope for chat with minors.
6. **Media storage** (data-URLs in Postgres) must move to object storage before mobile media.
7. **Don't rebuild the live-scoring console in RN** — keep it web/webview.
8. **FCM alone covers iOS+Android**; blue-green deploys or sockets drop mid-game; upgrade off Node 18.

## Refs
[[mobile-pwa-push]] (superseded by this — native, not PWA) · [[observability-security]] ·
[[live-scoring-design]] · [[project_scoring_and_content]] · payments: `docs/payments-open-items.md`

⬅ [[_dashboard|Roadmap dashboard]] · [[_moc-platform]]
