# League Console IA Redesign — the honest audit (2026-07-30)

> Owner verdict on the current console: "honestly this is getting messy… settings should be in one place… Games is not a clear tab… standings don't belong under games… naming is inconsistent… people should never enter things that will be duplicated."
> Status: **PROPOSAL — nothing built.** This is the blueprint for the fresh session. Companion state: memory file `project_league_ops_2026_07_29.md`.

## 0. Why it got messy (honest diagnosis)
The 12 tabs accreted one per feature as features shipped. The five section headers added 2026-07-29 were a *grouping of what existed*, not a design: "Games" is a junk-drawer label; settings ended up in THREE places (Registration›Settings, Playoffs›eligibility, Scheduling›game-day policies) because each rule was parked "near its feature"; Standings sat under Games because data-wise standings derive from games — but a commissioner experiences standings as an *output to monitor*, not a place to work. The root mistake: organizing by DATA TYPE instead of by the operator's JOB and the season's PHASE.

## 1. The organizing principle
A season is a pipeline: **Set up → Open registration → Review & approve → Close → Schedule → Play → Playoffs → Wrap up.** The commissioner's question at any moment is "what do I do next, and what's blocking me?" So:
- **Work surfaces** (places you DO things) get tabs.
- **Settings** (things you decide once) live in ONE place, sectioned.
- **Outputs** (standings, reports) are views, clearly separated from work.
- **Every gated action shows its unlock path** ("Generate schedule — blocked: registration still open; 1 team pending review").

## 2. Proposed structure (5 tabs, one Settings home)

| Tab | Contents | Notes |
|---|---|---|
| **Overview** | Needs-attention + Season report (exist) + **NEW Season checklist** (§3) | The "what next" home |
| **Registration** | Clubs (entries) · Teams (applications) | Pure work surface — settings moved out |
| **Schedule** | Sessions & venues · Capacity planner · Generate & review | Rename of "Games"; sessions/venues MOVE here — they exist only to feed scheduling. Capacity math explained inline (§5) |
| **Standings & playoffs** | Standings (view) · Playoff brackets (work) | Outputs + post-season ops together; playoff *settings* move to Settings |
| **Referees** | pool, shifts, settlements | unchanged |
| **⚙ Settings** (single page, anchored sections) | **Basics** (label, dates, deadline, fee, deposit %) · **Registration** (application questions, club agreement pointer, planned-teams policy) · **Game format** (periods, lengths, slot width) · **Rules** (playoff min-games, guest players, roster-change policy, tiebreakers) · **Divisions** (structure — see §4) | Everything decidable-in-advance in ONE scrollable place with helper text. Divisions arguably setup-not-settings; keeping the editor here ends the "where do I configure X" hunt |

Migration is cheap: tabs are keys in one client page; `?tab=` deep links get a redirect map.

## 3. The Season checklist (mistake-proofing engine)
An ordered, always-visible list on Overview; each step = done ✓ / actionable → / **blocked (with the reason and a link to the unblocking step)**. Derived from data, no stored state:
1. **Season basics set** — dates, fee, deposit. Blocked-by: nothing.
2. **Divisions created** — ≥1 division. 
3. **Venues allocated & sessions built** — every session day has a venue with courts.
4. **Registration configured** — questions + club agreement (optional but nudged).
5. **Registration OPENED** — action lives here (status change w/ confirm).
6. **Clubs & teams reviewed** — 0 pending entries/applications; fees tracked.
7. **Registration CLOSED** — blocked while pending applications exist (today this is silently allowed → becomes a hard gate with an override).
8. **Schedule generated** — blocked until: closed + every division ≥2 teams + capacity ≥ required (planner numbers shown right here).
9. **Season FINALIZED / underway** — existing preflight becomes this step's detail view.
10. **Playoffs** — blocked until eligibility data exists (games played).
The existing finalize-preflight already computes half of this; the checklist is its generalization and becomes the ONLY place status-advance buttons live (fixes "Close Registration floating in the header, one click from disaster").

## 4. Naming strategy — DERIVED, NEVER TYPED (owner ruling)
**Rule: humans pick structure; the system composes every name. Nobody types "Burlington Force U19" anywhere.**
- **Divisions:** identity = `ageGroup` (picker: U9–U19 / Grade N) + `gender` + `tier` (int). Display name is ALWAYS composed: "U15 Boys · Tier 1". The free-text `name` field goes read-only/derived (kept in DB for legacy rows; editor stops offering it). Fixes "sometimes Tier 1 is in the name, sometimes a dropdown."
- **Teams (club side):** club creates a team by picking ageGroup (+gender). Display name = `{Club shortName} {ageGroup}` — "Burlington Force U15". Club sets `shortName` ONCE on club settings (default: club name). Multiple teams in one bracket → auto-suffix picker (Blue/White/Black or 1/2) — still a pick, not typing. `Team.name` becomes derived; DB column stays (filled by composer) so nothing downstream breaks; legacy names shown until a club touches the team.
- **Season entries/submissions:** division placement is structured pickers only (already true).
- **Why it matters:** kills duplicates/typos, makes standings/schedules read uniformly, and lets NPH trust cross-club sorting.
Schema: `Tenant.shortName String?`, `Team.nameSuffix String?`; composer in `lib/teams/naming.ts` used by every create/edit surface + backfill script.

## 5. Fix list from this owner pass (concrete defects)
1. **Venues not clickable/editable in season setup** — season venue rows: click → edit allocation (courts available, per-season hours) + link to the global venue page. Today they're inert text. 
2. **Division editor only edits free-text name** — replace with structured editor per §4 (age/gender/tier/maxTeams); name display derived.
3. **Schedule tab confusion** — add the capacity planner summary AT THE TOP in words: "You need N game slots (T teams × G games ÷ 2). Sessions currently provide M. ✓/✗" with per-session breakdown, before any generate button.
4. **Settings scattered in 3 places** — collapse per §2.
5. **"Games/Standings" mislabel** — per §2.
6. **Status buttons** — move into checklist context (§3); keep confirms.

## 6. Actions × prerequisites matrix (the "can't make a mistake" contract)
| Action | Requires first | On violation today | Target |
|---|---|---|---|
| Open registration | basics + ≥1 division | allowed silently | checklist gate w/ reason |
| Club enters season | registration OPEN | 409 (ok) | same + friendly page state |
| Approve team | division assigned (or assign-at-approval) | allowed w/o division | approval dialog asks for division inline |
| Close registration | 0 pending apps | silent | gate + "review 2 pending first" link |
| Generate schedule | closed + ≥2 teams/div + capacity OK | preflight 422 list | same checks, shown BEFORE clicking |
| Finalize | schedule exists + preflight | preflight (good) | unchanged, surfaced in checklist |
| Playoffs generate | IN_PROGRESS + standings data | allowed early | gate on games played |
| Renew season | any | fine | unchanged |
| Delete/withdraw anything | — | confirm dialogs (done) | unchanged |

## 7. Sizing (fresh session, suggested order)
1. Settings consolidation + tab rename/regroup + redirect map — **M** (mostly moving existing components).
2. Season checklist on Overview (generalize preflight; move status buttons) — **M**.
3. Derived naming (composer + division editor + team create/edit + shortName/suffix + backfill) — **M-L**, touches club-side too.
4. Venue row editability + capacity words on Schedule tab — **S-M**.
Recommend shipping 1+2 together (the "it finally makes sense" moment), then 3, then 4.
