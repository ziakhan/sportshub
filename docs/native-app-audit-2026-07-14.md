---
status: implemented-locally
date: 2026-07-15
owner-action: approve box deploy + OTA (ship train below)
supersedes: v1 report (same day) — v1 misframed complaints #1–#3; v2 audits against site-ia-plan §5.6
---

> **BUILD OUTCOME (2026-07-15, owner said "do everything" + NO WEBVIEWS
> anywhere):** all phases below are implemented locally — anonymous boot,
> branded top bar, native Browse layer (clubs/club/leagues/season/programs/
> program-register/news/article/game), native my-layer (kids, full calendar
> w/ inline RSVP, account hub/profile/payments/notifications, referee kit,
> coach team kit w/ RSVP roll-ups + poll voting), native OPERATOR summary
> (webview plan dropped per owner), native sign-up, push tap deep-linking +
> foreground banners + HIGH channel, token-lifecycle fixes incl. server
> rotation grace window. Webviews: ZERO — expo-web-browser is no longer
> imported anywhere.
>
> Verified: web 259 unit + 273 integration (incl. 2 new grace-window tests),
> sidecar 13, tsc clean ×3, expo lint clean, live smoke of every new endpoint
> on the dev server (anonymous + bearer as parent + club owner).
>
> **Ship train (owner-gated):** ① box deploy (new /api/mobile/* routes,
> public-paths allowlist, players bearer fix, rotation grace, sidecar
> channelId) → ② `eas update --channel preview` (new app shell; JS-only, no
> new native deps) → ③ next APK build picks up splash/icon rebrand +
> userInterfaceStyle:light (only build-affecting bits left).

# Native App Audit v2 — 2026-07-15

Audited against the **agreed spec** (site-ia-plan §5.6): three layers with
**Browse (public) first**, and the **"MOBILE IS MOBILE" invariant** — native
app and mobile web are ONE surface in two wrappers, identical capabilities;
webviews sanctioned ONLY for read-only operator worlds, never the my-layer.

## The core finding

**The app was built as a logged-in companion applet, not as SportsHub in a
native wrapper.** Every owner complaint traces to that one architectural
choice:

| Spec (§5.6) | App today |
|---|---|
| Browse layer: anonymous users browse leagues/clubs/programs/scores/news | **Hard login wall at boot** — fresh install shows sign-in, nothing else |
| My-layer (kids, calendar, account, referee kit) = **Mobile-full → native** | Punts to cookie-less web browser tabs |
| Menus on top: Scores · Leagues · Clubs · News · Programs · Marketplace | No browse menus exist at all |
| One design in two wrappers | Stock headers, inverted surfaces, template splash/icon |
| Native raison d'être #1: push | Push tap goes nowhere (deep-link data unread) |

The fix is a **shell rebuild + Browse layer + my-layer native screens**, not a
patch list. The M0–M4 plumbing underneath (bearer auth, chat, offers +
Payment Sheet, alerts, live scores, realtime, push registration) is solid and
carries over.

---

## 1. Login wall — no anonymous mode (complaint #1)

`app/_layout.tsx:44` — `Stack.Protected guard={signedIn}`: signed-out users
(including every fresh install) can only see the sign-in screen. There is no
skip, no browse-first, no guest state. The web is the opposite: anonymous
users get the full public site; login only unlocks the personal band and
role surfaces.

**Target**: boot straight to Home (public Browse content) for everyone.
Sign-in becomes a top-bar button ("Log in / Start Free", web parity) and a
just-in-time gate on personal tabs/actions (RSVP, chat, offers). Signed-in
users additionally get the personal band + role tabs — same page, richer,
exactly like the web homepage.

**Secondary (still real): signed-in sessions get destroyed.** Kept from v1 —
these explain login prompts *after* you've signed in, and they stay relevant
once anonymous mode exists:
- Client wipes tokens on ANY refresh failure (`lib/api.ts:97`), including the
  502s nginx serves during every box deploy — not just genuine 401s.
- Server refresh rotation has no grace window (`apps/web/src/lib/native-auth.ts:65-84`):
  a lost rotation response (app killed mid-request, OTA JS reload) leaves the
  phone holding a superseded token → next use reads as theft → whole session
  family revoked. Access tokens last 15 min, so nearly every app open rotates.
- SecureStore read failure at boot is silently treated as signed-out
  (`lib/session.tsx:34`, no catch).

## 2. My-layer punts to web views (complaint #2)

Owner is right and the spec agrees: **Mobile-full surfaces must be native**.
Webviews are allowed only for read-only operator worlds ("mobile-visible"
class), and even those should be embedded, authenticated views — not the
external cookie-less browser tabs used today (`expo-web-browser`, where the
native login means nothing).

| Surface | Today | Spec class → target |
|---|---|---|
| My Kids (kid profile, RSVPs, payments) | browser tab → `/players` (login wall) | **Mobile-full → native screens** (kid list → kid detail: schedule, RSVP, payments, team) |
| Calendar (full) | native 7-day list, "full calendar" → browser tab | **Mobile-full → native** month/agenda + RSVP inline |
| Account (profile, payment methods, receipts, security) | browser tab → `/account` | **Mobile-full → native** `/account`-style pages |
| Referee kit (assignments, availability) | browser tab → `/referee` | **Mobile-full → native** |
| Coach team workspace (roster, attendance, polls) | browser tab → team dashboard | **Mobile-full → native** coach kit |
| Scoring console | absent | Mobile-full — later milestone (was always planned native/offline) |
| Operator dashboards | browser tab → `/dashboard` (login wall) | **Mobile-visible → embedded authenticated WebView** of mobile web (single source, no drift) — the ONE place a webview is correct, and it needs the session bridge to work |

**Order-of-build input**: kids + calendar + account are parent-daily surfaces
→ first. Coach kit next. Referee after. Operator embed last (needs the
one-time-token → cookie bridge, security-reviewed).

## 3. Browse layer doesn't exist (complaint #3)

The web's top nav — anonymous or signed-in — is: **Scores · Leagues ▾ ·
Clubs ▾ · News · Programs · Marketplace**, backed by public pages (`/scores`,
`/leagues`, `/club` directory + club profiles, `/news`, `/events`,
`/marketplace`, plus game/team/player/tournament pages). The native app has
none of it — a 3-row "Browse" card on Home, one row of which points at
`/clubs`, an **auth-gated management route** (live-verified: 307 → sign-in;
the public directory is `/club`).

**Target**: native Browse destinations matching the web menu, reachable from
the top bar (and Home sections), anonymous-accessible:
- **Scores** — exists natively already ✓ (add game detail)
- **Leagues** — native list (standings/schedule per league; public league API
  already serves the web)
- **Clubs** — native directory w/ search (mirror `/club` + club profile
  screens: about, teams, programs, reviews)
- **Programs/Marketplace** — native list → program detail → register (register
  flow can start as an authenticated embed until native registration ships)
- **News** — native list → article
Home (per §5.6.3): personal band on top for signed-in users, **public content
below for everyone** — the web homepage's shape, not a private-only screen.

## 4. Push tap goes nowhere — confirmed, mechanism found (complaint #4)

Owner's device observation (app closed → tap push → lands on home) is exactly
what the code does. Every push already carries its destination — the sidecar
sends `data: { link, type }` (`apps/sidecar/src/push.ts:119-121`) — but the
app **never reads it**:
- No `addNotificationResponseReceivedListener` → taps from
  background/killed state are ignored (app just opens where it was).
- No cold-start check (`getLastNotificationResponseAsync` /
  `useLastNotificationResponse`) → killed-state taps ignored too.
- No `setNotificationHandler` → pushes arriving while the app is OPEN are
  silently dropped (no banner at all).
- Android channel importance DEFAULT (`lib/push.ts:31`) → no heads-up banner
  even in background; notifications land silently in the tray.

**Fix spec** (one bootstrap in the root layout): on tap, read `data.link` and
route through a web-path → native-route map — `/teams/:id/chat` → chat
thread, `/offers/:id` → offer, `/live/:id` → scores/game — the same mapping
`alerts.tsx:74-85` already does for the in-app alerts list (which also drops
`/live/*` today; extend it). Plus foreground handler + HIGH-importance
channel (note: Android channel importance is sticky per install — needs a
new channel id to take effect on existing installs).

## 5. Design: "identical to the web" is the bar

Per spec (one surface, two wrappers) and owner direction:
- **Branded sticky top bar on every screen** (the "menus on top"): play-600
  logo tile + wordmark · browse menus (Scores/Leagues/Clubs/News/Programs —
  phone pattern: horizontal pill row under the bar, exactly like the web's
  <lg header) · bell · avatar/account (signed-in) or "Log in / Start Free"
  (anonymous). Web reference: `(public)/layout.tsx`.
- **Surface scheme**: match web — `#fafafa`/ink-50 page, white cards with
  soft shadows, SectionHeader with colored eyebrow labels, status tones.
  Native currently inverts this (white page, flat gray-bordered cards) —
  most of the "very plain" feel.
- **Brand assets**: splash `#208AEF` and icon bg `#E6F4FE` are stock-Expo
  template blues — not palette colors (play-600 `#4f46e5`). Rebrand both
  (needs a new build; everything else ships OTA).
- **Dark-mode hazard**: `userInterfaceStyle: "automatic"` with hardcoded
  light styles — force light until a real dark theme exists.
- Keep bottom tabs for the signed-in personal layer (§5.6.6 spec'd them:
  Home · Chat · Calendar · context slot · Profile) — they complement, not
  replace, the top bar.

---

## What carries over unchanged

Bearer auth + refresh model (with the lifecycle fixes above) · chat (list,
thread, realtime pings, delta polling) · offers + Stripe Payment Sheet ·
alerts inbox · live scores + socket · push registration/quiet hours · EAS
Update pipeline. The rebuild is the shell + Browse + my-layer screens on top
of this plumbing.

## Proposed build phases (owner picks order/scope)

- **P1 — Shell rebuild** (unblocks everything): remove login wall (anonymous
  boot → Home), branded top bar + design primitives (Screen/Card/
  SectionHeader/status tones), web-parity Home (public sections + personal
  band when signed in), fix `/club` vs `/clubs`. `OTA`
- **P2 — Browse layer native**: clubs directory + club profile, leagues +
  league standings/schedule, programs/marketplace list, news, game detail.
  `OTA`
- **P3 — My-layer native**: My Kids (list + kid detail w/ RSVP + payments),
  full calendar, account pages, referee kit, coach team kit. `OTA`
- **P4 — Push deep links + reliability**: tap routing + foreground handler +
  HIGH channel; token-lifecycle fixes (401-only clear, rotation grace window
  server-side, boot hardening); localhost fallback → prod URL. `OTA`
- **P5 — Operator embed**: session bridge (one-time token → cookie,
  security review) + embedded authenticated WebView for operator read-only
  worlds. New APK when P1–P4 settle (splash/icon + any native deps).

Per-screen APIs mostly exist (public pages have public queries; my-layer has
bearer-capable routes); new native-shaped endpoints like `/api/mobile/home`
can be added per screen where the web queries are page-coupled.
