# Owner scratchpad — ideas & gaps from test-driving

The owner's scrapboard: anything noticed while browsing gets written down
here so it isn't forgotten. DISCUSSION-FIRST — capture now, decide together
later, then schedule into a fix batch. Distinct from the machine audit
ledger (docs/ux-audit-2026-07-06.md); cross-reference when they overlap.

Format: `OB-###` · date found · where · what · decision needed · status.

---

## OB-001 · 2026-07-06 · /club/[slug] · Public team counts / club-page visibility

**Found:** the public club page shows how many teams a club has (and lists
them). Not every club wants to advertise its size or structure.

**Discussion needed:** should clubs control what their public page exposes?
Options to weigh when we take this up:
- Per-club "public page settings" (show/hide: team count, team list, staff
  count, programs) — likely a `TenantFeatures`-style toggle set, editable in
  club settings, defaulting to visible.
- Or a simpler platform-wide policy (e.g. never show counts, always show
  team names).
- Interacts with UNCLAIMED clubs: nobody exists to choose settings for the
  188 imported clubs — what's the right default for them?

**Status:** open — needs owner decision on approach.

## OB-002 · 2026-07-06 · /club/[slug] · "Claim This Club" — verification flow unclear

**Found:** the claim button exists but the owner doesn't know how claiming
is verified or whether it is trustworthy.

**What exists today (for the discussion):** a full flow is already built —
claim request → 6-digit verification code emailed to the club's on-file
`contactEmail` (imported with the 188 real clubs) → claimant enters the code
→ status `EMAIL_VERIFIED` → **platform admin reviews and approves/rejects**
at /dashboard/admin/claims (with optional message from the claimant and
admin review notes). If a club has no contact email on file the claim parks
as `PENDING` for manual handling.

**Discussion needed:**
- Is email-code + admin approval sufficient proof of ownership? (Risk: the
  imported contactEmail may be stale/generic info@; whoever reads that inbox
  can claim.)
- What documentation should the manual `PENDING` path require (no contact
  email on file) — incorporation papers, website admin proof, phone call?
- Who is "the admin" operationally once real clubs start claiming, and what
  SLA/notification do they get on new claims?
- The claim CTA also appears for logged-out visitors → sends to /clubs/find;
  is that the intended entry point?

**Status:** open — flow exists; owner to validate the trust model.

---

## OB-003 · 2026-07-06 · public navigation · What comes after "Leagues"?

**Found:** Leagues as top navigation works, but the drill-down below it is
undecided: after picking a league, should the next level be CLUBS, or AGE
GROUPS / DIVISIONS, before you reach teams? Complication: one club can field
a team in every age grade of the same league, so "browse by club" and
"browse by division" are different slices of the same teams.

**Discussion needed (when we take it up):**
- League hub currently groups teams BY DIVISION with the club named on each
  team row — is division-first the right primary axis (it matches how
  schedules/standings work), with club pages as the cross-cut?
- Should the league hub gain a club filter/rollup ("416 United — 3 teams in
  this league")?
- Does age-group belong in the global nav at all (e.g. U14 landing pages
  across leagues), or only inside a league?

**Status:** open — owner to decide the browse hierarchy.

---

## OB-004 · 2026-07-06 · /league/[id] + /league/[id]/leaders · Stat leaders mix divisions and genders

**Found:** the league hub's "Scoring leaders" card and the full leaders board
rank ALL players in the season together — U12 boys against U16 boys against
U14 girls. Not acceptable: leaders must be comparable cohorts.

**Current behavior (for the discussion):** the leaders engine computes one
board per season across every division; the eligibility rule (≥50% of team
games) is division-blind too. Division data exists (each team submission has
a division carrying age group + gender), so per-division boards are a
straightforward change to the assembly layer.

**Decision needed:**
- Default grouping: per DIVISION (encodes age + gender — likely right), or
  per age group with gender split?
- The homepage leaders rail features one board — which division gets that
  spotlight (biggest? rotating? viewer's own division when signed in)?
- The hub sidebar "Scoring leaders" top-3: per division tabs, or the
  featured division only?

**Status:** open — likely a fix batch item once grouping is decided.

---

_Add new items above this line as OB-005, OB-006, …_
