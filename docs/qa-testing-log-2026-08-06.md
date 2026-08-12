# QA Testing Log — Tester Session (started 2026-08-06)

> Running log of findings from hands-on testing: bugs, UI/design problems, and
> feature suggestions. When the pass is done, this file goes to the developers.
>
> **Environment:** this pass tests the LIVE site (ysportshub.com) — the latest
> deployed build with its current demo world — signed in with the demo family
> account. Findings therefore reflect production as deployed at test time.

## How entries work

Every finding gets the next `T-###` number, one of three types, and a severity:

- **Type:** `BUG` (broken behavior) · `UI` (works, but looks/reads/flows badly) · `IDEA` (feature request / improvement)
- **Severity:** `high` (blocks a real task or the money path) · `med` (annoying, workaround exists) · `low` (polish)
- **Platform:** this session tests the **web only** — entries default to `web-desktop`; use `web-mobile` when found in a phone browser. (Native untested this pass; parity there is a follow-up question for each item.)

Template (copy for each new entry):

```
### T-0XX · <one-line title> · BUG|UI|IDEA · high|med|low · <platform>
- **Where:** <page / URL / which account was signed in>
- **What I did:**
- **What happened:**
- **What I expected:**
- **Fix idea (optional):**
```

---

## Findings

### T-001 · Lone unlabeled "story" circle between Your week and Your teams · UI · med · web-desktop
- **Where:** LIVE site, signed-in homepage as the demo parent (Jordan Reyes), the band directly below the "Your week" box and above "Your teams".
- **What I did:** Signed in as the demo parent and looked at the homepage.
- **What happened:** A single small avatar circle sits alone in its own full-width row, labeled with the raw handle `reyes-6486`. No section title, no explanation — it reads as clutter that "doesn't do anything."
- **What I expected:** Either nothing there, or something that explains itself.
- **Dev pointer:** this is the stories rail (`components/social/stories-rail.tsx`, rendered at `app/(public)/page.tsx:136`) — stories from own kids + followed players. Two compounding problems: (1) with one entry it still claims a whole homepage band, with no "Stories" heading to say what it is; (2) the circle is labeled with the player's HANDLE (`reyes-6486`) instead of their display name, so a parent doesn't even recognize their own kid.
- **Fix idea:** label the band ("Stories"), show the kid's name under the circle (handle only as fallback), and consider hiding the band entirely below N entries — a one-circle stories rail sells the feature short on an otherwise clean homepage.

### T-002 · Open a player's story from the post avatar in the feed · IDEA · med · web-desktop
- **Where:** LIVE site, `/feed`, signed in as the demo parent.
- **What I did:** Saw a feed post about a player who currently has an active story, and clicked the avatar in the post's top-left corner expecting to reach the story.
- **What happened:** Nothing — the post avatar isn't clickable. Stories are only reachable from the dedicated stories row at the top of the feed.
- **What I expected:** Instagram behavior — when the person in a post has an active story, their avatar in the post's corner shows the story ring, and tapping it opens the story viewer right there.
- **Fix idea / dev pointer:** the card avatar (`components/social/feed-card.tsx`, author row) is currently a plain initial circle. Suggest: when the post's tagged player has an unexpired story visible to the viewer, render the gold story ring around the post avatar and open the fullscreen viewer on tap (the viewer currently lives inside `components/social/stories-rail.tsx` — worth extracting so both surfaces share it). Needs the feed payload to carry the tagged player's id + a has-story flag (additive fields, native-safe), and story visibility rules must be respected (PUBLIC vs FOLLOWERS). Native app should get the same behavior for parity.

### T-003 · Plan Your Season step 3: schedule crams the home gym and never uses the other gyms · BUG · high · web-desktop

