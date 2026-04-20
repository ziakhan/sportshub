# Leagues v2 — Design Q&A Transcript

> Captured 2026-04-20. Source conversation where owner and Claude worked through the domain model, scheduling philosophy, and edge cases that produced [league-v2-plan.md](league-v2-plan.md). Preserve this so we never re-litigate these decisions.

---

## Starting context

Owner asked Claude to dump everything it knew about the existing league system (league creation, seasons, divisions, venues, pipeline from club team submissions through approval, finalization, schedule generation) and then produce an end-to-end plan. Claude summarized the current state: one `League` row = one season, divisions + capacity + submissions + roster snapshots + finalization preflight all built; schedule generator is the big missing piece. Then asked four framing questions (schedule format, games-per-team balance, venue-to-session binding, regeneration editability). Owner answered one at a time.

---

## Q1 — Season modeling

**Claude:** Current model collapses league + season into one `League` row. Keep as-is or split?

**Owner:** Enhance it. A league is always going to be static. A league could have a season of 2025-26 or 2026-27, which you can only start in September till March. Leagues could also have a summer season, and then the next year's season. **League should only be one**, and there should be a different ability to define seasons.

**Decision:** Split. `League` = persistent entity (name, owner, description, currency default, stripe). `Season` = child, carries dates, registration deadline, age cutoff, pricing, game-format, scheduling prefs, status lifecycle, divisions, submissions, rosters, sessions, venues, games. Introduce `SeasonType` enum (`FALL_WINTER`, `SUMMER`, `SPRING`, `CUSTOM`).

---

## Q2 — Venues, courts, availability

**Claude:** Current venue has `courts: Int`, `LeagueVenue.courtsAvailable` is an override count. Enough?

**Owner:** Venues are global — across clubs, leagues, everything. Generic definition stays at venue level:
- Number of courts
- Start/end times (weekdays and weekends)
- A general schedule

When a league/club associates a venue (for a session, tournament, house league, tryout), they should be able to **define which courts are available** for that booking — either inherit venue defaults or override availability (not all courts, or some courts).

**Decisions:**
- Venue gets named/numbered `Court` children so bookings can reserve *specific* courts, not just a count.
- Venue gets weekly default hours (`VenueHours` per day of week).
- Every association (`SeasonVenue`, session-day-venue, tryout venue, house-league venue, camp venue, practice) can inherit venue defaults or override courts + hours.

---

## Q3 — Sessions (day/venue/multi-venue flexibility)

**Claude:** Three clarifications:
1. Can one session span multiple venues (Sat at A, Sun at B, or both A+B same day)?
2. Is "session" a grouping/UX concept or semantically meaningful for standings/reporting?
3. When the generator places games, does it fill session-by-session, or treat the whole season as one pool?

**Owner:**
1. **All combinations allowed.** One venue one day + another next day, or both days multiple venues, or one day single + another day multiple. Fully flexible.
2. Mostly a grouping. But teams get a rough "guaranteed games per session" for even load distribution (typically 2–4 per session). Soft target — sometimes a team gets fewer one session and more the next.
3. Primary budget is the season total (e.g., 10 games). Per-session target is a soft hint. Sometimes the season total is even exceeded by 1–2 depending on division size.

**Owner added:** Regular season is typically 4–5 sessions. Most weekends Sat + Sun, but also "just Sunday", or "Fri + Sat + Sun". Tournaments can span arbitrary days incl. weeknights. **Full day flexibility required.**

**Decisions:**
- `LeagueSession` → `SeasonSession`. Drop the single `venueId`.
- Day-level venue binding via new `SeasonSessionDayVenue` (many venues per day).
- Each day-venue has its own courts (`SeasonSessionDayVenueCourt`) + time overrides.
- Add `Season.targetGamesPerSession` (soft per-session target).
- `gamesGuaranteed` is a soft minimum at season level; overshoot of 1–2 per team allowed when forced.

---

## Q4 — Schedule format per division

**Claude:** Strict round-robin? RR + playoffs? Pool play?

**Owner:** It depends. With 15 teams and 10 games you can't play everyone → "some sort of round robin." Within division.

**Playoffs are completely separate.** After regular season ends and standings are set, playoffs have their own scheduling definition — strictly based on team count. Could be top X teams, or everyone in pool play. Different leagues different rules. Playoffs = treat as separate session(s).

**Regular season** = 4–5 sessions typical. Make it flexible.

