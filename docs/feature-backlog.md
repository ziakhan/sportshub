---
updated: 2026-07-11
tags: [theme/ledgers, type/ledger, status/living]
---

# Feature backlog — requested but not built

The single place feature ideas land so none get lost. This is NOT go-live
gating (that's docs/launch-blockers.md) and NOT the work log (that's
docs/outstanding-items.md). Just the wishlist, roughly prioritized. We build
these ONE cohesive feature at a time, fully — never as a batch.

Legend: 🎯 owner-committed · 💡 owner-suggested · 🔬 researched · ⏸ parked pending a decision.

---

## Near-term / high value

### ~~RSVP + attendance for calendar items~~ ✅ SHIPPED 2026-07-11
Built as spec'd (ledger has the full note; runbook #24): EventRsvp +
`PUT /api/rsvp`, family buttons on the team-calendar agenda, staff
roll-up with names, scoring-console pre-mark, late-flip staff bell,
daily reminder cron. Deliberate cuts from the original spec: no buttons
in the grid view (agenda is the interaction surface) and none on the
public /live page (it's anonymous — no viewer identity to key on);
`note` is API-level only, no family input box yet.

### Playoff generation 🎯 (owner-committed)
Top-N per division from standings → bracket → PLAYOFF sessions. Settings +
schema exist; no generator yet. (ledger)

### Homepage phase 2 💡
Fill the freed signed-in space: a "Your week" row (next game + next
practice), a getting-started nudge for empty accounts, reframe the
Programs/Clubs headings ("Near you"). (docs/home-redesign-plan.md)

### Site IA / menu cleanup 💡
Scores→Leagues, programs-vs-marketplace overlap, menu order. Seen in every
demo's nav. (docs/site-ia-plan.md)

### Editability fix waves 2–4 🎯 (owner-directed audit, 2026-07-09)
The full entity-lifecycle audit lives in **[[editability-audit]]** — wave 1 (program edit
pages, registrants views, lifecycle chips, guard fixes) SHIPPED 2026-07-09. Queued there:
**wave 2** offer rescind + expiry cron, game "Correct result" UI, division rename, club
self-withdraw, staff-invite cancel/expiry; **wave 3** mediaConsent editor, player remove
button, designation promote, email/password self-service; **wave 4** recap/review/poll/
announcement/chat edit round-trips + notification dismiss. Pull from the audit doc, not here.

### Clickable venue on registration pages 💡 (owner, 2026-07-09)
On **Camp**, **House League**, and **Tryout** registration pages the venue shows
as **plain text only** — not clickable, no map/details. Today `Camp.location`,
`HouseLeague.location`, `Tryout.location` are free-text `String`s (schema), while
the real `Venue` model (with `placeId`, lat/long, used by games/practices/
tournaments via `venueId`) is NOT linked to these three. Two paths:
- **Quick win (no schema change):** wrap the location text in a link to Google
  Maps (`https://www.google.com/maps/search/?api=1&query=<encoded location>`) so
  it opens directions. Ships today; works off the string.
- **Proper:** migrate these three `location` strings → a `venueId` relation to
  `Venue`, then render a real clickable venue (address, embedded map, directions,
  "other events here"). Reuses existing Places autocomplete + placeId dedup.
Files: `(public)/camp/[id]/page.tsx`, `(public)/house-league/[id]/page.tsx`,
`(platform)/tryouts/[id]/page.tsx` (each renders `{…​.location}` as text).

---

## Engagement / content

- **Quizzes** 💡 — same engine as polls + a correct answer + scoring/
  leaderboard (rules quizzes, film sessions). (engagement-features-plan.md)
- **Club-wide / league-wide polls + public poll results** 💡 — polls beyond
  a single team; read-only results on public pages.
- ~~**Web push**~~ — substantially retired by the native track: M3 ships
  phone push via the notify() seam (quiet hours, sidecar worker); browser
  web-push remains unbuilt but is now a niche add-on, not a gap.
- **Marketing copy refresh** 💡 — "parents" → "parents or players"; refresh
  the platform pitch now that there's more product.

## Roles / GTM

- **Creator/recruiter roles** 💡 — videographer, photographer, influencer/
  content creator, third-party coach, university recruiter. (ledger §7)
- **Carpool** 🔬⏸ — researched (docs), owner said not yet. Density + liability
  are the risks; we already own roster+schedule+identity.

## Ops / scale

- **Review moderation queue** — reviews are publicly writable, no moderation
  (also launch-blocker H4).
- ~~**Chat scalability**~~ — substantially retired by M1 realtime: chat,
  scores and the bell ride sockets when the sidecar is up and fall back to
  polling when it isn't. Remaining at real volume: sidecar horizontal
  scale-out (Redis adapter is already in).
- **Onboarding checklists + /help center + tutorial videos** — scripts
  written (docs/tutorials/), recording pending.

---

## How we use this
Add a line the moment an idea comes up. When picking the next build, pull
from "Near-term / high value" first. Move an item to the ledger when it
ships. Keep specs light here; expand into a dedicated doc only when a
feature is greenlit for build.
