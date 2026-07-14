---
updated: 2026-07-14
tags: [theme/ux, type/plan, status/in-progress]
---

# N3-v2 implementation plan — task-first navigation (LOCAL ONLY)

Spec: [[site-ia-plan]] §5.6. Owner rules for this build: **implement locally,
NO push to origin, NO push/deploy to the Oracle box** — owner tests on the
local dev server, then decides.

## 1. Current-state findings (recon 2026-07-14)

| Piece | State | Reuse |
|---|---|---|
| `/api/chat/summary` | EXISTS — teams + unread counts | Powers /messages page, tab badge |
| ChatDock (`components/chat-dock.tsx`) | EXISTS — floating dock, public layout only | Keep DESKTOP-only; mobile replaced by Chat tab |
| `/calendar` + lenses | EXISTS (platform) | Calendar tab/icon target; reuse its query for Your Week |
| `nav-config.ts` role groups | EXISTS (Parent group: /players /offers /events /payments) | Account hub links; badge menu roles |
| UserMenu | Minimal (extraLinks + profile + signout) | Replace with badge switchboard v2 |
| MobileNav (platform) | Hamburger drawer (portal) | KEEP for operator workspace nav; bottom bar is global layer |
| Home page | Anonymous v1 + some personalization (YourTeamsRail) | Personal band goes above existing sections |
| Post-login | `/post-login` route (operators→dashboard, else→/) | Add coach→team branch |

## 2. Gap analysis (what the spec didn't cover — decisions)

1. **Notification bell**: stays in the top header on both layouts, both
   breakpoints (not a bottom tab; not buried in Profile).
2. **ChatDock vs bottom bar**: dock becomes desktop-only (`hidden lg:block`
   wrapper); on mobile the Chat tab → /messages replaces its full-screen
   mode. One chat model, two presentations.
3. **Hamburger vs bottom bar** (platform, mobile): coexist — hamburger =
   operator workspace tree; bottom bar = global layer. Content gets
   `pb-[calc(64px+env(safe-area-inset-bottom))]` when the bar renders.
4. **Context-slot priority** (4th tab) when multi-role: Dashboard (operator)
   > My Team (coach; picker if >1, ordered by next event) > My Kids
   (parent → /account/kids for now = /players). Player(self) → My Team.
   Referee → My Games (/referee).
5. **Signed-out**: no bottom bar, no icons — public header unchanged.
6. **Empty personal band** (no contexts, e.g. brand-new account): band
   renders nothing; homepage = current v1. No empty-state lecture.
7. **Impersonation banner**: stays top; bottom bar unaffected.
8. **Unread badge freshness**: server-render initial count in layouts;
   client refreshes via existing summary endpoint on focus + 60s (dock
   already polls 30s — do NOT double-poll on desktop: tab badge reads the
   dock's cadence via a shared hook later; v1 accepts two pollers only on
   /messages page itself).
9. **Back behavior**: tabs are plain `<Link>`s — no history traps.
10. **Naming**: "Chat" everywhere (never "Messages" — matches team tab);
    "Account & Settings" in badge; tab labels Home·Chat·Calendar·(context)·
    Profile.
11. **Tests**: `layout.test.tsx` + generated navlink tests will need
    updating — expected, not collateral.

## 3. Homepage spec — "what should be on the home page for everybody"

**Anonymous** (unchanged this build): hero + search, featured clubs, scores
strip, news, programs.

**Signed-in participant** — order encodes priority: *money/attendance
actions → this week → live → content → discovery*:

1. **Needs attention** (renders only if non-empty; max 4 cards, horizontal
   scroll on mobile): open offer to accept (deep link) · payment due ·
   events awaiting RSVP (count → calendar) · unread chat (n → /messages).
2. **Your week**: next 7 days across ALL contexts (entity-graph merge),
   date-grouped compact rows: context chip (kid initial/team color/whistle)
   + title + time/venue + RSVP state (inline going/not from the card).
   Footer link "Full calendar →".
3. **Live now / scores** (existing strip; user's teams already pinned).
4. **News & recaps** (existing, follows-first).
5. **Programs near you** (existing discovery tail).

Operators with no participant contexts: band naturally collapses (see gap
6); their world stays the dashboard.

## 4. Build stages (each = local commit; nothing leaves the machine)

- **A. `lib/queries/my-contexts.ts`** — one resolver used by band, badge,
  tabs, /messages: `{ kids[], coachTeams[] (nextEventAt), refereeing,
  operator{clubs,leagues,admin}, weekEvents[], actionsDue{offers,payments,
  rsvps,unread} }`. Reuses calendar-lens + chat-summary queries.
- **B. Badge menu v2** — `components/nav/account-menu.tsx` replacing
  UserMenu contents (44px rows, groups): Home · Dashboard? · My Team(s)? ·
  Calendar · Chat · Account & Settings · Sign out. Same component both
  layouts.
- **C. Bottom tab bar** `components/nav/bottom-tabs.tsx` (client; `lg:hidden`,
  signed-in only; safe-area padding; active state from usePathname) +
  desktop header icons (Calendar link, Chat link w/ unread badge) in both
  layouts. ChatDock wrapper → desktop-only.
- **D. `/messages`** — full-page conversation list from `/api/chat/summary`
  (unread-first, context chips, relative time) linking to
  `/teams/[id]/chat`. Lives in (platform) group (it's personal, needs auth).
- **E. Home personal band** — server component `home-personal-band.tsx`
  fed by getMyContexts, injected at top of `(public)/page.tsx` signed-in
  branch, above existing sections.
- **F.** `/account` hub page (tile links: My Kids→/players, Payments→
  /payments, Offers→/offers, Profile & security→/settings/profile,
  Notifications→/notifications, Calendar feeds→/calendar) · post-login
  coach branch (coached team(s): 1→`/teams/[id]`, >1→`/teams`) · platform
  logo → `/`.
- **G.** Test updates + 390px walkthrough (every changed surface: no
  horizontal scroll, 44px targets) + dev-server demo script for owner.

**Deferred (explicitly NOT this build):** dashboard sidebar sub-group
restore (§5.6.8) — separate revert-style change; native app alignment;
mobile read-only-defer views for operator pages; sport sections.

⬅ [[site-ia-plan]] §5.6