> **DEV RESPONSE (2026-08-10, validated on current build):** RESOLVED BY TIMING. This pass tested the Aug 6 live build; the backup-gym rulings shipped Aug 7-8. Today: placing a backup with no availability attaches it to the weekend with assumed capacity (owner's live plan "New 2" runs this way), the "Fill the gaps from my pool" verb exists, and placements read as assumed rentals feeding the ask sheet. No code change needed.
- **Where:** LIVE site, league owner account → Plan Your Season → step 3 (the calendar / "draw the calendar").
- **What I did:** Set up a plan with multiple gyms included, then had step 3 draw the calendar.
- **What happened:** Every game lands in the home gym. When the home gym runs out of space, the schedule just overflows it — over capacity, not enough room — while the other included gyms sit completely unused. No balancing or spill to the other facilities ever happens.
- **What I expected:** The home gym filling first is fine, but once it's full, the remaining games should flow into the other gyms I included instead of overloading a full building.
- **Dev pointer:** per the venue-model-v2 design (commit `be23fce8`, owner rulings 2026-08-03), this looks like the intended pipeline breaking at the spill step: home gym packs first, then spill is supposed to pack into the POOL venues as rental blocks (`assignBlocksFromPool`, `planRentalBlocks`, minimizing rented court-days). Observed behavior = spill never assigns. Worth checking: (1) whether the other gyms actually got `SeasonVenue.role = pool` when added through the wizard (old plans infer role from fillOrder — backfill script exists); (2) whether `assignBlocksFromPool` runs at all in the step-3 solve; (3) whether the UI is silently dropping the rental-ask/blocks output and rendering overflow instead.
- **Severity note:** high — capacity overflow in the flagship planning flow produces schedules that physically cannot be played.
- **ROOT CAUSE FOUND (follow-up test):** the gym rail shows both backup gyms as "backup · on **0 weekends**" — the pool gyms were never attached to any weekend, so the solver has nothing to spill into. Not a solver bug: a configuration state the UI allows and then handles terribly (see T-004). Open question for devs: should step 2 even allow finishing with all backups on 0 weekends, given the demand math is already known?

### T-004 · Over-capacity plan: the board nags per-weekend instead of offering the actual fix (use the backup gyms) · UI · high · web-desktop

> **DEV RESPONSE (2026-08-10):** Same timing as T-003 — the fill verb, hand placement onto backups, and assumed-rental wording all shipped Aug 7-8. Closed.
- **Where:** LIVE site, Plan Your Season → step 3 board. Scenario: home gym (3 courts) over capacity on EVERY weekend (83/48, 57/48…), two 6-court backups in the pool on 0 weekends; "What is left: 26 open," "13 rentals need a building."
- **What I did:** Looked for how to resolve the overflow using the bigger backup gyms.
- **What happened:** Each spill card only offers "A different weekend / Split / Leave it open" — pointless when every weekend is over capacity. The real fix (put a backup gym on the weekend) exists only as drag-and-drop from the top rail plus a fine-print hint ("Turn one on for it back in step 2, or find a building"). The Ideas rail suggests extending hours / adding a court / moving grades — none of which can save a plan that is globally over capacity.
- **What I expected:** The board should connect the problem to the fix it already has:
  1. Spill cards gain a direct action — "Place at Six Park East (6 courts)" / "Place at Haber" — one click to drop that weekend's overflow into a named backup, instead of only different-weekend/split/leave-open.
  2. When the plan is over capacity on EVERY weekend, the Ideas rail should lead with the global fix: "Your backups are on 0 weekends — turn Six Park East on for the overloaded weekends" (ideally one bulk action), not per-weekend tinkering advice.
  3. Offer a "Solve using backups" verb: the engine already prices rentals and minimizes rented court-days — let it propose the rental plan automatically instead of leaving 26 open slots for hand-placement.
  4. Step 2 should make "backup on 0 weekends" loud (warning state), since it guarantees exactly this outcome.
- **Note:** manual drag of a gym onto a weekend + per-date ⋯ courts/hours editor already work as designed — the gap is discoverability and the missing one-click path from overflow to backup.
- **Confirmed from code:** "backup on 0 weekends" is the DEFAULT — added gyms join the pool with no weekends (and 0 courts until set). Weekends CAN be added per gym in step 2's availability cells, but only while one of the operator's own plans is open — otherwise the row is read-only by design. So the worst-case path (add backups → never tap their weekends → globally overflowing plan with unusable advice) is the default path for a first-time operator. Strengthens fixes 2 and 4 above.

### T-005 · Planner board: gym identity color collides with the yellow status fill · UI · med · web-desktop
- **Where:** LIVE site, Plan Your Season → step 3 board.
- **What I did:** Read the board as a tester — full boxes have a yellow filler for off-session, and one of the gyms is assigned virtually the same color.
- **What happened:** The same hue means two unrelated things: yellow/amber as a STATUS fill (off-session filler; orange = overflow/spill) and as a gym's IDENTITY color. Since grade chips are deliberately "in the colour of the gym they play in" (the board's own convention), a yellow-family gym makes chips unreadable — is this a warning or just Gym X?
- **What I expected:** The color pop is good — keep it — but one hue should mean one thing.
- **Fix idea:** exclude the warning family (yellows/oranges/reds) from the gym identity palette; draw gym colors from blues/greens/purples/teals. Status stays as pale background tints, identity stays as saturated chip colors. One palette rule, no layout change.

