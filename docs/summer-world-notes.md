---
updated: 2026-08-06
tags: [theme/demos, type/runbook, status/shipped]
---

# NPH Summer World — cheat sheet

A **live** summer season that sits alongside the Showcase planning world on
the local box. Built by `scripts/seed-summer-world.ts`. Purely additive: it
creates its own league, season, teams, accounts and content, and it never
touches the Showcase league, its Fall/Winter 2026-27 season, that season's
plans, gyms, sessions or submissions.

## Run it

```bash
npx tsx scripts/seed-summer-world.ts            # seed (no-op if already there)
npx tsx scripts/seed-summer-world.ts --reset    # rebuild the summer world
npx tsx scripts/seed-summer-world.ts --wipe     # remove it, seed nothing
```

Local DB only — the script refuses to run against a non-localhost
`DATABASE_URL`. Takes about 15 seconds. Everything is anchored to the day it
runs, so re-run it after a long gap and "tonight" is tonight again.

## What it builds

**NPH Summer League · Summer &lt;year&gt;**, owned by the existing
`owner-nph@sportshub.demo` account and linked to the North Pole Hoops
organization. April through September, IN_PROGRESS.

- 3 divisions — Grade 9 Boys, Grade 10 Boys, Grade 10 Girls
- 8 returning clubs, 22 teams, 220 players, ~275 accounts
- 13 playing weekends (every other Saturday/Sunday) + a Midweek Showcase +
  a Championship Weekend session
- ~147 games: ~100 completed with full play-by-play, box scores and
  standings, 1 LIVE right now, the rest upcoming
- Two gyms: **The Playground** (home — fills first) and **Haber Recreation
  Centre** (rented — the spill). No Venue or Court rows are ever created.

**The anchored beats**

| When | What |
|---|---|
| Yesterday 7:00 PM | Lords Grade 9 vs Force Grade 9 — the marquee, played, recapped |
| Yesterday 8:30 PM | Lords Grade 10 Girls vs Force Grade 10 Girls — played, recapped |
| Right now | Monarchs vs Panthers Grade 9 — **LIVE**, three quarters in |
| Tonight 7:30 PM | Lords Grade 10 vs Huskies Grade 10 — SCHEDULED, ready to score live |
| This weekend | A full Saturday + Sunday slate |
| Rest of the season | Weekends through late September, then Championship Weekend |

**Everything a surface renders**: club branding + descriptions + taglines,
staff with HeadCoach/AssistantCoach designations, reviews, public
announcements, posted programs (multi-week summer camps with weekly and
full-camp pricing, fall tryouts, Saturday house leagues), offer templates
and accepted offers with sizes and jersey prefs, obligations and recorded
offline payments in mixed states, waivers (Rowan's Law, signed/sent/pending
mix), practices, polls (team, chat-relayed and league-wide), team chats with
an unread state, team events, referee pool + availability + a pending shift
offer + settlements, news cards with covers, game recaps, Player of the
Game and final-score posts, stories, reactions, comments, reposts, follows,
FeedEvent telemetry, RSVPs and CASL communication consents.

## Logins

Password for **every** account: `TestPass123!` · Referee sign-off PIN: `1234`

| Login | Who |
|---|---|
| `owner-nph@sportshub.demo` | League operator (pre-existing account, reused) |
| `summer-parent-lords@sportshub.demo` | ⭐ **Jordan Reyes** — two kids on Lords rosters (Grade 9 Boys + Grade 10 Girls), mixed payment and waiver states, a live feed to scroll, an unread team chat, a poll they have not voted in, and a **PENDING fall Showcase offer** |
| `summer-parent-force@sportshub.demo` | Sana Malik — Burlington Force family |
| `summer-owner-lords@` `summer-owner-force@` | Club owners for the two featured clubs |
| `summer-owner-huskies@` `summer-owner-monarchs@` `summer-owner-panthers@` `summer-owner-west@` `summer-owner-ckatt@` `summer-owner-kings@` | The other six club owners |
| `summer-coach-<club>-gr<9\|10>[g]@` | Head coaches, e.g. `summer-coach-lords-gr9@`, `summer-coach-force-gr10@` |
| `summer-asst-<club>-gr<9\|10>[g]@` | Assistant coaches |
| `summer-ref-mike@` `summer-ref-sarah@` `summer-ref-james@` | Referees (PIN 1234) |
| `parent-summer-<club>-NNN@` | Background parents — never needed by hand |

All emails end in `@sportshub.demo`.

## Demo hooks

- **Parent** → `/feed`: preview card for tonight's game, their kid's stat
  card, finals, recaps. `/offers`: the pending fall roster spot to accept.
- **Public** → `/club/nphj-toronto-lords`: the full club page — brand hero,
  next game, announcements, four open programs, teams, schedule and results,
  news cards, reviews.
- **Public** → `/scores`: LIVE now, tonight at 7:30 PM, Saturday and Sunday
  slates split across the Playground and Haber.
- **Referee** → `/referee`: a pending Saturday shift offer at $50/game and
  declared availability; `/dashboard` lists their assigned games.
- **Operator** → the summer league's standings, payments and roster-change
  request (Burlington Force Grade 9 asking for two call-ups).

## Verification

```bash
SHOTS_DIR=scratchpad/shots-summer node scripts/demo/verify-summer-world.mjs
```

18 checks across the parent feed, the offers page, the public club page, the
referee surfaces, the news surface, the scores board, tonight's game page,
and the Showcase planner. All 18 pass.

## Safety

`scripts/seed-summer-world.ts` is additive by construction:

- Rows it owns are marked `NPH_SUMMER_SEED` (teams, camps, house leagues,
  tryouts, offer templates) or live under the summer league / a
  `summer-*` / `parent-summer-*` email. `--reset` deletes only those.
- It never creates or deletes `Venue` or `Court` rows — the planner counts
  courts, so the three real gyms are read-only to it.
- It never deletes or edits an existing user account.
- It does enrich the eight returning club tenants: branding row, tagline,
  real city, contact details, and a description **only when the tenant had
  none**. That is the one place it writes to a pre-existing row.

**Proof it left the Showcase planning world alone** — `GET` responses
captured before and after a seed run, as `owner-nph@`:

| Endpoint | Before | After |
|---|---|---|
| `/api/seasons/160b2f09…/planner` | 15,706 bytes | byte-identical |
| `/api/seasons/160b2f09…/plans` | 709 bytes | byte-identical |
| `/api/seasons/160b2f09…/venues` | 6,287 bytes | byte-identical |
| `/api/seasons/160b2f09…/sessions` | 38,822 bytes | byte-identical |
| `/api/seasons/160b2f09…/divisions` | 5,569 bytes | byte-identical |

`Venue` (21) and `Court` (45) row counts are unchanged. Running the seed a
second time adds nothing; a `--reset` rebuild returns the database to exactly
the same row counts.

## Restoring the pre-summer database

A full `pg_dump` was taken before the first run. To roll the local database
back to that state:

```bash
docker exec -i youthbasketballhub_db psql -U postgres -c \
  'DROP DATABASE IF EXISTS youthbasketballhub WITH (FORCE); CREATE DATABASE youthbasketballhub;'
docker exec -i youthbasketballhub_db psql -U postgres -d youthbasketballhub \
  < <path-to>/db-backup-before-summer.sql
```

The far cheaper option is `npx tsx scripts/seed-summer-world.ts --wipe`,
which removes the summer world and leaves everything else exactly as it was.
