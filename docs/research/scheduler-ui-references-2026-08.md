# Scheduler UI References — Competitive & Adjacent Patterns (2026-08)

Research pass for the season PLANNER/SCHEDULER work (board of month columns → weekend cards → grade chips by gym → home-gym-fills-first → rental blocks assigned from a venue pool → venue tray drag-drop → ask sheet → per-gym availability grids → suggestion rail). Read-only web research; no signups, no code changes. Every claim below is sourced; inference is marked **[inference]**.

Related in-repo context: `docs/research/leagueapps-comparison.md`, `docs/research/tool-feature-matrix-2026-07.md`, `wave_1_to_5_scheduler_build.md` (memory).

---

## 1. Exposure Events (NPH's own distribution tool) — deepest dive

Sources: [Features (basketball)](https://basketball.exposureevents.com/features), [Event Setup/Scheduling/Publishing](https://support.exposureevents.com/hc/en-us/articles/115001946987-Event-Setup-Scheduling-Publishing), [Steps to get your first event scheduled](https://support.exposureevents.com/hc/en-us/articles/115001946987-Steps-to-get-your-first-event-scheduled), [Venue troubleshooting](https://support.exposureevents.com/hc/en-us/articles/360001128213-Venue-troubleshooting), [Pricing](https://exposureevents.com/pricing), [Hire a Scheduler](https://basketball.exposureevents.com/hire-a-scheduler), [Capterra listing](https://www.capterra.com/p/147785/Exposure-Events/), demo video: [Exposure Event Setup, Scheduling and Publish Demo (YouTube)](https://www.youtube.com/watch?v=G8GCMOK2lPU) (title only surfaced — transcript not accessible via fetch).

**Findings:**
- Two schedule-authoring modes coexist: a manual **"intuitive drag-and-drop grid interface"** and a separate **"AI Scheduling Engine"** that generates a complete schedule from constraints in one pass — the org picks per event, it's not forced into either. ([Features](https://basketball.exposureevents.com/features))
- The grid workflow has an explicit **unscheduled-games staging area**: bracket-generated or manually-created games sit in an "unscheduled games" list until dragged onto the grid — i.e., games exist before they have a court/time, and placement is a separate drag step from creation. ([Event Setup/Scheduling/Publishing](https://support.exposureevents.com/hc/en-us/articles/115001946987-Event-Setup-Scheduling-Publishing))
- Venue/court cells have real state, not just presence/absence: adding a venue after the grid already exists leaves its cells **grey and disabled** until double-clicked to activate; courts can be individually marked inactive, which hides them from both the internal grid and the public schedule. ([Venue troubleshooting](https://support.exposureevents.com/hc/en-us/articles/360001128213-Venue-troubleshooting))
- Per-venue **time-increment / game-slot-length is configurable per court**, not just per event — a different court can run 20-minute slots while another runs 30-minute slots inside the same grid, as long as the whole grid's base increment is set to the shortest one in use. This only applies to the manual drag-drop grid, not the batch/AI scheduler. ([Venue troubleshooting](https://support.exposureevents.com/hc/en-us/articles/360001128213-Venue-troubleshooting))
- **Schedule Requests** are collected up front (at registration or manual import) as structured constraints — exclude-same-time-as-team-X, matchup exclusions, date/time/location preference, game-count requirements — and are fed into both the AI engine and into standings randomization, so a request isn't just a note, it's a constraint the solver and the standings-shuffle both respect. ([Features](https://basketball.exposureevents.com/features))
- Monetization is coupled directly to the publish step: a **"scheduling credit" costs \$2 and represents one visible team in a published schedule**; unpaid teams stay hidden from the published schedule even though the rest of the platform (setup, standings shape, etc.) is free to use before that point. Not a UX pattern to copy, but relevant because it tells you Exposure treats "team appears in the public schedule" as the one gated, high-stakes moment — worth noting since our own "publish" moment (draft→publish gate, per CLAUDE.md) is the same kind of hinge. ([Pricing](https://exposureevents.com/pricing))
- Their own marketing to organizers frames scheduling as inherently overwhelming — "**all the responsibilities and headaches**," "**maximizing facility usage while minimizing team commute times**," NCAA-certification compliance — and they sell a **human "Exposure Certified Professional" scheduler-for-hire** service on top of the software for exactly this reason. **[inference]**: even a mature AI-engine + drag-drop tool doesn't fully replace a human for complex multi-venue optimization; that's a signal our suggestion rail should aim at "one-tap fixes for the last-mile mess," not full autonomy. ([Hire a Scheduler](https://basketball.exposureevents.com/hire-a-scheduler))
- Reviews found were sparse and uniformly positive on ease-of-use/notifications ("very user friendly," 5★) with only price called out as a con — no public complaints surfaced about the grid itself, so no "done badly" evidence from reviews; the "done badly" call below is inferred from the docs, not user complaints. ([Capterra](https://www.capterra.com/p/147785/Exposure-Events/))

**Worth adopting:** the unscheduled-games staging list feeding a drag target grid is functionally identical to our venue tray → weekend cell drag-drop — validates the pattern directly from the tool NPH already uses, so continuity of mental model for NPH admins moving between the two tools is a real, evidenced argument for keeping our tray-to-cell interaction close to this shape.

**Worth avoiding:** per-court grey/disabled cells that require a double-click to "activate" a venue added after grid creation is a two-step, easy-to-miss activation state **[inference — no screenshot available, inferred from support-doc wording]**; our rental-block assignment should make a newly-added venue immediately live in the pool rather than requiring a separate activation click.

---

## 2. TeamLinkt

Sources: [Create a Schedule with the Schedule Builder](https://help.teamlinkt.com/en/articles/4938679-create-a-schedule-with-the-schedule-builder), [Scheduling product page](https://teamlinkt.com/sports-management-software/scheduling), [Capterra reviews](https://www.capterra.com/p/187412/TeamLinkt/reviews/).

- Builder flow is linear and guided: **Schedule → Builders → Schedule Builder → Create → guided setup wizard → edit page → Publish**, with settings/attributes tabs on the left of the edit screen and the games grid as the main panel. ([Help Center](https://help.teamlinkt.com/en/articles/4938679-create-a-schedule-with-the-schedule-builder))
- Editing a placed game supports two equally-weighted paths: **click Edit on the game card** (form-based) or **drag it to a new slot** (spatial) — not drag-only.
- Auto-generation promises to **"balance matchups, prevent conflicts, and generate complete game and practice calendars in seconds,"** with changes syncing instantly to team website/app — publish isn't a separate deploy step, edits propagate live. ([Scheduling page](https://teamlinkt.com/sports-management-software/scheduling))
- Real user complaint: the **auto-schedule "doesn't have enough programmable exceptions or considerations,"** with the workaround being manual hand-scheduling — i.e., their solver's constraint vocabulary is thin enough that power users fall back to doing it by hand. ([Capterra](https://www.capterra.com/p/187412/TeamLinkt/reviews/))
- Schedule builder **cannot create events for past dates** — a hard constraint surfaced in docs, plausibly a real limitation rather than a design choice.

**Worth adopting:** dual edit affordance (form OR drag) on every placed item, so a keyboard/precision user and a spatial/mouse user both have a first-class path — not one path with the other bolted on.

**Worth avoiding:** a solver whose constraint set is too thin invites users to abandon it and hand-schedule, which then desyncs from whatever "explains" the plan — our suggestion rail and solver constraints need to cover the actual long-tail asks (blackout, home-gym-first, rental caps) that show up in Exposure/Diamond Scheduler's constraint lists, not just the common cases.

---

## 3. LeagueApps (scheduling + Facilities)

Sources: [Scheduling](https://leagueapps.com/youth-sports-management-platform/scheduling/), [Facilities](https://leagueapps.com/youth-sports-management-platform/facilities/), [Linking Venues in LeagueApps Facilities](https://support.leagueapps.com/hc/en-us/articles/22765754839959-Linking-Venues-in-LeagueApps-Facilities), [Capterra reviews](https://www.capterra.com/p/127065/LeagueApps/reviews/).

- **Facilities is a distinct product surface from Scheduling**, linked together rather than one screen — a "Venue or Space" (e.g. "Field 1"/"Court 3") is the atomic bookable unit, and venues must be explicitly linked between the Facilities module and the Scheduling module for sync to work.
- Facilities supports genuinely complex real-world booking shapes: **split bookings between teams on one field, multiple teams on one field, price flexibility by space, padding between bookings, external (non-org) booking requests, and recurring/overlapping bookings** — a richer constraint vocabulary than most youth-league tools bother with.
- Global calendar view is framed as replacing "traditional manual coordination" — the pitch is org-wide visibility across teams/coaches/facilities in one place, mobile-synced with no double-entry.
- Review signal is mixed: G2 (4.8/5, 21 reviews) reads positive on ease-of-use/customization, while Capterra has complaints that **"customer service was terrible," "software was not user friendly," "invoicing was a nightmare,"** and registration was hard to build — the negative reviews cluster on billing/registration, not specifically on the scheduling grid itself.
- No screenshot/UI-layout detail was retrievable from public marketing pages — LeagueApps' scheduling grid visual design is effectively undocumented publicly. **[gap, not a finding]**

**Worth adopting:** treating "Venue" as a first-class, linkable object shared across facility-booking and season-scheduling (rather than scheduling owning its own copy of venue data) — directly analogous to our own venue pool being one shared resource that both the solver and the tray draw from.

**Worth avoiding:** splitting Facilities and Scheduling into separately-branded products that require manual "linking" risks the exact desync bugs their own docs warn about (a booking not linked to a venue won't sync) — our board, tray, and ask sheet should stay one system against one venue/booking model, not three surfaces needing manual reconciliation.

---

## 4. SportsEngine HQ (Season Management / Scheduling Assistant) + SportsEngine Tourney

Sources: [Scheduling Assistant FAQ](https://help.sportsengine.com/en/articles/7208629-season-management-scheduling-assistant-faq), [How to use the Drag/Drop Tool](https://tourney-help.sportsengine.com/en/articles/8225721-how-to-use-the-drag-drop-tool-to-schedule-games), [Multiple Schedule Increments in Drag & Drop](https://tourney-help.sportsengine.com/en/articles/8225322-how-to-use-multiple-schedule-increments-in-drag-drop-scheduling), [B2B HQ Scheduling feature page](https://www.sportsengine.com/hq/features/scheduling/).

- The Scheduling Assistant is explicitly framed as **"a workspace for managing venues, time slots, scheduling rules, games, and Autoschedule settings for a season"** — one named workspace, not scattered settings screens. It requires three inputs before it can run: games, available venues, available time slots.
- Constraint vocabulary is genuinely broad: game length, min time between slots, max games/day, min time between games, blackout dates, venue restrictions, per-game restrictions — this is the most complete public constraint list found across all tools researched.
- **Conflict prevention is proactive, not just post-hoc validation**: before you can place a game into a slot that would conflict, **"the time slots that will cause conflicts will be blacked out"** — the grid pre-computes and visually removes illegal targets rather than letting you drop and then complaining.
- Games that do end up with an error are visually loud: **"shown in black boxes with red font"** — a distinct, high-contrast error state separate from the normal card styling, and hovering shows the specific conflict reason.
- Separately, a **warning-icon + "View conflict details"** pattern exists at the season level (double-bookings, rule violations) — hover or click drills into specifics, so conflicts have both an ambient icon (scan-the-board glance) and a detail view (investigate-this-one).
- **Per-venue/per-court time increments differ inside one grid** (same mechanism as Exposure Events above) — set via a "Change Scheduling Slots" toggle, with the overall grid increment forced to the shortest slot length in use.
- A **"Schedule Summary"** view (reached via a three-dot overflow menu) shows games broken down per division by team and home/away balance — a rollup/audit view distinct from the spatial grid.
- Auto-saves on every drag ("any movement will be saved automatically") — no explicit save step in the manual grid.
- Real complaints found (general, not scheduling-specific): **"glitches in the registration process," "issues with schedules not updating correctly," "bugs in the app,"** and slow/automated customer support — signal that a scheduling tool at this scale accumulates real desync/reliability complaints even with a mature conflict system.

**Worth adopting:** the two-tier conflict signal (pre-emptive greyed-out/blacked-out illegal drop targets DURING drag, plus a persistent black-box-red-font error state for cards that are already in a bad spot) is the clearest, most battle-tested conflict-UX pattern found in this research. Directly applicable to our rental-block assignment and availability grid: illegal drop targets (already-booked gym-hour, wrong grade's home gym) should grey out live during a tray drag, and any weekend card left in violation (e.g., over-capacity rental block) should carry a loud, distinct error treatment on the board, not just a subtle badge.

**Worth avoiding:** conflict detail requiring a hover-then-click-through ("View conflict details") for every single flagged item is fine for isolated cases but doesn't scale to "18 games need 3 courts" style aggregate problems — our suggestion rail's one-tap fixes are a stronger pattern than a per-item detail drawer for bulk situations.

---

## 5. Diamond Scheduler (Cactusware) — baseball/softball

Sources: [Capterra listing](https://www.capterra.com/p/178117/Diamond-Scheduler/), [Cactusware](https://cactusware.com/).

- Grid view supports **manual re-assignment of time slots with conflict visibility built into the same view** used to check team game-counts and opponent distribution — i.e., the grid doubles as both the editing surface and the fairness-audit surface, rather than splitting those into separate reports.
- Constraint list: min days rest, max travel distance (from last game OR from home venue), coach conflicts, designated home-venue per team, max games/day, max games/week — the "max travel distance" and "designated home venue" constraints are notable; **[inference]** this is the closest public evidence of a "home venue fills first" style rule existing in a competitor's constraint vocabulary, though not described as a UI concept (no visual "home gym" distinction was found, just a scheduling rule).

**Worth adopting:** keeping the fairness/distribution audit (games-per-team, opponent variety) inside the same grid view as editing, rather than a separate report a planner has to context-switch to — supports doing the same for our board (surface capacity/fairness signals directly on weekend cards, not a separate screen).

**Worth avoiding:** no UI screenshots or interaction detail were publicly retrievable at all for this tool — **[gap]** its constraint-list depth is real evidence, but nothing here should be read as endorsing (or critiquing) its actual visual design, since none was found.

---

## 6. ScheduleWerks (hockey-focused)

Source: [ScheduleWerks](https://www.schedulewerks.com/public/index.html?pgIdx=9), [About](http://www.schedulewerks.com/aboutUs.php).

- Positions itself narrowly: **"brings together teams, schedules, facilities and tournaments all together in one calendar that's easy to understand"** — single calendar as the organizing metaphor, built originally for multi-rink hockey associations (one calendar, multiple rinks).
- Longevity note: built by a hockey-association ice scheduler starting 2004, later partnered with PuckSystems (which became part of SportsEngine) — **[inference]** its "one calendar / multi-facility" framing likely influenced SportsEngine's later HQ scheduler design given the corporate lineage, though no direct feature comparison was retrievable to confirm this.
- No further UI/interaction detail publicly available beyond marketing copy — **[gap]**, low signal value overall; included only for completeness since it was named as a target.

---

## 7. LeagueLobster

Source: [PRO Features](https://help.leaguelobster.com/en/articles/477173-pro-features), product/marketing summaries via search.

- Calendar is explicitly **"color coded by division"** with drag-and-drop rescheduling — the closest direct precedent found for our grade-chip-colored-by-gym idea, just applied to division instead of venue. Confirms colored-by-category calendar chips is an established, well-liked pattern (user reviews call the scheduling "a breeze").
- Constraint set: coach conflicts (teams sharing a coach can't overlap), team-level "don't schedule me on day/time/venue X" requests, division-restricted days/times/venues, min/max time between games, max games/day.
- Supports both round-robin (division/pool + game count) and group-stage-plus-knockout tournament shapes from the same builder.

**Worth adopting:** color-by-category as the primary at-a-glance grid encoding is validated twice now (division here, resource-type in Ganttic below) — reinforces that our grade-chips-by-gym coloring is on well-trodden, proven ground, not a novel risk.

**Worth avoiding:** no negative signal found; treat as a positive-pattern-only reference given the shallow public documentation available. **[gap]**

---

## 8. TeamSnap / GameChanger / Playeasy — thin results, brief notes

- **TeamSnap**: positions scheduling as secondary to communication/attendance — ties sessions to roster/attendance reporting rather than deep venue/facility mapping; one third-party comparison explicitly notes a competitor "adds game assignment to fields and facilities" as a differentiator **implying TeamSnap itself is weaker on facility-level assignment**. ([Eye in Team Sports feature rundown](https://www.eyeinteamsports.com/software/a-detailed-look-at-teamsnaps-software-features-in-2025)) **[secondary-source inference, not TeamSnap's own claim]**
- **GameChanger**: 2026 "Head-to-Head Game Scheduling" lets a league admin create matchups against any team that's joined the org, plus a **"Placeholder (TBD) games"** feature — schedule the slot/bracket structure and slot in the actual team later once known (useful for bracket advancement/seeding-dependent slots). Bulk schedule import exists as a separate CSV-style path. ([Head-to-Head Game Scheduling](https://help.gc.com/hc/en-us/articles/4424511682061-Head-to-Head-Game-Scheduling), [Placeholder Games](https://help.gc.com/hc/en-us/articles/23530203776141-Scheduling-Placeholder-TBD-Games-in-GC-Leagues-Tournaments))
- **Playeasy**: no independent documentation, reviews, or feature pages surfaced in search — **[gap, could not research]**; dropped from findings, do not cite as a source of any pattern.

**Worth adopting (GameChanger):** the "placeholder/TBD game" concept — schedule structure/slot before the specific occupant is known — maps to our own "rental block: needs 3 courts · 18 games" being a placeholder pool of games-needing-courts before the solver/drag-drop assigns them individually. Confirms placeholder-then-fill is a legitimate, named pattern elsewhere, not a workaround.

---

## 9. Adjacent non-sports resource-scheduling references

### Skedda (space/room booking)
Sources: [Booking Calendar](https://www.skedda.com/platform/booking-calendar), [Features](https://www.skedda.com/features).
- Offers **four interchangeable calendar lenses on the same data**: Day (dense, transactional booking), Month ("classic wall-style," coarse overview with hover-for-detail), Grid (month-wide breakdown with filtering), List (searchable/exportable, "deep dive"). **[inference]** the pattern worth naming: same underlying bookings, radically different views optimized for different tasks (book-right-now vs. audit-the-month vs. export-for-someone-else), rather than one view trying to do all three.
- **Interactive floor plans** let a booker click a visual layout of the actual space rather than only a table/list of named rooms — relevant if we ever want a literal gym-floor-plan view of courts, though no detail on how availability states are colored on the floor plan was retrievable. **[gap]**

### Ganttic (resource-scheduling / Gantt lanes)
Source: [Resource Calendars: How to Plan, Schedule, and Integrate](https://www.ganttic.com/blog/resource-calendar).
- Canonical resource-lane pattern: **rows = resources (courts/gyms in our case), color-coded per resource, taskbars/blocks placed across a shared time axis** — this is the standard "resource calendar" shape and maps directly onto a per-gym-per-weekend availability grid.
- Available vs. allocated resources are conventionally shown with a green/red (or equivalent) status color distinction — a generic best practice, not something unique to Ganttic, but confirms binary free/booked coloring is the expected baseline before layering on our assumed-vs-confirmed distinction on top.
- Could not confirm Ganttic's specific treatment of partial-availability or tentative-vs-confirmed states (e.g. "diagonally split corners") from public content — **[gap, unconfirmed]**; do not cite Ganttic as precedent for our assumed/confirmed visual distinction specifically, only for the general resource-lane grid shape.

### Calendly / Cal.com-style availability pickers
Source: [Calendly's scheduling page UI](https://calendly.com/blog/new-scheduling-page-ui), [SaaS Calendar & Scheduling UX: Examples & Patterns](https://www.saasui.design/blog/saas-calendar-scheduling-ux-patterns).
- Core discipline: **the booking page hides the owner's full calendar and exposes only bookable slots** — the guest never sees "why" a slot is blocked, only that it is or isn't available. Calendly's redesign moved to showing **month view and day/time slots on one screen together** rather than a click-through wizard, reducing the picker to fewer total taps.
- Timezone auto-detection and multi-calendar double-booking prevention are table-stakes for this genre — **[inference]** relevant mainly as the bar for "availability that's obviously trustworthy," not a pattern we're missing.

### Court/space booking-specific tools: CourtReserve, PlayByPoint (tennis/pickleball/padel clubs)
Sources: [CourtReserve Features](https://courtreserve.com/features/), [PlayByPoint booking basics](https://help.playbypoint.com/en/articles/11412867-court-reservation-basics), [10 Features Defining Modern Tennis Software](https://www.playbypoint.com/blog/10-features-defining-modern-tennis-software/).
- Both support **tiered booking windows by member type** (e.g., members book 14 days out, non-members 3) and **configurable time-slot granularity per venue** (30 min vs. 60 min) — the member-tiering idea doesn't map to us, but per-venue slot granularity reinforces the Exposure/SportsEngine finding that per-venue time increments are a recurring, expected feature across this whole category, not an edge case.
- **Dynamic waitlists** that auto-notify and auto-book the next interested party on a cancellation is a pattern with no direct equivalent in any youth-league scheduler researched — **[inference]** potentially relevant to our "confirmed booking falls through" recovery flow, though none of the sports-league-specific tools above appear to have adopted it, so it may not transfer cleanly to a season-long block-booking context (it's built for single-slot drop-in reservations, not multi-week rental blocks).
- Lobby/walk-up view (shows current + upcoming court occupancy to a person physically standing there) has no clear analog in a season-planning tool and is called out here only to explicitly rule it out as irrelevant to our surface. **[inference]**

---

## Synthesis — recommendations for OUR board / tray / ask sheet / availability surfaces

1. **Grey out illegal drop targets live, during the drag** — not just after drop. SportsEngine's drag/drop tool pre-computes conflicting slots and blacks them out before you can drop a game into them ([source](https://tourney-help.sportsengine.com/en/articles/8225721-how-to-use-the-drag-drop-tool-to-schedule-games)). Apply this to venue-tray drags onto rental blocks and to direct board drags: as soon as a drag starts, grey/disable any gym-hour or weekend cell that would violate a hard constraint (double-booked court, wrong grade's home gym, blackout date), rather than allowing the drop and then flagging an error.

2. **Give board-level violations a loud, distinct error treatment, not a subtle badge** — SportsEngine's "black box, red font" for games left in a bad state is a deliberately jarring departure from normal card styling ([source](https://tourney-help.sportsengine.com/en/articles/8225721-how-to-use-the-drag-drop-tool-to-schedule-games)). A weekend card that's over-capacity on its rental block, or a grade chip sitting on a gym it doesn't belong to, should look visibly "broken," not just carry a small warning dot — reserve the subtle-badge treatment for soft/advisory issues only.

3. **Keep the fairness/capacity audit inside the board itself, not a separate report.** Diamond Scheduler's grid doubles as both the edit surface and the distribution-audit surface (opponent variety, game counts) in one view ([source](https://www.capterra.com/p/178117/Diamond-Scheduler/)). Our weekend cards already show "needs 3 courts · 18 games" — extend that instinct so capacity/utilization signals live directly on cards and in the tray, not behind a separate analytics screen a planner has to leave the board to check.

4. **Treat the venue tray's items as a genuine unscheduled-work queue, matching Exposure Events' "unscheduled games" list that feeds their grid via drag** ([source](https://support.exposureevents.com/hc/en-us/articles/115001946987-Event-Setup-Scheduling-Publishing)). This is direct validation from the tool NPH already uses day-to-day — keep the tray-to-board drag interaction close to this shape (list of not-yet-placed things → drag onto a grid target) so NPH admins moving between Exposure and our planner don't have to relearn the core motion.

5. **Give every rental block / venue assignment two edit paths: drag AND a form-based "Edit" affordance**, per TeamLinkt's pattern of click-Edit-or-drag being equally first-class ([source](https://help.teamlinkt.com/en/articles/4938679-create-a-schedule-with-the-schedule-builder)). Precision assignment (typing an exact court/time for a rental block from the ask sheet after a phone confirmation) shouldn't require fighting a drag interaction designed for the common case.

6. **Support genuinely different time granularity per gym inside one grid**, confirmed as a recurring, load-bearing feature across Exposure Events, SportsEngine, and CourtReserve/PlayByPoint (per-court/per-venue slot length, forced to a shared minimum increment) ([sources](https://support.exposureevents.com/hc/en-us/articles/360001128213-Venue-troubleshooting), [SportsEngine](https://tourney-help.sportsengine.com/en/articles/8225322-how-to-use-multiple-schedule-increments-in-drag-drop-scheduling)). Confirms our per-gym hours range is on-pattern; make sure the availability grid can express a rental venue with, say, 40-minute slots alongside a home gym with 60-minute slots without forcing one to distort the other.

7. **Use color-by-category as the primary at-a-glance grid encoding — validated twice independently** (LeagueLobster: color-by-division; Ganttic: color-by-resource row) ([sources](https://help.leaguelobster.com/en/articles/477173-pro-features), [Ganttic](https://www.ganttic.com/blog/resource-calendar)). Our grade-chips-colored-by-gym is squarely on this well-trodden ground — don't second-guess it as a novel risk; if anything, lean further into it as the primary scan mechanism for the board.

8. **Adopt "placeholder before occupant is known" as an explicit, named state**, per GameChanger's TBD/placeholder games ([source](https://help.gc.com/hc/en-us/articles/23530203776141-Scheduling-Placeholder-TBD-Games-in-GC-Leagues-Tournaments)) and Exposure's unscheduled-games list. Our rental block ("needs 3 courts · 18 games") is exactly this pattern — worth explicitly designing its "half-assigned" states (2 of 3 courts confirmed) with the same visual seriousness as a fully-unassigned block, since competitors treat the placeholder-to-filled transition as a first-class lifecycle, not just an empty/full binary.

### Patterns nobody else has (our differentiators — do not dilute)

- **Cost-aware home-gym-first packing.** No competitor researched exhibits an explicit "home venue fills first, spill becomes rental" concept as a *visual/board* pattern — Diamond Scheduler has a "designated home venue" *constraint* in its solver, but nothing found presents it as a board-level packing story the way ours does (home gym fills, overflow visibly becomes a priced rental block). This is real differentiation, not just a feature gap in what we found.
- **The dateless ask sheet.** Nothing researched separates "court-hours we need to go find" from "court-hours we've scheduled" as a distinct artifact meant for a phone call to a facility. Every tool here assumes the venue and its hours already exist in the system before scheduling starts (Exposure, SportsEngine, LeagueApps Facilities all model venues as pre-existing bookable objects). A dateless, aggregate "we need 3 courts × 18 hours, somewhere" sheet designed to drive an outbound booking conversation appears to be genuinely novel among the tools surveyed.
- **Assumed vs. confirmed booking-status lifecycle on the grid itself.** Skedda/Ganttic hint at generic available/allocated color coding, and none of the sports-specific tools surfaced any tentative-vs-confirmed distinction at all (their venues are binary: in the system or not). A visible assumed→confirmed state machine per gym-per-weekend, on the same grid used for planning, was not found anywhere else in this research.
- **Solver AND drag-drop AND a one-tap suggestion rail as three cooperating tiers.** Competitors offer at most two tiers (manual grid + optional autoscheduler, e.g. Exposure, SportsEngine, LeagueLobster). A dedicated suggestion rail that proposes specific one-tap fixes for constraint violations — sitting between "fully automated" and "fully manual" — was not observed as a distinct third tier in any tool researched.

---

*Research method: WebSearch + WebFetch against public marketing pages, help-center articles, and review aggregators (Capterra/G2) in August 2026. No accounts created, no paywalled content accessed. Several help-center domains (support.exposureevents.com, support.leagueapps.com) blocked direct WebFetch (403); those findings are sourced via search-engine snippet extraction instead of full-page fetch and are marked accordingly by citing the search-indexed article title/URL. Playeasy and ScheduleWerks had materially thin public documentation — findings for both are marked as gaps rather than inferred.*