### T-006 · Planner board: split the "What is left" rail into a global summary bar + collapsible detail rail · IDEA · med · web-desktop
- **Where:** LIVE site, Plan Your Season → step 3 board — the vertical "WHAT IS LEFT / Ideas" rail on the right.
- **What I did:** Worked the board with the rail open; considered whether the list would serve better horizontally above the sessions.
- **What happened:** The rail is persistent but passive — it largely restates the same weekends/numbers the board already shows, costs permanent horizontal width, and its advice sits far from the Highlight/controls area. A fully horizontal placement was considered and rejected (26 items don't fit a strip; it would push the calendar below the fold; it scrolls away exactly when you need it).
- **Suggestion (chosen direction):** hybrid —
  1. A thin, always-visible **summary bar** directly below the Highlight row: totals only, e.g. "26 open · 13 rentals need a building · [Fix all…]".
  2. The detailed list stays as the right rail but becomes **collapsible** (reclaim board width on demand) and **actionable** — clicking a row like "Oct 24–25 · 83/48" jumps/zooms to that weekend instead of just restating it.
- **Why:** summary stays in sight while working anywhere on the board; detail on demand; the board gains width when you want it. Pairs with T-004 (the summary bar is the natural home for the global "use your backups" fix).
- **Follow-up (strengthens this):** the rail currently OVERLAPS the final session column — Session 6 · MAR, the playoffs month, is hidden behind it (screenshot evidence) and only reachable via the horizontal scrollbar. So the collapse shouldn't be optional polish: the rail should DEFAULT to collapsed (a slim "26 open" edge tab) and slide over the board temporarily when opened, so all six sessions — playoffs included — are visible edge to edge without scrolling.
- **Tester's closing note — layout at YOUR discretion:** I don't have a hard preference between the hybrid, the collapsed-rail default, or another arrangement entirely — pick whatever is cleanest UI-wise and easiest to build. The two things that must be true when you're done: (1) all sessions, playoffs included, visible without horizontal scrolling; (2) the "what's left / fix it" information stays easy to reach while working the board. How you get there is your call.

### T-007 · Planner board: grade moves are locked to the same session, blocking cost-saving cross-session moves · IDEA · high · web-desktop

> **DEV RESPONSE (2026-08-10):** OVERRULED BY OWNER DESIGN RULING. Seasons are planned by month; every month is its own session and games never cross months — the fence is the model, not a limitation. Within-month weekend moves (which exist today) are the intended freedom. Closed, by design.
- **Where:** LIVE site, Plan Your Season → step 3 board. Screenshot evidence captured.
- **What I did:** Armed the Haber section on Feb 13–14 (Session 5) to move its grades. Jan 30–31 (Session 4) sits at 29/48 — ~19 free slots at the home gym.
- **What happened:** Only the other February weekends light up as drop targets ("Move 3 grades here"); Jan 30–31 is not offered. The bench is per-month ("NOT PLAYING THIS MONTH"). Cross-session moves are simply not possible in the UI.
- **Why this matters:** the blocked move is exactly what the product itself optimizes for — the engine's stated packing goal is minimizing rented court-days, and moving these games would use FREE home-gym capacity in January instead of renting 5 of 6 courts at Haber in February. The board forbids the operator from doing what its own optimizer wants.
- **What I expected / suggestion:** allow cross-session moves as an explicit, consequence-aware action rather than a silent drag — e.g. a "Move to…" list showing all weekends grouped by session, cross-session targets labeled with their effect ("Session 5 drops to 2 games/team · Session 4 rises to 4 — move anyway?"). Session boundaries carry real meaning (families are promised per-session game counts, per-session fairness, playoff phases), so surfacing the trade-off is right — but a hard prohibition costs leagues real rental money.
- **Dev note:** the underlying move verb is already weekend-agnostic (no session check); the restriction lives in the drop-target/bench UI scoping. The engine's own rental-minimization could even SUGGEST such moves ("save 5 rented courts: shift Grade 5+10+11 to Jan 30–31").

### T-008 · Planner board: visual polish pass (hierarchy, badge restraint, chip cleanup, empty states, depth) · UI · low · web-desktop
- **Where:** LIVE site, Plan Your Season → step 3 board (screenshots on file).
- **What's good already:** gym meter bars, the undo toast, green dashed drop targets, and the color-pop concept are keepers — this is a finish pass, not a redesign.
- **Suggestions:**
  1. **Give each card one typographic anchor.** Session titles, dates, gym names, and chips all sit at similar small-bold sizes, so nothing leads the eye. Make the weekend date + capacity the card's single strong line; demote everything inside it (lighter ink, smaller).
  2. **Badge restraint — stop the warning fatigue.** Nearly every capacity pill is orange/yellow, so warnings no longer register. Badges should be neutral by default and colored only when exceptional (truly over capacity). When 90% of pills are amber, the real fires are invisible.
  3. **Slim down chip anatomy.** Every chip carries five tiny elements: grip, label, count, globe glyph, ✕. On desktop, show grip and ✕ on hover only and move the globe into the tooltip — chips become clean "Grade 9 · 25" pills and the board's texture calms dramatically.
  4. **Collapse empty weekends.** "0/48 · No grades here" boxes weigh almost as much visually as loaded cards. Make them slim single rows that expand into drop targets only while a chip is armed/dragging (the green dashed prompt is already right — it just shouldn't need a big empty box as a host).
  5. **Add figure/ground depth.** Everything is flat white-on-white with gray strokes. Tint the board background slightly (cool light gray) and keep cards white — instant separation, and status colors start reading as signals instead of decoration.

### T-009 · Lowercase UI text sweep — capitalize labels per standard grammatical format · UI · low · web-desktop
- **Where:** Across the site; most visible on the planner board, but this is a sweep, not a single spot.
- **What I saw:** Plenty of user-facing labels start lowercase — e.g. the planner's "not planned" weekend rows, the "home gym" / "backup" role chips, "rented 6 of 6 courts", "on 0 weekends", and lowercase status pills elsewhere in the app (some status badges are lowercased in code on purpose, e.g. admin claims showing "pending" / "approved").
- **What I expected:** Standard capitalization — labels and standalone phrases should start with a capital letter ("Not planned", "Home gym", "Backup"), per common grammatical format.
- **Suggestion:** do a text sweep and pick ONE capitalization convention (sentence case is the usual web standard: first word capitalized, rest lowercase unless a name), then apply it everywhere — including the places where code deliberately lowercases statuses. Mixed styles (ALL-CAPS eyebrows + lowercase chips + sentence-case buttons on one screen) read as unfinished even when each was a deliberate choice. Related precedent: the stat-label casing cleanup (W-001) already established "pick one casing and enforce it" for stats — this extends the same rule to UI labels.

### T-010 · Family-facing league preview shows 4 Grade 9 divisions — two healthy, two orphaned duplicates · BUG · med · web-desktop

> **DEV RESPONSE (2026-08-10, verified against today's box DB):** RESOLVED. The summer world's divisions are clean (no orphan duplicates). The uneven divisions visible on the End-of-Season twin are intentional NPH-style conference sizes, not debris. Remaining hardening (idempotent summer seed) queued low.
- **Where:** LIVE site, plan wizard step 4 → preview of the public league page (the calendar/divisions families see).
- **What I did:** Previewed the league page a family would see.
- **What happened:** Grade 9 shows FOUR divisions with team counts 8, 12, 3, and 2. Same pattern on other grades. Two divisions per grade (the 8/12 pair) look like the intended Tier 1 / Tier 2 structure; the 3- and 2-team ones look like broken duplicates.
- **Likely cause (from the seed code + today's commit history):** `seed-summer-world.ts` creates divisions with plain creates (no existence check / no cleanup of its own failed runs), and today's tip commits are crash fixes to that same seed ("venue lookup tolerates registry name variants", "unshadow pick"). A crashed run appears to have left partially-populated divisions on the box; the post-fix re-run created the full set alongside them.
- **Asks:**
  1. Clean the orphaned divisions out of the box demo world (they're visible on family-facing pages).
  2. Make the summer seed idempotent — wipe-its-own-world-first or upsert divisions by (season, name, tier) — so a crashed run can never leave permanent debris.
  3. Optional product hardening: the public league page could warn operators (not families) when a season contains same-name/same-grade duplicate divisions — cheap sanity signal that would have caught this instantly.

### T-011 · Publish-step season calendar card: unreadable for families, needs a rethink · UI · med · web-desktop
- **Where:** LIVE site, plan wizard step 4 (publish) — the shareable "Season calendar" card (screenshot on file: dark green, month columns, register URL).
- **What I did:** Read the card as a parent would.
- **What happened:** Each weekend row is digit soup — "24–25 · Gr 5 6 7 8 9 10 11 12 JrG" — so answering the ONE question a family has ("when does my kid's grade play?") means scanning mashed-together numerals across five months. "JrG" is insider shorthand. The caption ("straight from the calendar you kept") is operator language on a family-facing artifact, and the platform's watermark outweighs the league's own identity.
- **What I expected:** A card that picks a job and does it:
  - **If it's a marketing card** → radically less detail: league name, "Weekends October–February · Grades 5–12 + Junior Girls," register URL big. Nothing else.
  - **If it's a reference card** → make grade the organizing axis, not the weekend: a compact grade × month grid (rows = grades, dots = playing weekends), so any parent finds their row instantly. Collapse consecutive grades to ranges ("Gr 5–12"), spell out "Junior Girls."
  - Either way: family-facing words only, league branding first.
- **Discretion note:** as with T-006 — the specific design is the developers' call; the requirement is that a parent can answer "does my kid play that weekend?" in under five seconds, or the card should stop trying to answer it at all.

### T-012 · Referee accepts a shift → nowhere in the referee area to see the games · UI · high · web-desktop

> **DEV RESPONSE (2026-08-12):** BUILT — the redirect is gone and `/referee` is the referee's schedule. "My Games" now lands on a real dashboard: assigned games with the next one first (day, time, venue + court, both teams, league + season, and the agreed per-game rate when the game came from a booked shift), games already worked collapsed underneath, each card opening the game. Empty state is honest and points at the shift inbox rather than showing a blank page. Data comes from a NEW shared module `lib/queries/referee-games.ts` that My Calendar's refereeing lens also reads (parity law, one data source), so the two can never disagree, and only PUBLISHED games are ever returned (the T-013 draft law). The accept confirmation half is fixed too: the referee's `referee_shift_booked` notification, the `referee_shift_games_added` notification from publish, and the inbox's own success banner all say "My games" and link to `/referee` instead of the generic calendar; the shift inbox gained a "My games" link in its header. `/referee/requests` keeps its job (availability + offers). Verified live over HTTP as a seeded referee: `/referee` 200 with "Coming up (11)" and "Games you've worked (38)" against exactly 49 assigned published games, and `/api/calendar/mine` still returns the refereeing lens with its items after the refactor.
- **Where:** LOCAL, latest master (`88a2d241`). Referee account, after accepting a shift offer.
- **What I did:** Accepted a shift; looked for the assigned games "in the schedule."
- **What happened:** The nav's "My Games" tab (`/referee`) is a redirect to the shift-requests inbox — the code's own comment says "until a referee dashboard exists, land on requests." The games DO land in the general **My Calendar** (verified end-to-end: accept → 3 games appear under the "Refereeing · league" lens) — but nothing tells the referee that, and nobody looks for their assignments in a generic calendar when a tab literally named "My Games" exists.
- **What I expected:** Accepting a shift should visibly produce a schedule: either a real referee dashboard behind "My Games" (assigned games, upcoming first, with dates/venues/rates), or at minimum the accept confirmation linking straight to My Calendar.
- **Also:** the referee gets NO feedback on accept about what they were booked onto — the "assigned to N games" message goes to the LEAGUE OWNER's notification only.

### T-013 · Shift accept books referees onto DRAFT (unpublished) games — invisible assignments · BUG · high · web-desktop

> **DEV RESPONSE (2026-08-11):** BUILT, both halves. (a) Accept now assigns PUBLISHED games only (the same `PUBLISHED_GAME` law every public surface filters by), counts the in-window drafts, and the response says both numbers, so the referee UI reads "you're booked, N games" or "you're booked, games appear when the schedule goes out" instead of a count over invisible games. The referee also gets their own notification now (`referee_shift_booked`, links to My Calendar) — the owner-only asymmetry is gone. (b) The season schedule publish route reconciles: newly published games on a day with an ACCEPTED shift attach that shift's referee, window respected, and the referee hears their schedule grew (`referee_shift_games_added`). Shared logic in `lib/referees/shift-assign.ts`; both halves proven in `referee-booking.int.test.ts` (8/8: accept-over-drafts assigns 1 of 3, publish-after-accept attaches the in-window draft and skips the out-of-window one). T-012's dashboard ask is NOT covered here — only the accept feedback half of it.
- **Where:** LOCAL, latest master. Found via end-to-end test of the accept flow.
- **What happened:** The accept endpoint (`api/referee-requests/[id]`) assigns the referee to every game on the session day WITHOUT checking the new draft/publish visibility rule (`PUBLISHED_GAME`, Schedule Studio P0). Verified: accepting a shift over draft games returns "assigned to 3 games" — and those games are invisible to the referee on every surface (My Calendar correctly filters drafts). A referee can be told they're booked while able to see nothing.
- **The mirror-image gap:** assignment is a one-time snapshot at accept. Games committed/published on that day AFTER the accept are never attached to the accepted referee — so accept-before-publish yields permanently empty shifts.
- **Fix idea:** the accept flow and the publish flow need to reconcile: (a) accept should assign only published games and TELL the referee the count; (b) publishing a day's schedule should (re)attach any accepted shift's referee to the newly published games in their window. Either half alone still leaves ghosts.

### T-014 · Plan wizard teams step: "Not in this plan" doesn't look clickable — a toggle dressed as a badge · UI · med · web-desktop

> **DEV RESPONSE (2026-08-11):** BUILT, per the confirmed root cause. A zero-unit grade row (never estimated, or removed from the plan) no longer renders the dead toggle at all — it offers "+ Add this grade", which runs the code's own designated restore path (creates the unit, adopts the number already on the stepper, hands focus to the stepper). The silent-inert states are gone too: with no owned plan open, on the imported reference, or while a plan's world loads, the pill renders visibly disabled with the reason in its title ("Open one of your plans to edit." / "This is the imported reference…" / "This plan's numbers are still loading."). The live pill also carries a title, and the add affordance is a solid button, visually apart from the dotted "Remove from this plan" link. Verified live in `scripts/demo/verify-qa-t014-t016.mjs` (remove Grade 5 → fold-in row offers + Add this grade → click puts it back in the plan; reference plan shows the disabled pill with the reason).
- **Where:** LOCAL, latest master (`88a2d241`) — Plan Your Season → teams step, the in/out pill on a grade row.
- **What I did:** Had grades sitting at "Not in this plan" and wanted them in the plan.
- **What happened:** It wasn't obvious the pill itself is the way in — it reads as a status label. It IS the toggle (one click includes the grade), but its out-state styling (plain white pill, gray 11px bold text) matches the read-only badges nearby, and the label describes state rather than offering an action. Classic affordance failure: nothing says "click me."
- **What I expected:** The out state should advertise the action, not the situation.
- **Fix ideas (any one of these largely solves it):**
  1. Action-verb label when out: **"+ Add to plan"** (with the plus glyph) instead of "Not in this plan"; when in, keep state language ("In this plan ✓") with a hover affordance for removal.
  2. Make the out state look like a button among badges: dashed or tinted border, hover lift — anything that contrasts with the true read-only pills beside it.
  3. At minimum a tooltip/title ("Click to include this grade in the plan").
- **Dev pointer:** `plan/teams-step.tsx` ~line 782 (`data-testid="grade-in-out"`, owner ruling 2026-08-05). Note the adjacent stronger "remove from plan entirely" action — whatever styling change lands must keep those two visually distinct.
- **Process note:** logged rather than fixed locally — the plan wizard is inside the tester branch's no-touch scheduling fence.
- **ESCALATION (same session):** it's worse than styling — the pill also SILENTLY IGNORES CLICKS when no owned plan is open, when viewing the reference calendar, or while a plan's world loads (the code's own words: "the toggle is shown but goes quiet"). Reproduced live: tried to include grades, nothing happened, no explanation. So the identical visual is sometimes a live toggle, sometimes a dead one, sometimes static text. Silent no-ops are the worst affordance failure — the fix must include a visibly disabled state with the reason ("Open one of your plans to edit"), not just a prettier active state.
- **ROOT CAUSE CONFIRMED (code-traced, reproducible even inside an editable plan):** grades with NO unit in the plan's world (never estimated — stepper at 0) still render the "Not in this plan" pill, but clicking it is a guaranteed no-op: `setIncluded` → `withUnitIncluded` (plan-world.ts:1298) maps over `world.units` and matches nothing, so the plan "saves" unchanged and the pill never flips. The designed entry path for such grades is the ADD A GRADE stepper (which creates the unit) — the code's own comment says so ("add-a-grade's stepper is the restore path") — but the UI never hands the user there. **Fix:** on zero-unit rows either don't render the toggle at all, or make it a "+ Add this grade…" affordance that focuses/opens ADD A GRADE. Pointer: `teams-step.tsx` grade-row render (~740–800) + `withUnitIncluded`.

### T-015 · Planner offers session dates on invalid weekdays — league days are Fri/Sat/Sun ONLY · BUG · high · web-desktop

> **DEV RESPONSE (2026-08-11):** AUDITED, then BUILT. Audit findings (local DB, TZ=America/Toronto): the drift family is real — 102 of 150 `SeasonSessionDay` rows were stored at UTC midnight (both Showcase seasons, D1, NPA, WNPA), which reads a day early on every local rendering (Sat rows say Fri — the "Fri+Sat pairs" symptom) and would land engine slots on the wrong local day (the runbook #81 gotcha); Summer League and National Circuit already stored local midnight (correct). No Sun+Mon rows exist in the current worlds; those pairs came from the tester-side seeded state and the same mixed-convention family. Fixes: (1) every day-row creation path now writes LOCAL-midnight instants — `ensureWeekendSession` (planner create-on-toggle/ghost drop), the sessions API (`date-only` strings pinned to local midnight), `seed-nph-demo.ts`, `seed-journey.ts`; (2) one-off heal `scripts/fix-session-day-tz.ts` shifted the 102 drifted rows to local midnight (local DB done; box owes the same run); (3) the Fri/Sat/Sun law is enforced as `isLeagueDay` in planner-core: `buildPlannerState` and the step-2 grid (`enumerateSeasonWeekends`) both drop any session off those days from planning supply and display — a midweek session is never a runnable option (unit-pinned in venue-grid.test.ts). Virtual weekend generation was already Sat+Sun-only and TZ-proof (pure UTC math).
- **Where:** LOCAL, latest master — Plan Your Season, the weekend date pairs shown in planning.
- **The tester's ruling, verbatim intent:** remove every planning date that isn't a Friday, Saturday, or Sunday. Leagues never run sessions on a Monday or a Thursday — pairs like **Nov 8–9 (Sunday+Monday)** and **Fri+Sat pairs that exclude the Sunday** are showing up as runnable options and should be disregarded/removed.
- **Likely cause worth checking:** weekday drift on stored dates (a Saturday anchored at midnight rendering as the neighboring day) — same family as the TZ issues already fixed in "anchor day rows at LOCAL midnight" and the "TZ-proof weekday histogram." If pairs are being *generated* on Sun+Mon, the generator's anchor is off by one somewhere.
- **Ask:** constrain session-day generation and display to Fri/Sat/Sun, and audit existing plan/demo dates for the off-by-one.

### T-016 · Ideas rail should propose cost-saving consolidation moves within a session · IDEA · med · web-desktop

> **DEV RESPONSE (2026-08-11):** BUILT, with the owner's clarification. New "consolidate" suggestion in the rail: a weekend whose rented gym hosts one lone grade, when another weekend of the same month can absorb it free of charge under the price list, gets "…rents N courts at X for Grade Y alone. Move … Releases <weekend> whole: saves N rented court-days, and the X booking comes off the ask sheet." — the saving is quantified in rented court-days, and when the move lands the grade on a weekend it already plays, the sentence names the compression ("Grade Y's Oct games land on one weekend"). Accepting performs the move AND RELEASES the emptied weekend entirely: it comes off the plan (draws as a ghost row), its gym booking off the ask sheet, and the save writes the release into the plan's own world (`chosen: false`); one undo pill restores everything (assignment, gyms, weekend, ask sheet). Built on the rail's existing suggestion/move machinery (suggestFor + the board verbs) — no new UI paradigm. Unit-pinned in planner-rail.test.ts (offer, court-day pricing, compression clause, silence when nothing absorbs it or the home gym is in play) and driven live in `scripts/demo/verify-qa-t014-t016.mjs`.
>
> **T-019 RULING APPLIED HERE TOO (owner, 2026-08-11, mid-build):** suggestion acceptance is a TWO-STEP PREVIEW-CONFIRM across the whole rail, this idea included. First click on a suggestion pins a preview: the board dims except the source and destination weekends, both cards show what would land or leave with before → after numbers (the source of a consolidation says "This weekend comes off the plan"), and the row's button flips to "Apply move". Second click applies (then the existing undo pill and move marks); clicking anywhere else, or Escape, dissolves the preview and changes nothing. Hover adds the same preview on desktop without pinning, and never dislodges a pinned one. One subtlety found and fixed during the build: the board's capture-phase dissolve-on-any-click committed before the confirm's own bubble handler ran (React flushes discrete updates between phases), which un-pinned the button mid-click — the dissolve now skips clicks originating inside a suggestion row.
- **Where:** LOCAL, latest master — Plan Your Season board, the suggestions/Ideas rail.
- **Scenario (real, from my plan):** one grade is the ONLY thing playing on Oct 17–18 — so that weekend's building is booked for a single grade — while Oct 9–10, in the SAME month/session, has spare court time that could absorb them.
- **What I expected:** a suggestion like "Move Grade X from Oct 17–18 to Oct 9–10 — frees a booked building day" with the move one click away (the rail's suggestions already know how to 'do the move'). The engine minimizes rented court-days when it draws, but the rail never re-audits the CURRENT plan — especially after hand edits — for consolidation opportunities.
- **Why it's legal:** this is a within-month weekend move — explicitly the "intended freedom" under the owner's sessions-are-months ruling (see T-007's resolution). No fence is crossed.
- **Design note for devs:** the solver also deliberately spaces grades (day-shape/cadence rules), so the suggestion should respect spacing constraints or state the trade-off ("saves one building day; Grade X's October games compress to one weekend"). Quantifying the saving in the suggestion (rented court-days, ideally $) is what makes it land with operators.
- **Clarified (tester, same session):** accepting the suggestion should RELEASE the emptied date entirely — the weekend comes off the plan, its gym booking off the ask sheet — not merely relocate the games and leave a hollow booked date behind. The whole point is the un-spent rental.

### T-017 · Roster-deadline reminder system: early approval stays, but rosters get chased to a hard date · IDEA (feature spec) · high · web + native
- **The problem:** leagues rightly approve team entries months before rosters exist — but nothing then drives rosters to completion. An approved, forever-empty team is a ghost the schedule must plan around, discovered too late.
- **Keep:** roster-less registration and approval (correct for the domain — see the platform's own offer-pipeline design). Add: a deadline with an escalating reminder cadence, and visibility for the league owner.
- **Proposed cadence** (grounded in the platform's own waiver-reminder precedent of 7d+24h with a send-once dedupe ledger, and external best practice of 3–5 escalating touches):
  1. **T-30 days** — email only: "Your roster for [league season] is due [date] — you have 4 of 8 required players."
  2. **T-14 days** — email + in-app notification.
  3. **T-7 days** — email + in-app + push (matches the house waiver cadence day).
  4. **T-24 hours** — urgent tone, all channels.
  5. **Day after deadline (overdue)** — "Your team is not eligible to play and the schedule will be planned without you until the roster is finalized," with the one-click fix link.
- **Rules that make it good, not naggy:** every touch is DATA-DRIVEN and self-healing (checklist philosophy — compliant roster = touch silently skipped); every message shows the live count and deep-links to the roster page; send-once ledger per (team, season, window) mirroring `WaiverReminder`; cron infra already exists (`/api/cron/*`).
- **League-owner side:** a digest at T-7 and day-after ("3 teams still un-rostered: …") so operators chase humans, plus the approval row itself showing "0 players committed" at approval time (informed approval — earlier finding, still unbuilt).
- **Owner decisions needed:** (1) what "finalized" means — roster locked vs ≥N players (suggest a per-season minimum-roster number); (2) where the deadline lives (new season field vs derived from season start).
- **Scheduling-side enforcement (dev territory):** after the deadline, non-compliant teams are flagged and excluded from the schedule draw until they comply — the "plan around them" half.
- **Fence note:** the reminder system itself is registration/communications (waiver-reminder cousin) — buildable outside the scheduling fence; only the draw-exclusion piece touches scheduling.

### T-018 · Fridays are rescue-only — let a session DECLARE it runs Fridays · IDEA · med · web-desktop
- **Where:** LOCAL, latest master — Plan Your Season board, the Friday mechanism.
- **What I hit:** the only way to get a Friday onto a weekend is the board's conditional suggestion, which appears solely when a shortfall exists that a right-sized Friday at an already-used gym would fix (owner ruling 2026-08-06, "silent unless…"). There's no way to declare up front that a session runs Friday evenings as a fact — even though some leagues (the NJC/NSC Fri–Sun constraint is the platform's own example) simply DO run Fridays.
- **Suggestion:** keep the smart suggestion, but also allow a proactive "this session runs Fridays" declaration (per weekend or per season), feeding the same `fridays`/window machinery. The per-season Friday time window already exists (`fridayStart`/`fridayEnd`, default 6–10 PM) — this just adds the missing front door. Relates to T-015 (valid day shapes are Fri/Sat/Sun).

### T-019 · Suggestions should PREVIEW their move on the board before applying — see what moves, then commit · IDEA · med · web-desktop

> **DEV RESPONSE (2026-08-11):** The rail half of this SHIPPED with the T-016 build — the owner ruled the same day that preview-confirm is the canonical acceptance for every rail suggestion (see the ruling note under T-016): first click pins the preview (board dims around the two weekends, ghost strips show what lands and leaves, both cards read before → after), second click applies, anything else dissolves. Hover adds the preview on desktop; touch gets the same two taps. Deliberately NOT expanded beyond the suggestions rail in that pass (drags and the other board verbs still apply directly).
- **Where:** LOCAL, latest master — Plan Your Season board, the Ideas/suggestions rail.
- **What I hit:** accepting a suggestion just… happens. The interface does the move for you, but you never SEE what's about to move where — you're trusting a sentence, then auditing the board afterward to understand what changed.
- **Proposed interaction (UI/UX-guideline-checked):**
  1. **Hover (desktop) or first tap (touch) = preview mode:** the board dims except the SOURCE and DESTINATION weekends; ghost chips render at the destination showing exactly what would land; both cards' capacity badges show before→after ("83/48 → 57/48" · "29/48 → 53/48"). Nothing is committed; mouse-out/tap-elsewhere dissolves it.
  2. **Click / second tap = apply:** the chip travels source→destination as ONE shared-element animation (~250ms, ease-out; instant + move-mark under prefers-reduced-motion), then the existing undo pill appears.
  3. Touch parity is mandatory (hover can never be the only path — first tap previews and flips the row's button to "Apply move").
- **Guideline basis:** motion must convey cause-and-effect, not decorate; one or two animated elements max (the moving chip, not the whole board); ease-out entries; reduced-motion respected; hover-only interactions forbidden on touch.
- **Implementation note (cheap!):** the board already owns every primitive this needs — ghost chips, the lens/dimming system, persistent move marks, flashMove, and the undo pill. Preview = a dry-run of the same move verb rendered with existing ghosts + lens-dim; apply = the verb it already runs. This is composition, not new machinery.

<!-- Add findings below. Next ID: T-020 -->

