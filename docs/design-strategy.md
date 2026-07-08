---
updated: 2026-07-02
tags: [theme/content-ux, type/design, status/in-progress]
---

# SportsHub — Public Experience & Design Strategy

> Design consultation, June 2026. Grounded in an audit of the current code + the
> ui-ux-pro-max design intelligence. Scope: public-facing pages first (home,
> club, league, team), then role-aware navigation and dashboards. Forward-looking
> for news / video / photo / live-score content on entity pages.

---

## 0. TL;DR — the five moves

1. **Unify the two design languages.** The marketing home page is polished
   (play/court/hoop palette, `rounded-[28px]`, `shadow-soft`); every inner public
   page (club, tryout, league, tournament, camp) is utilitarian gray + orange.
   This is the single biggest visual problem. One system, applied everywhere.
2. **Turn club / league / team pages into "hubs"** with a tabbed content shell:
   Overview · News · Media · Schedule · Standings · Roster. This is where your
   future news/videos/photos/highlights live. **A public Team page does not exist
   yet — it's the keystone of the content vision and must be built.**
3. **Surface the data you already compute.** Standings, schedules, and (soon)
   scores have backends but no public UI. These are the "fan engagement" surfaces.
4. **Make multi-role navigation legible** with an explicit active-context switcher
   instead of stacking every role's menu at once.
5. **Build a real component library** (`packages/ui`) so the system is enforced,
   not re-inlined per page.

---

## 1. The core problem: two design systems collide

| | Marketing home (`(public)/page.tsx`) | Inner public pages (club, tryout, league…) |
|---|---|---|
| Palette | play / court / hoop / ink (brand) | gray-50/200 + orange-500 (generic) |
| Cards | `rounded-[28px] shadow-soft border-ink-100` | `rounded-lg border-gray-200 shadow-sm` |
| Type | `font-display`, gradient headlines | default sans, flat |
| Feel | Premium, considered | Utilitarian, templated |

A family's journey is **home → club → tryout/league**, so they cross the seam on
the *most important* conversion path. Fixing this is mostly mechanical (swap gray→ink,
orange→hoop, `rounded-lg`→`rounded-2xl/3xl`, add `shadow-soft`) but it must be
systematized, not hand-patched, or it drifts again.

**Decision baked in here:** *keep and systematize the existing brand palette.* It's
already distinctive (indigo+orange+green is more ownable than generic sports-red).
We borrow *energy* from the sports-arena playbook only where it pays off — bold
condensed numerals for scores/stats, duotone media tiles, and live indicators —
without repainting the whole product red.

---

## 2. Design system foundation

### 2.1 Palette (extend, don't replace)

Keep `play` (indigo, primary), `hoop` (orange-red, energy/CTA), `court` (green,
positive), `ink` (neutral). **Add two semantic tokens** for the content era:

- `live` → a vivid red (e.g. `#EF4444`) reserved *only* for live/in-progress
  states (live score dot, "LIVE" badge). Scarcity makes it meaningful.
- `gold` → an accent (`#FBBF24`) for highlights, MVP/featured, championship/standings
  leaders. Used sparingly.

> Rule from the audit: **never use color alone.** Every status (LIVE, FINAL, Open,
> Full) pairs color with an icon + text label.

### 2.2 Typography

Today: one display + one body. **Add a condensed numeric display face** (e.g.
Bebas Neue / Oswald) used *only* for scores, big stats, and standings numbers.
Sports UIs live or die on how scores read; a tall condensed numeral makes
"72–68" feel like a scoreboard, not body copy. Body stays a humanist sans
(Source Sans 3 / current body) at ≥16px on mobile, line-height 1.5–1.75.

### 2.3 Component library to build (`packages/ui`)

Today the shared library has exactly **one** component (Button); everything else
is inlined. Build these as the backbone of the system:

| Component | Replaces inlined… | Used on |
|---|---|---|
| `Card` / `CardLift` | the `rounded-[28px] shadow-soft` idiom | everywhere |
| `Badge` (status variants) | hand-rolled pills | all pages |
| `SectionHeader` (line + label) | the marquee header pattern | public pages |
| `Tabs` | — (new) | club/league/team hubs |
| `ScoreCard` | — (new) | schedule, team, highlights |
| `StandingsTable` | — (new) | league, team |
| `MediaTile` (photo/video) | — (new) | news/media tabs |
| `NewsCard` | — (new) | news tabs, home |
| `StatBlock` | dashboard stat cards | dashboards |
| `EntityHeader` (banner) | club/league/tournament headers | all hubs |

