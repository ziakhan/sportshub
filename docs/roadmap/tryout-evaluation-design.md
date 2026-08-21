---
updated: 2026-08-21
tags: [theme/product, type/spec, status/proposed]
---

# Tryout evaluation: design

The planning session [[club-tryouts-and-age-pools]] deferred. Research behind
it: [[tryout-evaluation-2026-08]]. **Proposed, not approved, not built.**

Builds on `TryoutEvent` and `TryoutPoolMember`, which landed 2026-08-21. A
`TryoutPoolMember` is the row an evaluation hangs off, so identity, age group,
season and club scoping are already solved.

---

## 1. Visibility is a club setting, not a platform rule

Owner ruling, 2026-08-21: how open this is **depends on the club and how
honestly they run things**. Some clubs will want everything visible; some
need it sealed. The platform offers the choice and takes no position, which
is the same posture as ruling 6 on assignment authority.

**Club-level policy, per age group pool:**

| Mode | Evaluators see | Director sees |
|---|---|---|
| **`PRIVATE`** (default) | Only their own ratings | Everything, attributed |
| **`AGGREGATE`** | The consolidated report: counts, averages, spread. **Not who gave what** | Everything, attributed |
| **`OPEN`** | Everything, attributed | Everything, attributed |

**Per-item override, always available to the author.** Whatever the club
setting, an evaluator may mark any individual rating or note private. Notes
are private by default and widen only by explicit action, per the original
ruling. A rating marked private still **counts in the aggregate** but its
attribution never surfaces to peers.

That combination is what the owner asked for: a club dial, plus a personal
escape hatch that no club setting can override.

---

## 2. The integrity problem, stated plainly

The owner's observation, and it is the sharpest thing in this design:

> Coaches already know who gets to pick first. Some may not evaluate honestly
> because of it.

A coach who wants a player can under-rate them so others pass. A coach who
wants a player gone can over-rate them. This is not hypothetical and no
amount of maths detects intent.

**Three controls, cheapest first.**

**1. Blind until submitted.** Regardless of club policy, an evaluator cannot
see anyone else's score for a player until they have entered their own. This
is the single most effective control here and it costs almost nothing. It
kills anchoring, and it means a coach cannot see where the consensus is
before deciding what to file against it.

**2. Attribution always survives to the director.** Even in `AGGREGATE`, the
director sees who scored what. Anonymity to peers, never to the person
accountable for the decision.

**3. Deviation surfacing, to the director only.** See §4 for the limit of
this. The product **surfaces**, it never accuses.

---

## 3. The consolidated report, per candidate

What the owner asked to see, per player:

```
#14  Malik Osei                          Grade 11 pool

  Ratings          4 evaluators              ← coverage
  Overall          3.8  (adjusted 3.6)       ← weighted, normalised
  Spread           2 – 5                     ⚠ evaluators disagree

  Shooting         4.3   ████████░░
  Ball handling    3.5   ███████░░░
  Defense          4.0   ████████░░
  ...

  Raw scores       Coach A 4.2 · Coach B 2.1 · Coach C 4.4 · Coach D 4.0
                   (attribution shown per club policy)
```

Four numbers carry it:

- **Count.** How many evaluators actually saw this kid. **Fewer than two is
  a low-confidence flag**, not a score.
- **Overall.** Weighted across categories.
- **Adjusted.** Normalised across evaluators, see §4.
- **Spread.** Where coaches disagree. This is a feature of the report, not
  noise to be averaged away. Wide spread means look again.

The pool ranking is this report, sorted, feeding the existing pool console.

---

## 4. The maths, and its honest limit

**The problem.** With 60 kids and 4 coaches, not every coach sees every kid.
Each player's average is taken over a different set of evaluators. One coach
runs generous, another runs hard. A kid scored by the generous one outranks a
better kid scored by the hard one, and the table looks authoritative while
being wrong.

**The fix.** Normalise each evaluator against their own mean and spread
before combining, then average. Show **both** raw and adjusted: coaches will
not trust an adjusted number whose working they cannot see.

**The limit, which must be written down.** Normalisation corrects *systematic*
generosity or harshness. **It does not correct targeted sandbagging**, which
is precisely the behaviour the owner described. A coach who scores everyone
fairly except the one player they want has a normal mean and a normal spread,
and the adjustment leaves their sabotage untouched.

**What does detect it:** per-evaluator deviation from group consensus, **per
player**. Systematic bias is a constant offset across all their players.
Targeted scoring is a large deviation on one or two players and none
elsewhere. That shape is visible:

```
Coach B vs consensus:  +0.1  +0.2  −0.1  0.0  −2.3  +0.1
                                              ↑ look here
```

Surface it to the director. Never to peers, never as an accusation, and never
automatically excluded from the average. A coach may simply have seen
something the others missed, and that is the whole reason multiple evaluators
exist.

---

## 5. Data model

```
EvaluationTemplate      per club, per age group
  categories[]          name, weight, anchored 1-5 descriptions
  measurables[]         name, unit, direction (lower/higher better)

EvaluationSession       ties a template to a TryoutEvent session
  visibility            PRIVATE | AGGREGATE | OPEN
  evaluators[]          club staff assigned to score

Rating                  the atom
  poolMemberId          → TryoutPoolMember
  evaluatorId, categoryId, score 1-5
  isPrivate             author's override
  submittedAt           blind-until-submitted gate

Measurement             objective, no judgement
  poolMemberId, name, value, recordedBy

EvaluationNote
  poolMemberId, authorId, body
  audience              PRIVATE (default) | TEAM_STAFF | CLUB
```

Every raw `Rating` is kept. Averages are computed, never stored, so the
working is always inspectable.

---

## 6. Phasing

1. **Measurables.** Objective, no rubric needed, cheapest, immediately useful.
2. **Templates with anchors + rating capture.** Pinnie number first, one
   thumb, offline queue. Ship one strong basketball template, not a builder.
3. **Consolidated report + pool ranking**, with count, spread and adjusted
   score.
4. **Visibility modes + per-item override.**
5. **Deviation surfacing** to the director.
6. **The calibration loop** — tryout rating against actual season stats.
   Later, and the thing no competitor can copy.

---

## 7. Still open

- Does a family ever see any of this? Strong retention feature, real support
  burden.
- In-season re-evaluation, or tryouts only? The first is a development
  product and a much bigger build.
- Who writes the anchors? Basketball expertise, not engineering, and the
  difference between a rubric that consolidates and one that produces
  confident nonsense.
