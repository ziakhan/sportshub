# League Pitch Demo — Playbook (2026-08)

**Status: PLAYABLE TODAY (4 stages) · acts 1 and 5 of the five-act plan pending build · stage 3 not yet re-verified on the divisions-v3 path**

This is the step-by-step for running the staged demo world. It supersedes the beats in `demo-runbook-nph-journey.md` where they conflict (that run-sheet predates divisions v3 and scheduler v2); device layout and recovery notes there still apply.

---

## ⚠️ Before you load anything

- Loading the journey world **REPLACES the demo world** on whichever server you load it. Both localhost and the box currently hold the pre-season "at the gate" testing world. It is restorable, but do not press the button mid-testing.
- Rehearse on **localhost**. Load the **box** only when you want it there.
- Only use the Demos page. Never run old CLI seeders during prep.
- Phones show bell + email + calendar sync today, not true push (APNs pending).

## Accounts (all `@sportshub.demo`, password `TestPass123!`)

| Login | Role | Use for |
|---|---|---|
| `admin@` | Platform admin | Demos page, fast-forwards |
| `owner-nph@` | League operator | Main presenting login |
| `owner-lords@` / `owner-force@` | Club owners | Second laptop, live team submission |
| `parent@` | Parent (2 kids) | Phone: notifications + calendar |
| `coach-force-gr10@` | Coach | Second phone (optional) |
| `ref-mike@` | Referee, scoresheet PIN `1234` | Stage 4 game day |

## Setup (~2 minutes)

1. Sign in as `admin@` → `/dashboard/admin/demos`.
2. Press **Load stage 1** ("NPH full-scale journey"). Runs detached ~1 min; page shows progress.
3. Sign in the other devices: presenting browser = `owner-nph@`, second laptop = a club owner, phone = `parent@`.

## Stage-by-stage

### Stage 1 — Registration in flight
- `owner-nph@` → Showcase League season → **Teams tab**: ~25 of 146 submitted.
- Approve one pending team live.
- Second laptop (club owner): submit a team into the season → appears in your queue → approve → club gets notified. Fees attach on their own.

### Fast forward → Stage 2 — Everyone's in
- Teams tab shows all 146 submitted. Talk track: "a month of chasing, gone."

### Fast forward → Stage 3 — Ready to schedule
- League finalized, fees settled, gyms attached, zero games.
- Run the current product path live: **Schedule tab → divisions gate** (drag board per big grade, one yes/no cross-play question) → **generate**.
- World is seeded one court short on purpose: let generate FAIL first (auditor names the exact shortage), add the missing court, generate again → full season in ~15s, zero back-to-backs.
- Optional beat: approve the seeded far-team request via **Simulate cost**.
- **Publish** → hold up the parent phone: one announcement, calendar fills.

### Fast forward → Stage 4 — Six weeks later: game day
- Two completed weekends: standings + stat leaders real. `ref-mike@` has an assignment calendar.
- Drive the queued live game: roll call → two-tap scoring (parent phone watches the public game page move) → finalize with referee signature + PIN `1234` → Player of the Game → recap on the feed.

## Fast-forward rules

- Additive: anything done live in an earlier stage survives the jump.
- No skipping: stage 1 first, then forward in order.
- Reset = reload stage 1 and fast-forward back. This is also mid-meeting recovery.
- Restoring the pre-season testing world afterward: ask Claude (collapse/pre-season loaders).

---

## The five-act target (build pending)

Planned final shape (full plan + build list in session memory, 2026-08-10):

1. **Act 1 — Plan the season (NEW, needs seed):** plan wizard live on a fresh season: estimates, gyms on the board, fit chips, "what you need to book" court-hours, buffer.
2. Act 2 = stage 1 (registration in flight).
3. Act 3 = stages 2–3 (everyone's in → divisions gate → fail-then-fix generate → publish).
4. Act 4 = stage 4 (game day).
5. **Act 5 — Playoffs weekend (NEW stage 5, needs build):** season complete → playoff plan per grade → division-first opening round, consolation guarantee → brackets placed on the booked weekend, TBD-seed placeholders public.

**Build list:** act-1 planning seed · stage-3 refresh/re-verify on v3 paths · stage 5 in `scripts/demo-scenarios.ts` + `scripts/seed-journey.ts` + Demos page chain · rewrite `demo-runbook-nph-journey.md` to five acts with deck-slide references · full dry-run · presenter kit (offline deck copy, PDF, login card).

**Deck:** capability deck v5 (45 slides) — artifact link in session memory; present as HTML fullscreen, PDF as leave-behind.
