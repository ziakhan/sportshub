---
theme: [scoring]
type: design
status: shipped
updated: 2026-07-04
tags: [theme/scoring, type/design, status/shipped]
---

# Live Scoring — Interface Design (v1)

> **STATUS: v1 BUILT 2026-07-04** — fold engine (`lib/scoring/fold.ts`, 11
> unit tests), console (`/games/[id]/score`), game-day list (`/score`),
> public live page (`/live/[gameId]`), APIs (bootstrap / events / lock /
> finalize / public read), Neon runbook entry #8. L2 suite seed 1114 (9
> tests). Remaining from §6: deferred items 8–10 unchanged.

Owner brief (2026-07-04): once games are scheduled, a scorekeeper logs in and
runs the game from a **very easy, intuitive** interface — tablet at the table
is the primary device, phone (sometimes one-handed) must work. Track scoring
(the dominant event — made AND missed shots), rebounds, assists, the rest of
the box score, and **subs in/out with a clear picture of who's on the floor**
for each team. Deferred by owner: referee assignment, scorekeeper
*assignment*, and signer/sign-off flows (design leaves room; builds nothing).

Supersedes the Phase-1 section of `docs/live-scoring-plan.md`; Phase 2 there
(AI video) still stands — this event design doubles as its labeling tool.

---

## 1. The core interaction — two taps per event

The owner's instinct, kept verbatim: **action first, then player**.

```
tap [+2]  →  player pad pops (the 10 on the floor)  →  tap #23  →  done
```

- **Action buttons are fixed** — same position the whole game. Muscle memory
  lives here; scoring is >70% of events, so the six shot buttons are the
  biggest targets on screen.
- **The player pad shows ONLY the on-floor ten** — home five in home color on
  the left, away five on the right. Big jersey-number tiles (number huge,
  name small underneath). Nobody scrolls a full roster mid-play.
- Tapping a shot for the wrong team is impossible to do silently: the pad is
  color-split, and the running score flashes the side that changed.

### Smart follow-up chains (optional, one extra tap, never blocking)

- After a **made** basket → toast: *"Assist?"* + the scorer's four teammates
  + `skip`. Tap or ignore — it auto-dismisses on the next action.
- After a **missed** shot → toast: *"Rebound?"* + all ten + `skip` (a tap on
  a defender records DREB, on a teammate OREB — no separate OREB/DREB
  buttons to think about).
- After a **foul** → if it was a shooting foul the scorekeeper just keeps
  going: FT✓/FT✗ are first-class buttons, no modal state machine.

Chains are how the box score gets complete without the scorekeeper ever
changing modes — decline them and you still have a valid score.

### Undo — the trust feature

- Giant `UNDO` always visible; taps void the last event (append-only voiding,
  never deletion — see §4).
- The last three events show as a ticker under the score
  (`#23 +3 · #12 DREB · #7 sub-in`); tap any ticker entry → void just that
  one. Wrong-player fixes are one tap into the ticker, re-enter, done.

---

## 2. Screen layouts

### Tablet landscape (the scorer's table — first-class)

```
┌────────────────────────────────────────────────────────────────┐
│ WARRIORS 42          Q2 ▸        LIONS 38            [UNDO]    │
│ fouls: 4 ● bonus     [clock 5:23 ⏯]*      fouls: 2             │
│ ticker: #23 +3 · #12 DREB · #7 sub-in                          │
├───────────────┬────────────────────────────────┬───────────────┤
│ ON FLOOR      │        ACTION PAD              │ ON FLOOR      │
│ ┌────┐┌────┐  │  ┌─────┐ ┌─────┐ ┌─────┐       │ ┌────┐┌────┐  │
│ │ 5  ││ 10 │  │  │ +2✓ │ │ +3✓ │ │ FT✓ │       │ │ 12 ││ 23 │  │
│ └────┘└────┘  │  └─────┘ └─────┘ └─────┘       │ └────┘└────┘  │
│ ┌────┐┌────┐  │  ┌─────┐ ┌─────┐ ┌─────┐       │ ┌────┐┌────┐  │
│ │ 15 ││ 22 │  │  │ 2✗  │ │ 3✗  │ │ FT✗ │       │ │ 34 ││ 45 │  │
│ └────┘└────┘  │  └─────┘ └─────┘ └─────┘       │ └────┘└────┘  │
│ ┌────┐        │  ┌────┐┌────┐┌────┐┌────┐      │ ┌────┐        │
│ │ 33 │        │  │REB ││AST ││STL ││BLK │      │ │ 50 │        │
│ └────┘        │  └────┘└────┘└────┘└────┘      │ └────┘        │
│               │  ┌────┐┌─────┐                 │               │
│  [SUBS ⇄]     │  │ TO ││FOUL │                 │  [SUBS ⇄]     │
├───────────────┴──┴────┴┴─────┴─────────────────┴───────────────┤
│ fouled-out / 4-foul warnings surface here as chips             │
└────────────────────────────────────────────────────────────────┘
```
\* clock only if the league runs one — see §5.

The on-floor columns double as a player-first shortcut: tapping a jersey tile
FIRST highlights that player, then one action tap completes the event — both
grammars land in the same two taps, so whichever way a scorekeeper's brain
works on a given play, the interface agrees with them.

### Phone portrait (one hand)

- Score + period pinned at top, collapsed to one line.
- **Action pad bottom-anchored in the thumb zone**; on-floor pad pops UP from
  the bottom as a 2-column sheet (home left / away right) after an action tap.
