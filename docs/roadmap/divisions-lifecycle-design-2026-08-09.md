# Divisions, Scheduling & Playoffs — full-system design
**2026-08-09 · owner-ordered step-back ("take a step back, do the design for the entire system. I don't want broken UI... I need a full plan and full design.")**

Status: **PLAN FINAL (2026-08-09)** — all owner calls answered; build starts on the owner's explicit go. Owner rulings folded in: equal pools only · demo world resets to no divisions · divisions free until schedule publish, then locked (new teams join existing divisions) · regular-season cross-play is a YES/NO per grade (NO=fenced, YES=NPH-style lean) · playoff default = ONE championship per grade, merged seeding · v1 includes the "division-first opening round" pairing flavor · whole-platform polish sweep is the next arc.

---

## 1. The product story (one timeline, no guessing)

| Phase | Surface | Divisions state | What the operator does |
|---|---|---|---|
| League creation | Create league | **none** | Names grades only (Grade 7…12, Junior Girls). Division is not a word on this screen. |
| Registration | Teams tab | **none visible** | Teams register into a grade. (Internally each grade is one container row; the UI never calls it a division.) |
| Planning | Plan Your Season | **none** | Gyms, weekends, capacity. "Planning is how many gyms to get." |
| **Scheduling gate** | Schedule tab (first entry) | — | A deliberate threshold: "You're about to build the real schedule" — registration closed, team counts final. THIS is where division questions are asked, never earlier. |
| **Scheduling setup** | Schedule tab → Divisions card | **created here, once** | "Create divisions for teams": pick grades, name divisions, deal randomly or drag-and-drop, answer ONE question — do divisions cross-play in the regular season, yes or no. |
| Regular season | Schedule tab | input | Engine consumes divisions + cross-division setting (LOCKED / PREFER / OPEN). |
| **Playoffs** | Playoffs tab | input | Independent event at season end. Takes divisions + final standings (tiebreakers predefined under Settings › Rules). Minimal questions per grade: who qualifies, guaranteed games, weekend, pooling (one championship vs a bracket per division), Advanced (format, 3rd place). Bracket \| Schedule views. |

**Law: initial setup happens once per grade.** After that, every entry point is *manage*, which never re-asks setup questions.

## 2. The Divisions card — two states, no overlap

