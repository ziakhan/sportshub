---
updated: 2026-07-15
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

### Chat: photo sharing 💡 (owner-confirmed 2026-07-15)
Blocked on the object-storage decision (no bucket yet — same gate as the
content-feed creator uploads, see [[content-feed-strategy]] §9.2). When it
lands: image messages in team chat + DMs, consent-scoped for minors.

### Chat: read receipts 💡 (owner-confirmed 2026-07-15)
Privacy trade-off is the owner's call (staff-only visibility vs everyone).
Plumbing half-exists (ChatRead cursors + DM lastReadAt).

### Chat: @mentions 💡 (owner-confirmed 2026-07-15)
Roster-derived autocomplete, mention = targeted bell even when the thread
is otherwise debounced; pairs well with per-team mute exceptions.


### ~~RSVP + attendance for calendar items~~ ✅ SHIPPED 2026-07-11
Built as spec'd (ledger has the full note; runbook #24): EventRsvp +
`PUT /api/rsvp`, family buttons on the calendars, staff roll-up with
names, scoring-console pre-mark, late-flip staff bell, daily reminder
cron. Same-day follow-up (owner-directed): **My Calendar** — one
cross-team feed at `/calendar` in the sidebar, color-coded ✓/?/✕
controls, and interactive grid popovers on both calendars
([[my-calendar-plan]]). Remaining cuts: no RSVP on the public /live
page (anonymous — no viewer identity); `note` is API-level only, no
family input box yet.

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

### Shell-club activation funnel 💡 (owner business model, 2026-07-12)
Leagues enter non-joined clubs manually at session one (100%-coverage rule)
— those UNCLAIMED shells must get pulled in: claim prompts where league
schedules touch their teams, season-one contact outreach (GTM enriched
contacts), and in-product "your families are already here" activation
nudges toward running registrations. The club funnel is product, not
sales ([[business-model-scenarios]] V2).

## Engagement / content

- **Quizzes** 💡 — same engine as polls + a correct answer + scoring/
  leaderboard (rules quizzes, film sessions). (engagement-features-plan.md)
- **Club-wide / league-wide polls + public poll results** 💡 — polls beyond
  a single team; read-only results on public pages. (Team-poll UI itself
  redesigned 2026-07-16 — Energy Pass bubble, native in-place voting.)
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

## Shot chart (owner 2026-07-15/16 — DESIGN SETTLED, roadmapped for a later scoring round)
- Location = `{x,y}` metadata ON the shot event itself — NO third action; the
  assist/rebound/narrative-line linkage and future chart all hang off the one
  shot event. Undo unchanged, no schema change.
- Capture UX: after the player tap, a half-court flashes up — tap to place or
  ignore (auto-dismiss, no location). FTs skip it. Cost: +1 optional tap per
  FGA (~60-100/game) — hence discretion below.
- Three-layer scorekeeper discretion: pre-game checklist question (default
  OFF, like the clock question) + live in-console toggle + per-shot skip.
  Guest scorekeepers default OFF. Partial charts are valid charts.
- Rendering: Plays-tab half-court (made = filled team-color dot, missed = X,
  quarter filter) — only when data exists; old games unaffected. Native chart
  needs react-native-svg → ship with the next BINARY (bundle with the native
  Google sign-in build). Estimate: console+web ~2 evenings, native +1.

## Team preferred short name (owner 2026-07-15)
- Youth team names are long and collide within a club ("Toronto Lords" for
  every grade). Add owner-editable short name (e.g. "Lords G10", "Force U11")
  used on score surfaces, chips and native cards. Until then the game page
  derives "initials · G##/U##" from the full name (shortTeam() in live-view).

## Auth cross-platform completion (owner 2026-07-16 — REMIND HIM)
- ~~**Web Sign in with Apple**~~ ✅ SHIPPED 2026-07-16 (runbook #32): NextAuth
  Apple provider (ES256 client-secret JWT from portal key 74SRFS3C24), buttons
  both auth pages, SameSite=None cookie fix for Apple's form_post callback,
  Services ID `com.ysportshub.web`. Box-deployed + prod-verified; owner
  click-through owed.
- ~~**Native Google sign-in (Android + iOS)**~~ ✅ SHIPPED 2026-07-16
  (`c131643` + pod fix `613d679`): owner created both OAuth clients;
  /api/auth/token/google live on box (JWKS verify, verified-email required,
  ensureGoogleUser); buttons on native sign-in + sign-up, guarded require so
  old binaries never crash. iOS TestFlight build 7 + fresh Android APK carry
  the native module. Gotcha fixed en route: GoogleSignIn's AppCheckCore Swift
  pod needs GoogleUtilities + RecaptchaInterop `modular_headers` (via
  expo-build-properties extraPods) or pod install fails on EAS.