- Subs and ticker behind a swipe-up drawer. Everything reachable by thumb;
  nothing important in the top half except reading the score.

---

## 3. Substitutions & who's on the floor

- Per-team `SUBS ⇄` button opens that team's panel: **on-floor five on top,
  bench below**. Tap an on-floor player, tap a bench player — that's one
  swap, staged. Stage as many pairs as needed (youth line changes swap five
  at once), then `Apply` — one SUBSTITUTION event per pair.
- The on-floor columns update instantly; the player pad always reflects
  reality, which is what keeps two-tap scoring honest.
- Starting fives are picked in pre-game (§6); each period start re-confirms
  the five currently marked on-floor with one tap.
- Foul accumulation shows on the tiles (dots), 4-foul warning chip, foul-out
  locks the tile with a forced-sub prompt.
- Minutes played derive from sub events when the clock is on; without a
  clock, periods-played is recorded instead.

---

## 4. Event model — append-only, derived everything

Already in schema: `GameEvent`, `PlayerStat`, `GameStatus.LIVE`,
`Game.scorekeepers` (reserved for the deferred assignment feature),
`SeasonRosterPlayer.jerseyNumber`. Evolutions needed:

- `GameEvent`: add `made Boolean?` (shots), `period Int` (rename/reuse
  `quarter`), `sequence Int` (per-game monotonic), `voided Boolean @default(false)`,
  `recordedById`, `clientEventId String @unique` (offline idempotency),
  `clockSeconds Int?`. `SUBSTITUTION` carries `{inPlayerId, outPlayerId}` in
  metadata; add `PERIOD_START` / `PERIOD_END` / `LINEUP` event types.
- **Nothing is ever edited or deleted — corrections void events.** Score,
  box score, on-floor state, team fouls, and PlayerStat rows are all derived
  by folding the event stream (recomputed incrementally live; from scratch on
  finalize). This is what makes undo trivial, corrections auditable, the
  spectator feed a straight read, and every event a labeled training sample
  for Phase 2 AI.

## 5. League-level configuration (small, matters a lot)

| Setting | Options | Default (OWNER-CONFIRMED 2026-07-04) |
|---|---|---|
| Stat depth | SCORE_ONLY (score+fouls+subs) · STANDARD (+reb/ast+misses) · FULL (+stl/blk/to) | STANDARD |
| Game clock | SIMPLE (start/stop) · OFF (periods only) | **SIMPLE — clock on by default** (owner call; enables minutes-played everywhere; leagues may turn it off) |
| Periods | quarters / halves, count + length | quarters ×4 |

Owner also confirmed v1 access: league owner + staff of either competing
club (option 8 in §6 stays deferred).

Scorekeepers are often parents; a league that only wants a reliable score
should never see eleven stat buttons. The action pad renders only what the
depth includes — SCORE_ONLY is literally six shot buttons + FOUL + SUBS.

## 6. The full interface inventory

| # | Surface | Route | v1? |
|---|---|---|---|
| 1 | Scorekeeper console (this doc) | `/games/[id]/score` | ✅ |
| 2 | Pre-game setup: confirm both rosters + jersey #s (prefilled from season roster, editable), mark absentees, pick starting fives, `Start game` → LIVE | same route, pre-LIVE state | ✅ |
| 3 | Game-day list: "games I can score today" (league + venue + time) | `/score` | ✅ |
| 4 | Post-game finalize: review box score, confirm final, `Mark final` → COMPLETED + homeScore/awayScore → existing standings engine picks it up; locks scoring | same route, post-game state | ✅ |
| 5 | Public live page: score, period, play-by-play, box score; 10s polling | `/games/[id]/live` | ✅ |
| 6 | Box scores + player season stat lines on league/team public pages | league site | ✅ (read of #4) |
| 7 | Post-final corrections (league owner): void/add events, recompute | console in review mode | ✅ minimal |
| 8 | Scorekeeper assignment (Game.scorekeepers), PIN/link access for unauthenticated table workers | — | ⏸ deferred |
| 9 | Referee assignment + referee/signer sign-off of the final score | — | ⏸ deferred |
| 10 | Timeouts, possession arrow, shot-location chart | — | ⏸ v1.5+ |

**Who can score in v1** (until #8 lands): league owner + staff of either
competing club open the console for any SCHEDULED/LIVE game of their league;
one active scoring device per game (soft lock with takeover — the second
device sees "being scored by X — take over?").

## 7. Gym reality: offline-first

Gyms have terrible connectivity. The console is a client-side event queue:

- Events append to IndexedDB immediately (UI never waits on the network),
  background sync pushes in order with `clientEventId` idempotency.
- Full state (rosters, events) is loaded at pre-game; from tip-off the
  console can run an entire game with zero connectivity and sync at the end.
- Sync status is a quiet pill (`synced · 3 pending · offline`) — never a
  blocking error.
- Single-writer-per-game (the device lock) means sync has no merge problem.

Spectator page: plain 10s polling in v1 (serverless-friendly); the read is
`events since seq N`, so upgrading to SSE/websockets later changes transport,
not shape.

## 8. Build order (when we start)

1. Schema evolutions + event-fold engine (pure lib: fold events → score/box/
   on-floor; the scheduler/standings pattern — unit-tested to death) 
2. Console UI: pre-game → live scoring → finalize, tablet layout first,
   offline queue from day one
3. Public live page + box scores (read side)
4. Phone one-hand layout polish + corrections mode
5. Wire finalize → standings (engine exists; COMPLETED games already count)

Estimate: the fold engine + console is the meat (~2 sessions); read side and
polish (~1 session).
