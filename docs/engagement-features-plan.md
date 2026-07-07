# Engagement features — vision + roadmap (2026-07-06)

Owner direction (verbatim intent): engagement tools — polls, quizzes,
"any kind of thing to engage people" — creatable at **team, club, or league
scope by the properly authorized person** (team staff / club owner / league
owner), delivered to that audience, and potentially surfacing on the
matching **public pages**. Plus **carpool coordination** for younger age
groups. Owner flagged the full vision as "maybe too ambitious" — so this doc
holds the whole shape while we ship it in slices.

## Slice 1 — TEAM polls & surveys ✅ SHIPPED 2026-07-06

- Models: `Poll → PollQuestion → PollOption → PollVote` (schema.prisma;
  Neon = runbook #12). A poll holds 1..N questions so it doubles as a
  survey; per-question single or multiple choice.
- Membership = **team chat membership** (lib/teams/chat-access): staff
  (club owners/managers + team Staff/TeamManager) create, close/reopen,
  delete; staff + parents of ACTIVE rostered players vote and see results.
- Results: everyone sees counts/percentages live (result bars); **staff
  additionally see voter names per option**; families never see names.
- Re-voting replaces your previous choice (per question); voting on any
  subset of questions is allowed; closed polls reject votes.
- One `team_poll` bell per member on creation (notifications.ts type).
- Surfaces: `/teams/[teamId]/polls` (+ links from team chat, club team
  dashboard quick action, parent dashboard per-team "Polls").
- APIs: `GET/POST /api/teams/[id]/polls`, `PATCH/DELETE .../[pollId]`,
  `POST .../[pollId]/vote`. 11 int tests (seed 1122).
- Demo: NPH seeder gives Lords G9 a "Summer tournament plans" poll — 9
  families voted, demo parent votes live, coach sees names.

### Slice 1b — Quick polls IN the chat stream ✅ SHIPPED 2026-07-07

Owner's original vision: "posting a single-question poll into the chat for
easily sending it to people... with charts or bars to show the results."
- `TeamMessage.pollId` (runbook #12 amendment) — a message can carry a
  single-question Poll; the bubble renders tappable options with live
  result bars (WhatsApp-style). Tap to vote; single-choice taps switch,
  multi-choice taps toggle.
- Creation open to EVERY chat member (owner call 2026-07-07 — membership
  = staff + parents, i.e. the adults; a rare self-registered 13+ player
  is also a member and gets the button, indistinguishable from a parent
  in the data model). 📊 button in the chat composer: question + 2-6
  options + multiple-choice toggle. Multi-question surveys on the polls
  page stay staff-only.
- Live counts WITHOUT new messages: votes mutate existing polls, so every
  messages GET (including ?after= delta polls) ships `pollUpdates` — an
  open chat sees vote movement within the 5s poll cycle.
- Take back / moderate the poll message → the poll and its votes go with
  it. Deleting from the polls page leaves the message as plain text
  (pollId SetNull).
- Chat polls also appear on the team polls page (they ARE single-question
  polls) — staff get the voter-names detail view there.
- Shared PollBubble renders in both the full chat page and the floating
  chat dock. 3 int tests added to the chat suite (seed 1118).
- Demo: Lords G9 chat has "Pizza after Saturday's game? 🍕" (7 votes,
  demo parent hasn't voted).

## Slice 2 — Practice scheduling + calendar sync ✅ SHIPPED 2026-07-06

- `PracticeSlot` recurring days ("Tue 18:30, 90 min, Main Gym") — set on
  the team create form or later (TBD); `Practice` occurrences carry
  `slotId` + free-text `location`. Neon = runbook #13.
- **Announce** (staff, from the calendar page): expands slots into dated
  practices for the next 10 weeks (dedup by team+datetime — re-announcing
  extends, never duplicates), stamps `Team.practiceScheduleAnnouncedAt`,
  and notifies every member — bell + email. Public team page shows the
  practice days only after announce.
- **Live calendar** `/teams/[teamId]/calendar`: practices + games in one
  agenda, 45s polling; staff manage slots inline and move/cancel/restore
  single practices — every change bells + emails the team.
- **Phone sync**: personal iCal feed `/api/calendar/[token]`
  (`User.calendarToken`, mint/rotate via /api/calendar/token). One
  subscription covers ALL the user's teams (practices + games); webcal
  link for iPhone, "from URL" link for Google Calendar; moves update via
  SEQUENCE, cancellations ship STATUS:CANCELLED.
- **Timezone**: slot times are wall times expanded via `APP_TIMEZONE`
  (default America/Toronto) in `lib/calendar/timezone.ts` — Vercel runs
  UTC; naive Date math would shift practices 4–5 hours.
- 12 int tests (seed 1123). Demo: every NPH team has slots; Lords G9 is
  announced with dated practices (one cancelled) for the calendar demo.
- Deliberately NOT in v1: per-user email/notification preferences (emails
  go to every member), venue-record picker on slots (free text),
  recurring-practice per-instance venue overrides, league practice view.

## Later slices (NOT built — design notes)

- **Club-wide / league-wide scope**: add nullable `tenantId` / `leagueId`
  to Poll (exactly one of teamId/tenantId/leagueId set). Audience resolution
  per scope: club = all team memberships under the tenant; league = all
  approved-submission families in active seasons. Creator authz mirrors the
  existing role checks. The chat-membership helper generalizes into an
  "audience" helper — do this when the second scope lands, not before.
- **Public-page surfacing**: opt-in `isPublic` flag → read-only results
  (respect naming privacy: aggregate only) on `/team/[id]`, `/club/[slug]`,
  `/league/[id]`. Public VOTING is a different animal (spam, identity) —
  keep public = view-only unless the owner asks.
- **Quizzes**: same Question/Option substrate + `correctOptionId` +
  scoring/leaderboard. Cheap once polls prove engagement; good fit for
  player-facing content (rules quizzes, film-session questions).
- **Other engagement candidates**: availability checks ("who can make
  Saturday?" — overlaps carpool + attendance), season predictions,
  MVP-of-the-game fan vote (ties into recaps/content P2).
- **Poll deadlines** (`closesAt` auto-close): deliberately skipped in v1 —
  staff close manually. Add if staff forget to close in practice.

## Carpool coordination — RESEARCHED, NOT BUILT (owner: "don't build yet")

Owner's sketch: younger age groups; parents request pickups; two nearby
families arrange a recurring carpool; pick days + whose turn it is.

### Research brief (2026-07-06, web research — sources inline)

**Existing solutions.** GoKid (gokid.mobi) is the category leader and still
actively maintained (4.3★/590 on iOS; v5 current): recurring carpools
created from a schedule, invite-only family groups, automatic route/driver
assignment, pickup points, reminders; **syncs TeamSnap/SportsEngine
schedules to auto-create team carpools**; freemium — Pro $4.99/mo adds live
GPS tracking, history, chat. Carpool-Kids (carpool-kids.com) is a simpler
calendar-centric app (recurring + one-time events, invite families,
notifications) with no rotation balancing or safety posture. KangaDo is the
cautionary tale: started as parent-to-parent carpooling, **abandoned the
model** and pivoted to Kango (kangoapp.co), a paid rideshare with
fingerprinted drivers (CA/AZ only) — same category as HopSkipDrive/Zum.
Team-management incumbents (TeamSnap, SportsEngine, Spond) treat carpools
as volunteer sign-up slots (like snack duty), not a rotation/matching
engine; they effectively outsource real carpooling to GoKid via schedule
sync. InstaTeam claims built-in carpool with pickup/dropoff tracking.

**Feature patterns worth copying (and GoKid's gaps):** schedule-first
creation (carpools spawn from calendar events — the seam WE own natively);
recurring series **with per-instance overrides** (GoKid's series-wide-only
edits are a top complaint); driver assignment per event with a visible
"whose turn" rotation ledger; **seat capacity per vehicle** (requested,
still missing in GoKid — easy differentiator); pickup points; day-of
reminders; "ride needed" broadcast to the roster for one-offs;
pickup/dropoff confirmation ("kid's in the car / delivered"). GoKid charges
for GPS tracking/history/chat — premium levers that map onto our Family
Pass ("record free, relationship premium").

**Safety/liability landscape:** surviving products position as
**facilitation only** — "trusted, invited families arrange rides
privately"; no driver vetting, no platform liability language (GoKid,
Carpool-Kids). Vetted-driver models are commercial transport (different
regulatory universe; Shuddle burned $12.2M and died in 2016 — Failory
post-mortem — Sheprd followed in 2018). Parent drivers are personally
liable for passenger injuries; personal auto policies may exclude carpool
arrangements; carpool waiver templates exist (release + assumption of risk,
lexmater.com). Youth orgs commonly carry non-owned/hired auto liability and
require of volunteer drivers: MVR checks, proof of ≥$300k CSL auto
coverage, license verification (Sadler Sports, Nonprofit Risk Mgmt Center).
**COPPA:** keep it 100% parent-account-centric — kids are profiles, never
users; a player-initiated "request a ride" flow would trigger
verifiable-parental-consent obligations.

**Why standalone carpool apps struggle — and why we're positioned:** the
killers are (a) chicken-and-egg density — a carpool only works if THIS
team's parents all adopt the app (GoKid's survival strategy is piggybacking
TeamSnap rosters) — and (b) schedule churn breaking rigid recurring models.
**We already own the roster, the schedule (games/practices with venues),
and parent identities — both killers disappear.** Remaining risks are
liability framing (waiver flow + "families arrange privately" posture) and
turn-fairness (rotation ledger).

### V1 sketch (when owner green-lights)

- Scope: per-team, parents only, framed as "families arranging privately."
- `CarpoolGroup` (team + member families + optional neighborhood label) +
  `CarpoolAssignment` (event/date → driver family, seats) + one-off
  `RideRequest` (event → "need a ride" broadcast, member claims it).
- Anchor to existing Game/Practice rows — no separate calendar. Rotation:
  suggested next-driver from a simple drives-count ledger; override freely.
- Waiver/disclaimer acceptance per family on joining a group; org-level
  disclaimer text configurable per club.
- Reminders ride the existing notification system; day-of email later.
- Deliberately NOT v1: GPS tracking, pickup/dropoff confirmation, driver
  vetting, payments. Candidates for Family Pass later.
