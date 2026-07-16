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
1. **Native Google sign-in** — backlog §Auth cross-platform (new builds + 2 OAuth clients).
2. **Offer installments** — native is full-pay only ("installments stay on
   the website for now" v1 note). Web offers FULL vs INSTALLMENTS.
3. **Practice/team-event creation** — coaches can create typed events on web
   only; native team screen is read/RSVP/chat.
4. **Scoring console** — web-only by design (works in the phone browser;
   guest links open web). Decide: keep as deliberate difference or build native.
5. **League/club operator deep management** — deliberate: native operator tab
   is a cockpit; heavy admin stays web.
6. **Polls visual redesign** — queued (owner: basic/small/bad colors), applies
   web + native together.
7. App icon/splash still stock Expo; iOS APNs push key pending; Apple Pay deferred.

## Audit method note
Screens enumerated from src/app; workflows spot-checked against their web
APIs (offer accept validated against respond-to-offer.ts requirements — the
kind of drift to re-check whenever web adds required fields to a shared API).
