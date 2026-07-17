# Native app ↔ web parity audit — 2026-07-16

Owner directive: every workflow on iOS must exist, work, and look like the
mobile web (feedback_all_platforms_parity). iOS and Android render the same
code; "iOS looks different" is almost always a stale binary/OTA, not a fork.

## Fixed in this pass
- **Bottom tab capsule dead in build 6** — expo-router's vendored bottom-tabs
  passes `aria-selected`, not `accessibilityState.selected`; the focus check
  never fired → gray tabs. TabButton now reads both. (OTA'd.)
- **Offer accept blocked** — API always requires `jerseyPref1` (and
  `tracksuitSize` when included); native collected neither. Added jersey
  preference row (1st required, 2nd/3rd optional) + tracksuit size input +
  client-side guard. (OTA'd.)

## Verified present & on-spec (native)
- Auth: email/password, Sign in/up with Apple (iOS), magic-link server ready
- Browse: clubs/leagues/programs/news (image cards) · season detail
- Game page: web-parity via pre-folded /api/mobile/browse/game/[id]
- Home (anonymous + personal band), Scores list
- Chat: teams + DMs, reactions, pins, mute, typing, sender context, polls w/ voting
- Calendar: agenda w/ RSVP, start–end times, type colors, team coding
- Kids, Team home (schedule/roster/polls/chat), Offers (list + accept + Stripe pay)
- Referee + Operator tabs, Account (profile/payments/notifications), Alerts + push taps

## Known gaps (each needs an owner priority call)
1. ~~**Native Google sign-in**~~ ✅ shipped 2026-07-16 (backlog §Auth cross-platform has detail).
2. ~~**Offer installments**~~ ✅ built 2026-07-16 (plan picker w/ deposit +
   schedule; awaiting deploy).
3. ~~**Practice/team-event creation**~~ ✅ built 2026-07-16 (/team/new-event,
   chip-based scheduling, staff-gated; awaiting deploy).
4. **Scoring console** — web-only by design (works in the phone browser;
   guest links open web). Decide: keep as deliberate difference or build native.
5. **League/club operator deep management** — deliberate: native operator tab
   is a cockpit; heavy admin stays web.
6. ~~**Polls visual redesign**~~ ✅ built 2026-07-16 (Energy Pass bubble web +
   native, in-place native voting; awaiting deploy).
7. ~~App icon/splash still stock Expo~~ ✅ rebranded 2026-07-16 (ships with
   build 8/vc6); iOS APNs push key pending (owner); Apple Pay deferred.

## Audit method note
Screens enumerated from src/app; workflows spot-checked against their web
APIs (offer accept validated against respond-to-offer.ts requirements — the
kind of drift to re-check whenever web adds required fields to a shared API).

## Element-level parity sweep (owner escalation 2026-07-17 — "tired of the discrepancies")
The feature checklist above says WHAT exists on each platform; it never
compared HOW screens render. That gap is where the owner keeps finding
differences (chat header being the third strike). This section tracks the
retrofit, screen by screen — each row is a rendered-element comparison, not
a feature claim.

**Method (per screen):** open web-desktop, web-mobile (390px) and native
side by side → compare: header (title, subtitle, truncation, actions),
quick links/pills, list-item anatomy, empty states, type scale, status
colors. Log every mismatch here; fix in ONE cross-platform pass per screen.

| Screen | Status | Findings |
|---|---|---|
| Team chat header | ✅ fixed `f7ab4e2` | Native lacked the 3 quick links; web truncated the name on phones. Remaining nit: native header has no club-name subtitle (web shows "{club} • Team chat"). |
| Team chat body | ⏳ to sweep | Poll bubbles now shared (01b3d37). Compare: reactions row, pinned strip, sender context lines, edited tag. |
| Entity-row icon language | ✅ fixed `23b614b` | Ten rows/eight screens: entities → real marks (logo/monogram/avatar); generic glyphs retired. Web utility-tile adoption rides the Account pass. |
| My Kids (index + detail) | ✅ fixed (detail rebuilt to web card anatomy) | Chips hero, monogram team rows w/ jersey + club·age lines → team home. Index was already card-based. |
| Home (signed-in band) | ✅ fixed (web anatomy ported) | Urgency cards color-coded + day-grouped "Your week" w/ time column, location, RSVP pills. "My teams" = deliberate native extra. Date bug fixed `8e43e18`. |
| Team home | ⏳ to sweep | Web /teams/[id] (staff) vs /team/[id] (family) vs native /team/[id] — three variants. |
| Calendar | ⏳ to sweep | Cards recently unified (type-color edges) — verify start–end formats + action sheets match. |
| Scores | ⏳ to sweep | — |
| Account | ✅ fixed `e157f6d` | Web tiles adopt brand icon tiles (palette-following); native rows adopt web's detail lines. One language both sides. |
| Game page | ⏳ to sweep | Rebuilt for parity 2026-07-15/16 — verify leaders/team-stats blocks match current web. |

## Row & icon language RULING (2026-07-17, answers owner's "should they even be there?")
Two row tiers, IDENTICAL on web + native:
1. **Entity rows** (club, league, team, kid, program — anything with an
   identity): the leading mark is the entity's REAL mark — uploaded logo,
   else branded monogram initials (Monogram component / web club-card
   treatment). **Never a generic glyph** — no trophy-for-league,
   basketball-for-team, person-for-kid. Generic glyphs made native look
   "decorated" while web wasn't; they carry no information.
2. **Utility rows** (actions/settings: payments, alerts, edit profile,
   quiet hours): tinted icon tile riding the live brand color (the "purple
   tiles"). Web ADOPTS this treatment where it has bare text links — the
   tile language becomes shared, not native-only.
Empty-state icons keep their glyphs (they're illustrations, not marks).

## My Kids sweep spec (owner-called-out 2026-07-17)
- Kid DETAIL (native kids/[playerId]): replace generic ListRow+arrow stacks
  with the web /players page anatomy — kid header card (avatar, name, age,
  position), per-team cards w/ monogram + jersey + club line, upcoming
  items, RSVP state. Teams = entity rows (monogram, not people-glyph).
- Kids INDEX: already card-based; align type scale with web card.
- Web /players: adopt any richer elements native ends up with (single pass,
  both directions).

## OWNER DESIGN LAWS (2026-07-17 — govern every sweep pass)
1. **Every entity is clickable, on all three surfaces** — team, player,
   league, club, header, logo. A rendered entity that goes nowhere is a
   defect. (His words: "I'm going to repeat again on mobile web, on
   Android, on iOS.")
2. **Phone = phone**: mobile web and native are the SAME design; desktop is
   its wider layout. "Native extras" don't exist — a module either earns
   all platforms or none.
3. **No redundant navigation**: if the tab bar / site nav / a clickable
   entity name already reaches a place, no extra pill for it. (Chat header
   consolidated to name-link + Polls pill.)
4. **Coach home priority**: actions, week, my teams FIRST; public
   scores/news are not coach material. iOS's content idea is RIGHT; mobile
   web must adopt it (web home for participants currently leads them into
   scores+news — wrong).

## Queued from the 2026-07-17 rulings
- Web home (mobile): participant/coach band gains My teams; public
  scores/news demoted below the personal content for signed-in
  participants.
- Native team screen: roster player names, header entities → clickable.
  Needs a native player destination (no /browse/player screen exists —
  likely /api/mobile/browse/player/[id] + screen, the game-page parity
  pattern).
- Re-audit every remaining screen against Laws 1–3 during the sweep.