---

## 3. Information architecture — public sitemap

Current public nodes: `/`, `/club/[slug]`, `/tryout/[id]`, `/marketplace`,
`/events`, `/league/[id]`, `/tournament/[id]`, `/camp/[id]`, `/house-league/[id]`.

**Add (the content + competition surfaces):**

```
/team/[id]                 ← NEW. The keystone public page.
  ├ overview  (record, next game, latest news)
  ├ schedule  (games + scores)
  ├ roster    (if league permits public rosters)
  ├ standings (their division context)
  └ media     (photos, videos, highlights)

/league/[id]               ← expand existing
  ├ overview
  ├ standings   (table you already compute, no UI yet)
  ├ schedule    (games/scores)
  ├ teams       (links to /team/[id])
  └ news/media

/club/[slug]               ← expand existing
  ├ overview (current content)
  ├ teams    (links to /team/[id])
  ├ programs (tryouts/camps/house leagues — current)
  └ news/media
```

The unifying idea: **club, league, and team are all "hubs"** that share one
tabbed shell component. Build the shell once; the tabs differ by entity.

---

## 4. The hub shell (where future content lives)

```
┌──────────────────────────────────────────────────────────────┐
│  ╔════════════════════════════════════════════════════════╗  │ ← EntityHeader
│  ║  [crest]  RIVERSIDE RAPTORS U14 BOYS        [Follow]   ║  │   (brand color
│  ║           Metro League · 8–2 · 2nd in East             ║  │    banner)
│  ╚════════════════════════════════════════════════════════╝  │
│   Overview │ Schedule │ Roster │ Standings │ Media            │ ← Tabs (sticky)
│  ──────────────────────────────────────────────────────────  │
│                                                                │
│   ┌─ Next game ───────────┐   ┌─ Latest ─────────────────┐    │
│   │ SAT 2:00p  vs Hawks   │   │ [news/photo/video cards] │    │
│   │ Maple Gym · Court 2   │   │                          │    │
│   └───────────────────────┘   └──────────────────────────┘    │
│   ┌─ Recent results ──────────────────────────────────────┐   │
│   │ FINAL  Raptors 72 – 68 Wolves      [highlights ▸]     │   │ ← ScoreCard
│   │ FINAL  Raptors 55 – 61 Kings                          │   │
│   └───────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

- **Overview** = the at-a-glance fan page: record, next game, last results,
  newest media. Auto-assembled, no manual upkeep needed to look alive.
- **Schedule** = `ScoreCard` list, past games show final scores + a highlights
  link, future games show date/venue/court.
- **Media** = `MediaTile` grid. **Video is click-to-play, never autoplay**
  (`preload="none"`, muted, `playsInline`) — flagged by the audit for data/energy.
- **News** = `NewsCard` feed (title, cover image, excerpt, date, author).
- **Standings** = shared `StandingsTable`, leader row accented `gold`.

Content model (future): a small `Post` table (type: NEWS | PHOTO | VIDEO |
HIGHLIGHT, scope: club/league/team, body, mediaUrl, publishedAt). One model feeds
all three hubs' News/Media tabs. Live-score highlights become auto-generated
HIGHLIGHT posts when a game finalizes.

---

## 5. Home page reorganization

The current home is strong but ~1200 lines and **product-feature-led** (it sells
the SaaS: "Tryout Management", "Offer Pipeline"). For a *public/fan* audience the
pattern intelligence recommends a **Community** structure: lead with life and
activity, then routes for each audience.

Proposed section order (keeps the good hero + bento, re-sequences for audience):

```
1. HERO            value prop + dual CTA (Find a program  /  Run your club)
                   + live ticker strip: "3 games live now · 41 tryouts open"