**Decisions:**
- Regular-season generator = **partial round-robin** (selects subset of pairings when teams × games don't yield full RR).
- Introduce `SessionPhase` enum: `REGULAR` | `PLAYOFF` on sessions (and derivable on games).
- Playoffs are a v2 phase, separate plan.

---

## Q5 — Regeneration / editing philosophy

**Claude:** Once a schedule is generated and season is `IN_PROGRESS`, is it editable? Hard lock or soft?

**Owner:** Everything should be flexible — youth sports, weather happens, teams can't field enough players, sometimes they default and get rescheduled next weekend. **Team managers and league owners can edit individual schedules and cancel games.** If a game is cancelled, maybe next session we give them more games. If a team was defaulted due to weather and the league owner wants to reschedule, we should try to squeeze it into the **next one or two sessions**.

Fully editable even during `IN_PROGRESS`. Nothing hard-locks. Soft lock with unlock is fine.

**Decisions:**
- `Game.isLocked: Boolean` — soft lock, toggleable.
- Game status gains `DEFAULTED`.
- Reschedule-assist tool: when a game is cancelled/defaulted, offer a mini-solver over the next 1–2 sessions showing open slots that respect hard constraints.
- Standings recalculate on any `COMPLETED`/`DEFAULTED` status change.

---

## Q6 — Edge cases (owner-raised)

**Owner:** Small divisions (5 teams) vs big divisions (20 teams). In small you must play each other multiple times. In big you can't play everyone. All cases must work.

**Decisions:**
- Generator fairness heuristic = "prefer pairings not yet seen." When target games > unique pairs possible, cycle through with repeats evenly distributed. When target < unique pairs, sample a subset favoring diversity.

---

## Q7 — Same-day scheduling preferences

**Owner:** Two games on a weekend with multiple venues involved — prefer **not back-to-back** for same team (soft, not hard). Prefer games **close together** (don't put one at 9am and one at 7pm). Goal: team can leave when done. Not hard limits. Sometimes leagues also have team-specific requests (e.g., travel team: no Friday night). Add note of team-availability but don't implement yet.

**Decisions:**
- Soft preference: minimize inter-game gap for a team on a single day.
- Soft preference: avoid back-to-back adjacent slots.
- Placeholder table `SeasonTeamBlackout` — not consumed by v1 solver.

---

## Q8 — Scheduling philosophy (owner-raised)

**Owner:** Maybe we need a league-level preference. Everything I described (cluster, no back-to-backs) is one option. But sometimes leagues **deliberately spread games across days** to drive gate/concession revenue — parents show up twice, pay twice. We should support both. **Don't expose in UI by default.** Hide unless the league "insists," then unlock.

**Decisions:**
- `Season.schedulingPhilosophy` enum: `FAMILY_FRIENDLY` (default, cluster) | `SPREAD_DAYS` (dispersion).
- Not exposed in the standard settings UI.
- Solver flips the cluster/disperse preference based on this flag; other constraints identical.

---

## Q9 — Payment gating / cross-division / tiebreakers

**Claude:** Three remaining clarifications before drafting the plan.

**Owner — Payment:** League approves the team and might handle payment off-platform. Allow approval without payment. Owner can **mark paid** manually (for off-platform receipts) so they can keep accounting in check. Don't enforce payment through the platform.

**Decision:** `PaymentStatus` enum (`UNPAID` | `PAID_MANUAL` | `PAID_STRIPE` | `WAIVED`). Approval is independent of payment.

**Owner — Cross-division scheduling:** Build the feature, but keep divisions separate. Give owner/manager the ability to **virtually combine** multiple divisions **for the purpose of scheduling only** — an opt-in "merge for scheduling" overlay. Standings and rosters still separate.

**Decision:** `SchedulingGroup` model groups divisions. Season flag `allowCrossDivisionScheduling`. Generator treats a group as one pool; standings stay per-division.

**Owner — Tiebreakers:** Define all the standard ones. League owner picks their order before finalizing the season. **Locked at finalization, cannot be edited mid-season.** Can change season-to-season.

**Decision:** `Season.tiebreakerOrder: String[]`, `tiebreakersLockedAt: DateTime`. Standard options: Wins → Win % → Head-to-head → Point differential → Points scored → Points allowed → Coin flip.

---

## Scope confirmation

Plan covers: league + season creation → divisions → venues → sessions → team registration → finalization → regular-season schedule generation + edit/reschedule.

**Explicitly out of scope** (future phases): playoffs generation, public league pages, officials/scorekeeper assignment, live scoring UI, per-team blackouts consumed by generator, Stripe payment flow, schedule-change notifications to club managers / parents.

---

## Outcome

See [league-v2-plan.md](league-v2-plan.md) — 9 phases, suggested execution order = 1 PR per phase with scheduler split across two sub-PRs (inventory+pairing first, solver second).
