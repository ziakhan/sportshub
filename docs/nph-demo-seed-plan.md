# NPH production demo world — seed plan (2026-07-07, DRAFT for owner review)

One deterministic script that builds a complete, believable demo universe on
production: real Toronto NPH clubs, the FULL tryout → offer → roster →
league pipeline with history, an active NPH league mid-season, and memorable
logins. Supersedes `scripts/seed-showcase.ts` as the demo world.

**Nothing runs until this plan is approved.** Build + rehearse locally
first; prod run only after the code deploy + runbook #10 (see §9).

---

## 1. Accounts — one pattern, one password

All demo accounts: `<role>@sportshub.demo` · password `TestPass123!`
(kept from existing convention — say the word to change it once, everywhere).

| Login | Role | What you see |
|---|---|---|
| `admin@sportshub.demo` | PlatformAdmin | Admin console, all clubs, impersonation, Feature toggle |
| `owner-nph@sportshub.demo` | League owner (North Pole Hoops) | League dashboard, season, submissions, schedule, league revenue |
| `owner-lords@sportshub.demo` | ClubOwner — Toronto Lords | Full club pipeline (the primary club-demo login) |
| `owner-huskies@` / `owner-lions@` / `owner-crown@` / `owner-sc@` / `owner-westfield@` / `owner-uchenna@` / `owner-six@` | ClubOwners — 7 more clubs | Same surfaces, varied data |
| `parent@sportshub.demo` | THE demo parent (Jordan Reyes) | 2 kids on 2 teams, full offer history incl. one OPEN offer to accept live on stage, payments, chat, follows |
| `parent2@sportshub.demo` | Second parent | History with a declined + expired offer; kid on a different team |
| `coach-lords-u15@sportshub.demo` (…one per team, 14 total) | Staff/HeadCoach | Team dashboard, roster, chat as STAFF |
| `ref-mike@` `ref-sarah@` `ref-james@` `ref-priya@sportshub.demo` | Referees | Referee profile, assignments, sign-off (PIN **1234**) |

All other people (≈130 generated parents, 140 kids) follow
`parent-<club>-NN@sportshub.demo` — real-looking names, never needed for
demos but consistent if you poke one.

## 2. Clubs — real NPH Toronto programs

Eight GTA clubs straight from the NPH census (`docs/research/`). Six already
exist in the DB as real UNCLAIMED tenants from the 188-club import — the
seeder **adopts** them (sets ACTIVE, attaches the owner account, branding
colors, description tagged with a demo marker for clean wipe). Two get
created fresh:

| Club | Tenant | City |
|---|---|---|
| Toronto Lords | adopt `toronto-lords-basketball` | Toronto |
| North York Lions | adopt `north-york-lions` | North York |
| Royal Crown | adopt `royal-crown-school` | Scarborough |
| SC Academy | adopt `sc-academy` | Vaughan |
| Against The Six Prep | adopt `against-the-six-prep` | Toronto |
| Kings Court | adopt `kings-court-academy` | Toronto |
| North Toronto Huskies | create | Toronto |
| Uchenna Academy | create | Toronto |

Each club gets: branding (distinct primary colors), contact info, 2–3
**offer templates**, 1–2 teams, staff, tryout history, reviews. Two clubs
(Toronto Lords + Royal Crown) get the **Featured** flag → gold spotlight on
`/club` browse.

## 3. Offer templates — the package story

Per club, template mix varies so no two clubs look identical:

| Template | Package | Fee | Plan |
|---|---|---|---|
| **Standard Package** | uniform + ball | $425–475 | 1 payment |
| **Premium Package** | uniform + shoes + bag + tracksuit + ball | $749–849 | 3 installments |
| **Returning Player** | uniform only | $325–375 | 2 installments |
| **Elite All-In** (2 clubs only) | everything + 2 practice sessions/wk | $999 | 4 installments |

Teams use different templates: U15 teams mostly Standard+Premium, U17 teams
mix in Returning Player. Every accepted offer carries sizes + jersey prefs —
this is what fills the **Order Sheet** (per-team totals like
"10 uniforms: 3 YM / 4 YL / 3 AS, 6 shoes, 4 bags", club-wide totals, CSV).

## 4. Pipeline history — every scenario, per team

For EACH of the 14 league teams (dated ~10 weeks back so history reads real):

- **1 published tryout** on the public marketplace, 14–16 signups
  (parent+kid accounts, realistic names/ages)
- **Offers sent from templates:** 10 ACCEPTED (sizes, jersey prefs,
  payment plan chosen) · 2 DECLINED · 1 EXPIRED · plus a couple still
  PENDING on the *current* cycle
- **Roster auto-formed** from accepted offers, jerseys assigned respecting
  prefs → **submitted to the NPH season in one click → locked**
- **Money:** every accepted offer gets a PaymentObligation; ~80% PAID via
  recorded offline payments (e-transfer/cash/cheque), installment plans
  partially paid (2 of 3 collected), a few PENDING → club payments page
  shows real **Collected / Outstanding** tiles ("how much money was made"
  exists today at `/clubs/[id]/payments`; fuller revenue reporting stays on
  the backlog)
- **League entry fee:** each club has a $3,990 "NPH Showcase League team
  entry — Winter 2026" obligation PAID to the league (the real NPH SL fee
  from our research) → `owner-nph` sees league-side revenue too

**Live-demo hooks built in:**
- Toronto Lords has an **upcoming tryout (dated tomorrow)** with 12 signups,
  5 already checked in → walk on stage, open mobile **check-in**, tap kids
  in, then **send an offer** from a template live
- `parent@sportshub.demo` has **one OPEN offer** waiting → accept it on a
  phone live (sizes, jersey numbers, plan), watch the roster + order sheet
  update

