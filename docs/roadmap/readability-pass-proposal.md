---
updated: 2026-07-17
tags: [theme/design, type/proposal, status/awaiting-owner-approval]
---

# Readability pass — audit findings + proposed fixes (NO logic changes)

Owner brief: bigger type, tighter spacing, stronger contrast, bolder tab
bar, every screen, scoring console priority. Audit method: UI/UX Pro
guidelines (16px mobile body floor, WCAG 4.5:1, 44px targets) + measured
contrast + code inventory of every fontSize/text-* in the app and key web
surfaces. NOTHING below changes logic, navigation, or content.

## A. Contrast — measured, global (the "too gray" problem is real)
| Token | Hex | Contrast on white/#fafafa | Verdict |
|---|---|---|---|
| ink-400 (`textFaint`, web `text-ink-400`) | #9191a1 | **2.9–3.1 : 1** | FAILS WCAG AA |
| ink-500 (`textMuted`, tab-bar inactive) | #747486 | **4.3–4.6 : 1** | borderline; fails on gray cards |
| ink-600 | #5e5e6e | 6.1–6.4 : 1 | passes comfortably |

Fix (one pass, both platforms — they share design-tokens):
- Native semantics: `textMuted` ink500→**ink600**, `textFaint` ink400→**ink500**.
- Web sweep: information-carrying `text-ink-400`→`text-ink-500`,
  `text-ink-500`→`text-ink-600`. Pure decoration (chevrons, dividers,
  disabled) may stay light.

## B. Native tab bar (owner call-out)
Found: icons 20px, labels 10px/700, inactive = borderline ink-500 gray.
Fix: icons 20→**24**, labels 10→**11.5/800**, inactive color →ink-600,
capsule +2px padding. Targets grow, never shrink.

## C. Native shared components (one edit → every screen inherits)
| Component | Now | Proposed |
|---|---|---|
| ListRow sub | 12.5 muted | **13.5** ink-600 |
| TonePill | 11 | **12** |
| SectionHeader eyebrow | 11 | **12** |
| Card padding / screen gap | 14 / 12 | **12 / 10** (type grows, air shrinks) |
| Chat: body/sender/typing/edited | 15/12/11/10 | **16/13/12/11** |
| Event card: meta/player/rsvp | 13/13/12 | **14/14/13** |
| Home band: title/sub/time/detail | 14/12/13.5/12 | **15/13/14.5/13** |
| Poll bubble: question/option/footer | 15/14/11.5 | **16/15/12.5** |
| Game page: plays+log rows / box header | 12.5–13.5 / 10 | **+1 each / 11** |

Floor rule going forward: no information below **12.5 native / 12px web**;
those sizes reserved for timestamps + eyebrows only.

## D. Scoring console (web — owner priority)
Inventory: **65** instances of ≤12px text; **16** uses of failing ink-400.
| Element | Now | Proposed |
|---|---|---|
| Player tile name (h-54 tiles) | text-xs | **text-[15px]/semibold**, tile height kept, inner padding −2 |
| Assist/rebound quick-strip buttons | text-sm 44px | text-sm→**text-base** where width allows |
| Undo / helper / hint text | text-xs ink-400/500 | **text-sm ink-600** |
| Box-score table + headers | text-xs / 10px | **text-sm / 11px** |
| Setup roster tiles + uppercase sub | text-xs / 9px | **text-sm / 10.5px** |
| Clock readout | text-lg mono | **text-2xl** (glanceable mid-game) |
| Empty/error states | p-8 text-sm | p-6 **text-base** |
Score (3xl) and period buttons already right. All 44px targets preserved.

## E. Web general (mobile-web parity of C)
Account tile details, band sublines, players-page chips, poll footer,
status pills: 11–12px → **12–13px**; same ink-400→600 sweep. Tables keep
the Energy Pass 12→15.5px work already shipped.

## F. Spacing rhythm
Where type grows, surrounding padding tightens one step (14→12, gaps
12→10) so screens get denser AND more readable. Touch targets never
shrink; tab bar targets grow.

## Verification before "done"
Before/after screenshots of: coach home, chat w/ poll, calendar, game page,
kids, account, scoring console (phone landscape + portrait), sign-in.
Contrast re-measured on the new tokens. 390px overflow check. Native
changes reviewed on-device by owner post-OTA.

## Status: AWAITING OWNER GO. Zero implementation yet.

## G. PUBLIC SCORES SURFACES (owner's actual priority — audited 2026-07-17)

### /scores listing + ScoreCard (the score page)
| Element | Now | Problem | Proposed |
|---|---|---|---|
| Team names on cards | text-sm (14px) | THE primary text of the surface, phone-squint size | **text-base (16px)** |
| Loser team + score | ink-500 name / ink-400 2xl score | "dimmed loser" via failing gray (2.9:1) | keep the dim hierarchy but at **ink-600**, score ink-500 |
| Date / venue lines | 12px ink-500/400 | small + failing gray | **13px ink-600** |
| Day group headers | 12px ink-400 | fails contrast | **12.5px ink-600** |
| Filter pills | 12px | small tap text | **13px**, py +0.5 |
| Crest monograms | h-7 / 10px letters | fine (decorative) | unchanged |

### Public game page (/live/[gameId]) — 23 instances ≤12px, 8 failing grays
| Element | Now | Problem | Proposed |
|---|---|---|---|
| Hero scores | 6xl/7xl condensed | correct — untouched | — |
| Team records under names | 11px white/50 on dark stage | ~4:1 at 11px on stage = illegible in gyms | **12.5px white/75** |
| FINAL·period·clock center chips | 10px white/60 | same | **11.5px white/80** |
| Leader stat sub-lines ("6-9 FG") | 11px ink-500 | the row's actual information | **13px ink-600** |
| Leader unit labels (PTS/REB) | 10px ink-400 | fails | **11px ink-600** |
| Linescore table headers | 11px ink-400 | fails | **12px ink-600** |
| Section eyebrows (GAME LEADERS…) | 10px ink-400 | fails; these are the wayfinding | **11.5px ink-600** |
| Quarter totals | 2xl condensed | good | — |

### Native Scores tab (phone=phone)
| Element | Now | Proposed |
|---|---|---|
| Score number | 18 | **22/900 tabular** (it's a scores screen) |
| Team name | 16/600 | 16/**700** |
| League/status/venue | 12 muted(ink500) | **13 ink-600** |