2. AUDIENCE SPLIT  three doors: Families · Clubs · Leagues  (each → its journey)
3. HAPPENING NOW   live/upcoming games + newest highlights (the fan hook)  ← NEW
4. PROGRAMS        upcoming tryouts (existing, restyled)
5. FEATURED CLUBS  (existing)
6. PLATFORM PROOF  stats snapshot (existing dark section)
7. FOR ORGANIZERS  the bento feature grid, reframed as "run your program"
8. CTA             (existing)
```

Two changes do the heavy lifting: an **audience split** near the top (so a parent
and a club owner immediately see *their* path — today both get the same SaaS
pitch), and a **"Happening now"** band that previews live games/highlights (the
single biggest driver of repeat visits once scoring ships).

> Sticky-nav note from the audit: the public header is sticky — ensure content
> sections carry top padding so the first section never hides behind it.

---

## 6. Role-aware navigation & dashboards

### 6.1 The multi-role problem

Today the sidebar **stacks every role's menu** (a Parent+ClubOwner+Referee sees
Parent + Club + Staff + Browse + Referee sections at once), and `primaryRole` is
naively `roles[0]`. With roles now accruing freely from actions, this gets worse.

**Fix: an active-context switcher.** One control at the top of the sidebar:

```
┌─────────────────────────┐
│ ⌄  Riverside Raptors     │  ← current context (club / league / "Personal")
│    Club Owner            │
├─────────────────────────┤
│   Personal (Parent)      │  ← switch surfaces
│   Riverside Raptors      │
│   Metro League           │
│   Referee                │
└─────────────────────────┘
```

The sidebar then shows **only the active context's** menu. This collapses the
cognitive load, makes `primaryRole` meaningful (it becomes "last active context"),
and scales as users collect roles. Cross-context items (Notifications, Profile,
the `+ New` menu) stay global.

### 6.2 Admin "command center"

The admin dashboard is solid (8 stat tiles, recent clubs, users table) but reads
as isolated counters. Make it a genuine operational picture:

- **KPI tiles with trend** (▲ 12% vs last month) instead of bare counts.
- **A platform activity feed** (signups, claims, club created, season finalized) —
  the club dashboard already has this pattern; lift it to admin.
- **"Needs attention" rail**: pending club claims, flagged reviews, seasons
  awaiting finalize, failed payments (once Stripe lands). This is the "full
  picture of what's happening" you asked for — one place that tells the admin
  what to *do*, not just what *is*.

### 6.3 Club owner

Already the richest dashboard (workspaces, team grid, offer pipeline, activity).
Gaps to close: an **upcoming schedule strip** and, post-Stripe, a **revenue tile**.
Otherwise it's the model the other roles should aspire to.

### 6.4 Parent

Minimal today (players, signups, payments). Add a **"Needs you" card**: pending
offers to respond to, payments due, upcoming tryouts for my kids, next games.
Parents want *next actions*, not counts.

---

## 7. Phased rollout

Design work is sequenced so each phase ships a visible win and de-risks the next.

| Phase | Deliverable | Why first |
|---|---|---|
| **D1 — System** | `packages/ui` core (Card, Badge, SectionHeader, EntityHeader, StatBlock, Tabs) + token extensions (live, gold, numeric font) | Everything else consumes it |
| **D2 — Unify** | Restyle club/tryout/league/tournament/camp public pages onto the system (kill gray/orange) | Biggest consistency win, low risk |
| **D3 — Hubs** | Tabbed shell + **new `/team/[id]`** + league standings/schedule UI (data already exists) | Unlocks the content vision + surfaces built data |
| **D4 — Home** | Re-sequence home (audience split + "Happening now") | Conversion + fan hook |
| **D5 — Nav** | Active-context switcher; admin command center; parent "Needs you" | Role clarity |
| **D6 — Content** | `Post` model + News/Media tabs + highlight auto-posts (rides on live scoring) | Depends on scoring; last |

D3 and D6 interlock with the **live scoring** workstream: scores power the
ScoreCards and auto-generate highlights. D6's revenue tiles interlock with
**Stripe**. So the design plan and your two feature tracks converge — scoring and
payments aren't separate from this; they're the *content* these surfaces display.

---

## 8. Anti-patterns to avoid (from the audit)

- No emojis as icons — SVG only (Heroicons/Lucide), consistent 24×24 viewBox.
- Color never the sole signal — pair with icon + label.
- No autoplay video — click-to-play, `preload="none"`.
- Don't reintroduce per-page inlined styles — consume `packages/ui`.
- Respect `prefers-reduced-motion`; transitions 150–300ms.
- Mobile body text ≥16px; verify 375 / 768 / 1024 / 1440.
```
