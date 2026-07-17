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