### State A — grade not split yet (new league)
One **Set up divisions** button on the card opens the approved initial-setup flow, which lists ONLY unsplit grades: checkbox the grades to set up, then walk them one at a time (owner: "we should be seeing which [grades] they want to set up their divisions for and then we should let them step by step walk through it").
- Per grade: **shape** (how many — buttons, not dropdowns; names) → **placement choice** (Deal randomly / I'll place them myself) → **drag board** → **one question: "Do divisions play each other in the regular season?" YES / NO** (two option cards; NO = fenced, YES = the NPH-style lean) → create → next grade.
- Initial setup NEVER shows a grade that is already split — that's Manage's job.
- Eligibility: any grade with ≥6 teams appears (a small grade can still want two tiers of 4); the sentence nudges only the big ones.

### State B — grade already split
Row per split grade: `Grade 10 — ARETE (11) · DMV CHILL (11) · GAME SPEAKS (10) · PRIME (10)   [Manage]`
- **Manage opens the management box for that grade directly** — no checkboxes, no wizard, no re-setup:
  - the same drag board, seeded with today's divisions;
  - rename inline (pencil on each column header);
  - add/remove a division (with the ≥2-teams guard);
  - the cross-play YES/NO shown with its CURRENT value;
  - "Merge back to one group" tucked at the bottom.
  - Save applies the delta; nothing else is touched.

The card itself always reads as a list of grade rows (one line each) — current state visible at a glance, one labeled action per row ([Manage] beside each split grade), plus the single [Set up divisions] button while unsplit eligible grades remain.

### Guard — divisions change after games exist
If the grade already has drafted or published games, both Manage-save and setup-create show a plain-words warning line ("Grade 10 has 110 scheduled games — creating divisions changes who plays whom; regenerate the schedule after saving") and the Schedule tab surfaces a "regenerate to catch up" banner until the operator presses the one generate button. Nothing regenerates silently.

## 3. Visual design — kill white-on-white

Rules applied to this flow now and adopted platform-wide in the polish sweep:
- **Every container contrasts with its parent.** Dialog card `bg-white` on `bg-black/40` overlay; INSIDE the dialog all zones are tinted: board columns `bg-ink-50` with `border-ink-200`, chips stay white with `border-ink-200 + shadow-sm` so they pop against the tinted column; pool is dashed `border-ink-300 bg-ink-50` with a "drag teams here" hint when empty.
- **Division identity color**: each division column gets a small colored dot + tinted header strip from a fixed 4-color cycle (play/court/gold/hoop pastels) — the same dot appears later in Team Check chips and playoff cards, so divisions are recognizable everywhere.
- **Selected option cards**: `border-play-600 bg-play-50`; unselected `bg-ink-50 border-ink-200` (never plain white on white).
- **Dialogs**: always portaled to body, top-anchored (`items-start`, ~6vh), internal scroll; the fe910b7 containing-block lesson is now a hard rule.
- **Buttons**: one primary per view; secondary = tinted, never white-on-white.

## 4. Demo world fix (the root of today's confusion)

The pre-season Showcase world was seeded WITH 4 divisions per big grade — that contradicts the story ("this season hasn't started yet so I don't know why teams are already in divisions").
- **Proposal**: collapse the pre-season world's grades to one group each (teams kept, schedule regenerated whole-grade). The owner then DEMOS the creation flow live — split Grade 10, deal, drag, create, regenerate.
- The **End-of-Season twin keeps** its 4-division structure with real names (ARETE/DMV CHILL/…) — it represents a season where divisions were created at setup and played out; it showcases standings, per-division playoff pooling, and the bracket view.
- Seeder change so every future reset behaves this way.

## 4b-i. NPH 2025-26 deep forensics (owner-ordered, 2026-08-09 — from the saved live-stats API dumps, all four grades decomposed)

**Regular season — who really played whom (finished games):**
| Grade | Teams | Tags | Same-division games | Big-tag intra share | Small-tag intra share |
|---|---|---|---|---|---|
| 9 | 26 | ARETE 9 · PRIME 7 · untagged 10 | 36% | 44% (ARETE) | 32-37% |
| 10 | 43 | ARETE/PRIME/GS 10 each · DMV 4 · untagged 9 | 44% | PRIME 62 · ARETE 54 · GS 50% | DMV(4) 20% · untagged 13% |
| 11 | 25 | DMV 9 · ARETE 7 · untagged 9 | 42% | 43-48% | 36% |
| 12 | 27 | ARETE 10 · DMV 8 · untagged 8 (+1 GS) | 50% | ARETE 64% | untagged 26% |

- **Every grade is ONE connected scheduling pool** — zero grades partition into isolated groups. No division is fenced.
- **Big divisions (~10 teams) lean heavily inward (50-64% of their games); small/uneven ones cross freely** (Grade 10's 4-team DMV CHILL: only 20% intra). This is exactly the owner's son's read: sponsor labels, small groups stick together only when they're big enough to sustain it, uneven ones are let loose — and the "hybrid 9-vs-3 division" never happens because NPH pools instead.
- Our engine's PREFER produced a 66% same-division lean in verification — statistically the same shape as NPH's big-tag behavior. **UI mapping: the owner's simple YES/NO cross-play question → NO = LOCKED, YES = PREFER (evidence-backed lean, small divisions naturally cross more). OPEN retires from the UI (stays as an engine mode).**

**Playoffs — pairings BY ROUND (2 dates per grade, everybody-in + 2-game guarantee):**
| Grade | Day 1 same-division | Day 2 same-division |
|---|---|---|
| 9 | 7/15 | 4/9 |
| 10 | 15/29 (ARETE-ARETE 4, PRIME-PRIME 6, GS-GS 5) | 7/15 |
| 11 | 8/14 | 4/11 |
| 12 | 6/13 | 3/8 |
- **Day 1 is division-flavored for the big divisions** (Grade 10's three 10-team tags opened almost entirely against themselves), **day 2 opens up** — finals cross divisions. No grade ran hard-fenced division brackets; winners DO meet across divisions.
- So NPH's playoff model = ONE championship per grade, merged seeding, with a same-division flavor in the opening round. Our pooling=GRADE reproduces the merged championship; an optional "open round pairs within division where possible" flavor would reproduce day 1 exactly (recorded as a future format variant, not v1).

## 4b-ii. What the other circuits do (research, 2026-08-09)
- **Nike EYBL** (national circuit): an age group's ~30 teams split into 4 parallel pools (8/8/8/6); sessions across cities; **combined overall standings** seed the championship (Peach Jam). = equal-pools semantics, merged seeding — exactly the NPH model we built (pooling GRADE).
- **OBA / Ontario Basketball League**: four ABILITY divisions (OBLX/AAA/AA/A); teams PLACED by caliber (rankings use head-to-head, margins, strength of schedule); championships run within the tier (Division 1 → Provincials, Division 2+ → Ontario Cup). = strength-tier semantics: seeded placement, tier-locked play, per-tier playoffs.
- **NPA/OSBA** (prep leagues): single table per age, no divisions — the trivial case.
Implication: divisions need a declared SEMANTIC ("equal pools" vs "strength tiers" vs "geographic") because it changes dealing (random vs seeded vs regional), default cross-division play, and default playoff pooling (tiers never pool). v1 ships what the owner picks; the model already stores the general shape.

## 5. Playoffs (final)
- Independent of regular scheduling; runs at season end from divisions + final standings (tiebreakers predefined in Settings › Rules).
- **Default for a split grade: ONE championship, merged seeding** (the proven NPH model) — pooling toggle to "a bracket per division" stays available per grade.
- **v1 ships the "division-first opening round" flavor** (owner call): an Advanced option — "Opening round: natural seeding | pair within divisions where possible" — reproducing NPH's real day 1; later rounds cross as the bracket narrows.
- Config order on the card (the owner's "most logical order"): who makes it → games guaranteed → which weekend → brackets (pooling) → Advanced (format · opening-round pairing · 3rd place).
- Same visual rules (tinted cards, division dots). Pre-season league's Playoffs tab shows a calm "planned once the season is underway" state — no config noise before it's real.
- Recorded for later: division brackets + crossover final; 24-25 bye-gauntlet (double-QF) variant.

## 6. Build plan (one fully-baked pass, on the owner's go)
1. Divisions card rework: split-grade rows each with [Manage]; single [Set up divisions] for unsplit eligible grades; publish-lock state ("divisions lock once the schedule is published — new teams join an existing division").
2. Setup flow: lists ONLY unsplit grades; per-grade shape → placement → drag board → the ONE yes/no cross-play question (two option cards). Engine mapping NO=LOCKED, YES=PREFER; OPEN retired from UI.
3. Manage box: direct per-grade board seeded with today's divisions, inline rename, add/remove division, current yes/no shown, merge at the bottom; pre-publish saves prompt regenerate via banner, post-publish read-only.
4. Scheduling gate: entering Schedule pre-generation states plainly that the real schedule is about to be built and points at division setup first.
5. Playoffs: default stays merged championship; build the division-first opening-round pairing option (playoffs.ts + config field + Advanced UI); pre-season calm state; pooling toggle stays on the Playoffs tab.
6. Visual pass: tinted zones, white chips on tinted columns, division identity dots, no white-on-white anywhere in these flows.
7. Demo worlds: seeder emits one group per grade (no divisions) for the pre-season world; twin seeder splits grades itself with the real NPH names so the end-of-season showcase survives resets; collapse + regenerate the live pre-season worlds.
8. Gates: tsc/eslint · scheduler-v2 units (+ new pairing tests) · extended drive (setup, manage, rename, merge, lock state, yes/no persistence, playoff pairing flavor) · screenshots both worlds.

## 7. Demo-polish sweep (the next arc, scope = owner's pick)
Owner: "I really want to start focusing on polishing up the whole UI, now the whole platform, and get ready for a demo."
- Option 1 — **demo path first**: the 8 console tabs + plan wizard + the public pages the demo runbook touches; contrast/empty-state/dialog-consistency sweep with screenshots per surface.
- Option 2 — whole-platform sweep (bigger; staged by route group).
Either way the §3 visual rules are the checklist, ui-ux-pro-max consulted per surface.

## 8. Later (recorded, not in this pass)
Strength-aware dealing · bye-gauntlet format · staged publish/publishedAt pinning · schedule-tab legacy buttons kill-list · weekend rhythm config · register-into-grade entry point.