## 5. The league — NPH Showcase League, mid-season

Picked **NPH** (biggest operator, and our census gives us the real club
list; NJC/NSC is the separate Ottawa operator — skip for now).

- League "**NPH Showcase League**" (owner `owner-nph@`), Season
  "**Winter 2026**", ACTIVE, roster lock on
- **Two divisions:** U15 Boys (8 teams — one per club) + U17 Boys (6 teams —
  six clubs field a second squad). Distinct age groups = ready-made data for
  the future age-group stat-leader filter
- **Schedule:** weekend rounds at 3 real-named Toronto venues. U15: 28
  games, U17: 15 games. State when seeded:
  - **~24 COMPLETED** — full play-by-play events, box scores, PlayerStat
    lines, auto-published recaps w/ photo covers → standings + league
    leaders + team/player pages all populate
  - **2 LIVE right now** (mid-3rd quarter, scoreboard strip + /live)
  - **~17 SCHEDULED** across the next three weekends
- **Referees:** 4 accounts w/ RefereeProfile + PIN 1234, assigned
  (UserRole role=Referee per game) across completed/live/upcoming;
  completed games carry referee sign-off (signature on scoresheet,
  refereeVerified badge)
- **Standings** compute from completed games; homepage scoreboard, /scores,
  /news, league hub all light up

## 6. New-feature surfaces (this week's four builds)

| Feature | Seeded state |
|---|---|
| Order Sheet | Every team has full size/item data; club totals + CSV work |
| Tryout check-in | Tomorrow's Lords tryout: 12 signups, 5 pre-checked-in |
| Team↔family chat | Every league team: 8–12 message thread (coach announcements, parent replies, STAFF badges); demo parent active in 2 |
| Featured + discovery | 2 featured clubs; 12–15 reviews (4–5★ w/ text) across clubs; Toronto city pill front and center |

## 7. Extra polish

- Demo parent follows: both kids' teams + the league → homepage "Your
  teams" rail personalizes
- 2 public league announcements + recap posts feed /news
- Kids stay on media-consent default → public pages show "First L."
  (privacy demo)

## 8. Script design — `scripts/seed-nph-demo.ts`

- **Deterministic** (seeded RNG) — same world every run
- **Idempotent + surgical wipe:** `--wipe` removes ONLY rows tagged to this
  world (the `@sportshub.demo` email domain + league marker + demo-tagged
  tenants/posts), restores adopted tenants to UNCLAIMED, never touches the
  other ~180 imported clubs or real accounts. Also scrubs the old showcase
  world (`@sportshub.test` / `@showcase.demo`) and bracket-named test noise
- **Prod safety rail:** prints `SELECT current_database()` + host and
  requires `--yes-prod` before writing to a non-localhost DB (the July 6
  lesson — an env-sourcing bug once pointed "Neon" checks at local)
- **Prints the account cheat sheet** + URL map when done
- Reuses proven machinery from `seed-showcase.ts` (game-event generator,
  round-robin scheduler, referee sign-off, recap publisher)

## 9. Execution order (nothing moves without your go)

1. **You approve this plan** (amend anything first)
2. I build the script, run it **locally**, and do the full **surface audit**
   (§10) — fixing anything empty or broken
3. You click through localhost with the cheat sheet
4. **Deploy train (needs your explicit go):** push ~103 local commits →
   Vercel; apply Neon runbook **#10** (adds `checkedInAt`, `isFeatured`,
   `TeamMessage` — chat/check-in/featured can't seed without it)
5. Run the seeder against Neon (`--yes-prod`), spot-check prod
6. Old prod showcase world gets wiped by the same run (default; can keep it
   if you want)

## 10. Login audit checklist (run locally, then on prod)

| Login | Must be visible |
|---|---|
| anonymous | Homepage scoreboard w/ live games, /scores, /news recaps, /leagues → NPH hub (standings/leaders/teams), /club browse w/ featured+ratings+city pills, club pages w/ reviews, team/player public pages, tryout marketplace |
| `owner-lords` | Club overview needs-attention, Teams, Tryouts (+signups, check-in page), Offers pipeline w/ all four statuses, **Order Sheet** (sizes per team + club + CSV), Templates, **Payments (Collected/Outstanding)**, Staff, team chat as staff |
| `parent` | Dashboard w/ kids + teams + Chat links, offer history (accepted/declined/expired + **1 open to accept**), payment history, team chat, public team hub w/ chat pill, kid stat pages |
| `owner-nph` | League dashboard, season w/ 14 finalized locked rosters, schedule (completed/live/upcoming), standings, league-fee revenue |
| `ref-mike` | Referee profile (PIN), assignments, signed scoresheets on completed games |
| `admin` | Admin clubs (Feature toggle), users, claims, payments console |

## 11. Known gaps (agreed out of scope for this seed)

- Stat leaders **by age group** — data supports it (distinct ageGroups per
  division); the filter UI is a future build
- Accounting/revenue **reporting** beyond the payments summary tiles
- Online Stripe checkout on prod (needs `STRIPE_*` env vars — owner-side);
  all seeded money is offline-recorded, which the product fully supports
- League merchant Connect onboarding (league fees seeded as offline-paid)

## 12. Open questions

1. **Adopt real UNCLAIMED tenants** for the 6 matching clubs (recommended —
   same approach the current prod showcase already uses, fully reversible on
   wipe), or create parallel `-demo` tenants and leave the real listings
   untouched?
2. Password: keep `TestPass123!` everywhere, or switch to something else
   once?
3. Divisions: U15 Boys (8) + U17 Boys (6) — want a **girls division** in
   this pass?
4. Demo parent display name "Jordan Reyes" ok, or use your own name like the
   current showcase parent?
5. Wipe the old showcase world on prod when this lands (default), or keep
   both?
