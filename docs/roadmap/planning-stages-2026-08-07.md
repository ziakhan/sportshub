# Planning stages 0–2 — overnight run 2026-08-07

Owner instruction (before sleeping): "do stages 0, 1, and 2, auto-approve the
plan, and finish everything by morning with no input or actions required by
me. Make any assumptions if you need my input."

Stage 3 (the org tier: org capacity pool, multi-league plans, org↔venue
layer, weekday leagues, cross-org availability) is deliberately NOT here — it
gets its own full design and a branch, per the staging agreed 2026-08-07.

## Assumptions made in the owner's absence (read this first)

1. **"Finish everything" includes the final box deploy and the additive-only
   schema push** — otherwise finishing would require an owner action in the
   morning. One deploy at the end, full receipts in runbook #69, rollback sha
   noted.
2. **Booked-dates on the active plan** (stage 0): chose the REAL picker
   writing through to the season's attachments (capability parity) over an
   explanatory note. Same control, same meaning, honest target.
3. **Sessions panel's new home** (stage 1): season Settings gains a
   "Sessions & rounds" section; the Schedule tab keeps readiness, venues and
   generation. "Maybe under settings" was the owner's own lean.
4. **Rounds are optional structure** — a league that defines none behaves
   exactly as today. No backfill invents rounds nobody asked for; a one-tap
   "group by month" fills them for a league that wants them.
5. **Public surfaces untouched** in stage 1: round names appear on operator
   surfaces (board, settings) only. Public season card adopting round names
   is a follow-up, not an overnight change (parity law: public/native surfaces
   move together, deliberately).
6. **Old scheduler screen stays reachable** in stage 2 until the owner
   verifies the summary-first screen. Reverting is a click, not a rebuild.

## Stage 1 — the session model (one page)

**Concept.** A SESSION is a month-anchored round the league announces
("Session 1 · October", "the January session" — owner naming 2026-08-07). A
WEEKEND is a concrete date a session materializes onto, per grade. Sessions
are announced; weekends are booked. Rounds are OPTIONAL per league.

**Schema (additive only — existing worlds read identically).**
- New table `SessionRound`: `id`, `seasonId`, `ordinal`, `label` (nullable →
  derived "Session N"), `monthAnchor` ("2026-10"). Unique (seasonId, ordinal).
- `SeasonSession.roundId String?` — nullable FK, SetNull on round delete.
- `Season.fridayStartTime String?` / `Season.fridayEndTime String?` — lifts
  the hardcoded 18:00–22:00 Friday window into configuration (NJC/NSC
  constraint). Null = today's defaults. 3-day blocks already work via
  session days; this makes their Friday window honest.

**Surfaces.**
- Settings → new "Sessions & rounds" section: the SessionsTab panel moves
  here from the Schedule tab (playoff toggle comes with it — fixes the
  findability the owner hit); above it, a compact rounds editor: add/rename/
  delete rounds, "Group weekends into rounds by month" one-tap, per-session
  round picker.
- Board month columns: when every weekend in a column shares a round, the
  header reads the round's name instead of derived "Session N".
- API: `GET/POST /api/seasons/[id]/rounds`, `PATCH/DELETE /api/seasons/[id]/
  rounds/[roundId]`; sessions PATCH accepts `roundId`.

**Compat rule.** No round rows → every surface renders exactly as before
(pinned by existing drives). NPH and NJC/NSC both expressible as pure
configuration; a fork for either falsifies the model.

## Stage 2 — the plan→scheduler contract (one page)

**The seam.** The owner ran the generator and got "no venues are assigned":
planning had answered questions the generator re-asks of season substrate
that activation never fully wrote.

**The contract.** After activating a plan, the generator's entire input
exists on the season with no manual re-entry:
- per session it runs: the day rows, each gym attached WITH its court rows
  (count = the plan's courts for that gym-weekend), hours (the plan's
  weekend exception, else the gym's range), bookingStatus carried over;
- grades and games-per-team from the plan's units;
- playoff sessions excluded (already true);
- team schedule requests read where they already live.
Build order: FIRST reproduce the owner's failure on the journey world, then
close the actual gap activation-side (using the same attach helper the
per-session venue API uses), then prove the generator runs unassisted on a
freshly activated plan.

**The screen (140-team scale).** Summary-first: verdict header (teams, games
scheduled vs expected, red-flag teams, issue count) → per-team fairness
counts table (back-to-backs, early starts, late endings, gaps over
threshold, requests violated — every column the old table computed,
collapsed to counts) → click a team for its full schedule to verify. The
old full table stays reachable behind a link until the owner retires it.

## Out of scope tonight (queued for stage 3 design)
Org capacity pool + elastic plan scope + joint multi-league solve ·
org↔venue relationship layer + building-level availability (claims never
lock: only venue-operator truth gates other orgs) · weekday "playing days"
generalization · org settings surface + full cascade provenance UI ·
sessions at org level shared by leagues · public/native round naming.
