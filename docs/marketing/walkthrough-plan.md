---
updated: 2026-07-18
tags: [theme/marketing, type/plan, status/awaiting-owner]
---

# Walkthrough system v2 — complete audit + presentation plan

Owner asks (2026-07-18 night): full audit of missing scenarios (chats, polls,
scores/news, live scoring incl. the side-by-side score-entry→public-page
moment, "and more"), richer scenes (more names, more data, explicit
button-press feel, green ✓ animations), possibly the NPH regular league +
Fall Summer League + existing demo club names, and a way to show a COMPLETE
end-to-end use case rather than only per-role silos.

## 1. Coverage audit — shipped product vs current 24 scenes

✅ = covered today · 🟡 = mentioned but thin · ❌ = missing entirely

**Discovery & registration**
- ✅ Browse tryouts, detail page, register, pay fee
- ❌ Camps & house league programs (multi-week pricing exists in product)
- ❌ Multi-kid families / My Kids (one login, two rosters, two calendars)
- ❌ Club discovery pages themselves (public club page w/ reviews)

**Club ops**
- ✅ Claim club, create teams, staff designations, tryout setup/publish,
  signup tracking, attendance, offer template, send, acceptance board,
  final roster
- 🟡 Offers: only 2 named players — needs 10-12 names + per-player ✓ cascade
- ❌ Payments ledger: who-owes-what, installment schedule, auto-charge,
  reminder nudges, refunds/credits
- ❌ Practices: recurring practice scheduling + iCal to families
- ❌ Team comms: announcements, pinned messages, DMs, reactions, mute
- ❌ Polls (vote counts filling live)
- ❌ Game-day ops: scorekeeper assignment + GUEST SCOREKEEPER LINK (no
  account needed — a genuinely differentiating feature, unshown)
- ❌ Jerseys/uniform tracking beyond one template field
- ❌ Post-season reviews (invite → moderated review on public page)

**League ops**
- ✅ Season, sessions/venues, ref pool, publish, club submissions w/ payment,
  schedule generation, standings
- ❌ LIVE SCORING as an experience — the owner's side-by-side: console press
  → public page updates (FlashNum) + play-by-play line appears
- ❌ Narrative play-by-play ("scores 3, assisted by…")
- ❌ AI recap → auto-published news article
- ❌ Playoff bracket generation (guided wizard SHIPPED last night — show it!)
- ❌ Postpone/reschedule → every calendar + chat updates (the "talks to
  itself" claim, proven)
- ❌ Referee confirm flow (their own view) + game fees
- ❌ Stat leaders / scores hub / public league page
- ❌ Score corrections + official gamesheets

**Cross-cutting**
- ❌ Notifications/bell moments (offer arrived, game moved, poll closing)
- ❌ Phone frames — everything shown as desktop cards; parents live on phones
- ❌ Native apps exist (TestFlight/Android) — never referenced

## 2. Presentation architecture — three layers

**Layer 1 — Feature CLIPS (persona pages).** Every feature section on
/for-clubs, /for-leagues, /for-parents embeds its own 2-4 scene mini-player
(replaces the current one-big-player-after-hero). Pills always fit; each
clip deepens independently. Mapping:

| Page section | Clip scenes |
|---|---|
| Clubs · Tryouts & offers | create → publish → signups fill → attendance |
| Clubs · Payments | offer plan → deposit lands → ledger w/ installments → nudge |
| Clubs · Rosters & comms | staff → roster → announcement + poll → DM |
| Clubs · Live scoring | assign scorekeeper → guest link → SIDE-BY-SIDE score |
| Clubs · Public face | club page → news recap → reviews |
| Clubs · League play | one-click submit → schedule lands → standings |
| Leagues · (mirror) | season/sessions → refs → submissions → schedule → side-by-side live → playoffs wizard |
| Parents · each section | find/register/pay · calendar+RSVP · follow live (phone frame) · kid's stats · chat+polls · My Kids |

**Layer 2 — "ONE SEASON" (the end-to-end movie, /how-it-works).** Replace
the three role-silo players with ONE chronological story told across the
season; every scene carries a role chip (CLUB / PARENT / COACH / LEAGUE /
SCOREKEEPER / EVERYONE) so you watch the baton pass:

1. **Tryout season** — club posts (CLUB) → family finds & pays (PARENT) →
   attendance (COACH)
2. **Team building** — offers w/ tick cascade (CLUB) → accept + deposit
   (PARENT) → roster locks (CLUB)
3. **League entry** — season published (LEAGUE) → one-click submit + fee
   (CLUB) → schedule generated, everyone notified (LEAGUE→EVERYONE)
4. **Game night** — the ★ SPLIT-SCREEN: console button-press left, public
   game page flips 42→44 w/ green flash + play-by-play line right
   (SCOREKEEPER | FAN) → box score final → AI recap posts to news
5. **The long season** — poll on practice time (COACH/PARENT) → game
   postponed → calendar+chat+phones all update (the "nobody forwards
   anything" proof) → standings tighten
6. **Playoffs & wrap-up** — bracket wizard (LEAGUE) → championship live →
   season reviews invited (CLUB/PARENT)

Role filter toggle at top ("Just show me the club steps") filters the
timeline — one artifact, every audience.

**Layer 3 — signature-fidelity pass.** Offer card, standings, game page,
scoring console scenes get pixel-faithful treatment matching the real
components (recognition when they enter the product). Connective scenes
stay shorthand (maintenance + legibility).

## 3. Scene-richness spec (the "button-press feel")

- **Choreographed beats per scene**: cursor dot glides to the button →
  press effect (scale-down + shadow) → result animates in: green ✓ chips
  cascading row by row ("Offer sent ✓" ×12, staggered 120ms), counters
  ticking up, rows flipping to Paid. CSS keyframes w/ staged delays,
  restart on scene entry, ~2.5s per beat; reduced-motion = final state.
- **Try-it moments**: in 2-3 scenes the pulsing button is REAL — pressing
  "Send 12 offers" fires the tick cascade yourself. (Owner: "maybe
  interact".)
- **Data density**: rosters/lists show 10-12 named players, tables 6+ rows,
  real-looking phone numbers/fees. No more two-name lists.
- **Split-screen scene**: two Screen frames side by side (stack on mobile),
  shared tick driving both panes.
- **Phone frames** for parent scenes; desktop frames for operator scenes.

## 4. Demo world naming (owner ruling pending)

Owner floated: NPH regular league + Fall Summer League + already-mentioned
demo club names. All scene copy moves to `components/demo/demo-world.ts`
(names/fees/venues as constants) so the cast swaps in one file the moment
he rules. Until then: Ridgeview Rockets / North Star Storm / Lakeside Lords
+ "Metro Youth Basketball League" stand in. ⚠️ If we use REAL league names
(NPH), the numbers shown must stay obviously illustrative.

## 5. Build order

1. **Pass A** — animation/beat engine in DemoPlayer + mock-ui (press,
   cascade, counter), data-density upgrade of existing 24 scenes,
   demo-world constants file.
2. **Pass B** — re-slice persona pages into per-section clips; new scenes:
   payments ledger, chat+polls, practices, guest scorekeeper, split-screen
   live scoring, recap→news, postpone ripple, playoffs wizard, My Kids,
   reviews. (~20 new scenes.)
3. **Pass C** — /how-it-works becomes ONE SEASON w/ role chips + filter.
4. **Pass D** — signature-fidelity pass + real league/club names once the
   owner rules + phone frames.

## Status
Plan awaiting owner OK (he reviews, then passes execute in order). Chip
overflow fix + edge fades already shipped (`93b73ad`).
