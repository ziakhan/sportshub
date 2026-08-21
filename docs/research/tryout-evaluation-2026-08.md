---
updated: 2026-08-21
tags: [theme/research, theme/product, type/analysis, status/first-pass]
---

# Tryout evaluation: how basketball actually does it, and what we should build

Research at the owner's request, 2026-08-21. Nothing here is built or approved.

**Read [[club-tryouts-and-age-pools]] first.** Its rulings are binding and two
of them constrain everything below:

> **Deferred:** Private per-coach notes on pool players. Every coach keeps
> their own notes; **never visible to other coaches**. To be designed properly
> later.
>
> **Ruling 6:** Assignment is a free market inside the club. **The platform
> imposes no assignment-authority policy.**

The owner's description of the real world ("the top coach gets to pick first,
but everybody's taking their notes") is a **social** protocol. Ruling 6 says
we do not encode it. The design below therefore gives every coach the same
tools and lets the humans sort out order, which is what the ruling already
decided.

---

## 1. What coaches actually evaluate

Two layers, consistently, across every source.

### The skill categories

[TeamGenius](https://teamgenius.com/what-coaches-look-for-at-basketball-tryouts/)
names eight for basketball, and they map almost exactly onto what the
generic tryout guides list:

| Category | What is being watched |
|---|---|
| **Shooting** | Form, footwork, release point, shot selection under pressure. Called "the number one thing coaches evaluate" |
| **Ball handling** | Tight dribbles, ambidexterity, head up at game speed |
| **Defense** | Effort, foot positioning, on-ball pressure, help-side awareness, active hands, communication |
| **Passing** | Accuracy, vision, timing, right decision in transition vs half court |
| **Layups / finishing** | Footwork, body control, both hands, finishing through contact |
| **Dribbling (offense off the bounce)** | Change of pace, change of direction, separation from a defender |
| **Rebounding** | Box out, urgency, positioning on both glasses |
| **Free throws** | Whether they go in, and whether the routine is repeatable |

Shorter guides collapse this to six (shooting, ball handling, layups and
finishing, defense, rebounding, conditioning).

### The intangibles, which decide most cuts

Nearly every source adds a category that adjusts the total up or down:

- **Coachability** — does a correction stick the next rep
- **Effort / hustle / compete**
- **Basketball IQ** — spacing, decisions, reading the play
- **Communication** — talking on defense, calling screens
- **Attitude / teamwork**

One guide frames the standard set as **Technical Skills, Athleticism,
Coachability, Sport IQ, Communication**. Coaches will tell you the intangibles
are what actually separate players once the skill scores bunch up, and the
data supports that: skill scores compress at the top of an age group, so the
seventh category does the work.

---

## 2. How they mark

**A 1 to 5 scale, 5 best**, is the near-universal standard.

The single most important finding in this research, and the one that decides
whether consolidation works at all:

> **The scale must be anchored. Write down what a 3 looks like versus a 4, in
> observable behaviour, or evaluators do not score the same thing and
> averaging their numbers produces noise.**

An unanchored 1 to 5 means one coach's 4 is another's 2. Averaging those is
worse than useless because it looks authoritative. This is a **content**
problem, not a software problem: the rubric text has to be written per
category, per age group, and it is the part a product usually gets wrong.

Also standard, and worth copying:

- **Weighting.** Not every category counts the same. A guard's ball handling
  may carry more than their rebounding.
- **A free-text comment box.** Every source insists on room for the thing
  that does not fit a category. This is where the real information lives.

---

## 3. How a tryout is physically run

From [Rizzler's guide](https://rizzlersports.com/learn/basketball/how-to-run-a-tryout)
and corroborated elsewhere:

- **90 minutes to two hours per session**
- **Two or three sessions across multiple days.** Day one skills, later days
  scrimmage-heavy, deliberately so one bad night does not decide a kid's
  season
- **Station rotation**, with a numbered pinnie per player:

| Station | Format |
|---|---|
| Shooting | Spot shooting, fixed attempts, plus shots off the catch |
| Ball handling | Cone courses, two-ball drills |
| Layups | Lines from both sides, transition finishing |
| Defense | Slides, closeouts, live 1v1 |
| Rebounding | Box-out drills, observed in scrimmage |
| Conditioning | Timed suicides or 17s, **lane agility test** |
| Scrimmage | 3v3 and 5v5, closes the day |

- **Multiple evaluators per station**, not one coach per skill, and this is
  explicit: *"averaging multiple independent scores is more reliable than
  single-evaluator assessment."*
- **Scrimmage is where the intangibles get seen** — decision-making, spacing,
  communication, and how a player competes when nobody is feeding them reps.

---

## 4. What the data model needs

Three distinct layers. Conflating them is the design error to avoid.

**Layer 1 — Measurables. Objective, no judgement.**
Timed and counted: lane agility time, 3/4 court sprint, suicides, made shots
out of attempts from named spots, free throws made of ten. These need no
rubric, do not vary by evaluator, and are directly comparable across years.
**They are also the only layer that can be trusted without anchoring.**

**Layer 2 — Ratings. Judgement, multi-evaluator, averaged.**
1 to 5 per category, per evaluator, with an anchored rubric and optional
weights. Store **every evaluator's raw score**, never only the average, so
disagreement stays visible and a single outlier can be seen for what it is.

**Layer 3 — Notes. Private, never averaged, never shared.**
Per the binding ruling. Free text, belongs to the coach who wrote it.

### Consolidation, respecting the privacy ruling

The owner described coaches "consolidating with their own group or their own
team coaches". That is a **scope** question, and the ruling answers the
default: private. So the model needs a note to have an audience, with private
as the default and a deliberate act to widen it:

- `private` — the author only. **Default.**
- `staff of one team` — the consolidation the owner described
- `club` — rare, and an explicit choice

Ratings consolidate differently from notes. Ratings are numbers and can be
averaged across evaluators for a pool ranking. Notes never merge.

---

## 5. What nobody else has, and we do

Every product in this space, TeamGenius included, **stops at the tryout.**
They produce a ranking, the teams get picked, and the data dies.

**We have the season that follows.** The same platform holds every game, box
score and stat line for the next six months. That closes a loop nobody else
can close:

1. **Evaluation accuracy.** A coach rated a kid 3 on shooting in September.
   By February we know he shot 38%. Show the coach their own calibration over
   time. No one in youth sports has ever been able to do this.
2. **Development, not just selection.** The tryout score becomes the baseline.
   Re-evaluate mid-season against it and a parent sees movement instead of a
   verdict. This is also the honest answer to the family who asks why their
   kid was cut.
3. **Next year's tryout opens with last year's record**, rather than a blank
   form and a memory.

That loop is the reason to build this ourselves rather than integrate
somebody else's evaluation tool, and it is the same argument as the media
layer: the defensible thing is the accumulated record, not the form.

---

## 6. Recommendation

Build in this order, and only after tryout events P1 to P3 land:

1. **Measurables first.** Objective, needs no rubric, immediately useful, and
   it is the cheapest thing here. Stations with a stopwatch and a counter.
2. **Anchored rating templates.** The build is small; the work is writing the
   anchors. Ship one strong basketball template rather than a template
   builder, because a builder hands the hardest part back to the club.
3. **Private notes with an explicit widen-to-team-staff action.** Honours the
   ruling and gives the owner the consolidation he described.
4. **Pool ranking view**: average, spread, and every raw score, sortable,
   feeding the existing pool console.
5. **The calibration loop.** Later, once a full season of tryout-to-stats
   data exists. This is the differentiator and it cannot be faked early.

**Do not build:** an assignment-order or pick-priority system. Ruling 6 is
explicit that the platform imposes no authority policy, and the "top coach
picks first" convention is exactly the politics the ruling keeps out of the
product.

---

## 7. Open questions for the owner

- **Who sees a rating?** Notes are ruled private. Ratings are not addressed.
  If every coach sees every rating, the free-market assignment becomes an
  auction on other people's homework.
- **Do families ever see any of it?** A development report is a strong
  retention feature and a serious support burden. TeamGenius sells this as a
  headline feature.
- **Do we evaluate at tryouts only, or in-season too?** In-season turns this
  from a selection tool into a development product, which is a much larger
  build and a different pitch.
- **Anchors:** who writes them? This is basketball expertise, not engineering,
  and it is the difference between a rubric that consolidates and one that
  produces confident nonsense.
