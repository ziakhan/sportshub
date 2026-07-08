---
theme: [demos]
type: outreach
status: in-progress
updated: 2026-07-06
tags: [theme/demos, type/outreach, status/in-progress]
---

# Demo assets

Self-contained HTML demos (open in any browser; also publishable as shareable
links / screen-recordable into vertical reels).

| File | Type | Length | Audience | Published link |
|---|---|---|---|---|
| `teaser-leagues.html` | 30s auto-play teaser | ~30s | League operators | claude.ai/code/artifact/d5f346a1-2bd7-4483-b891-0835580b8108 |
| `walkthrough-cascade.html` | Detailed chaptered walkthrough | self-paced | Leagues + clubs | claude.ai/code/artifact/ae270640-34f7-4559-958e-5e2adde6a917 |

**Teaser** = sizzle reel (hook → live scoring → recap → CTA). Three cuts planned
(leagues / clubs / parents) from the same engine — leagues cut built.

**Walkthrough** = practical "how it runs": build schedule → clubs submit rosters
one-click → **cancellation cascade** (one league action notifies every coach,
parent, and player at once vs. the old phone tree). The cascade is backed by
real shipped code (`lib/game-audience.ts` + `api/games/[id]` fan-out).

Still to build: enhanced teasers (pack more features in), clubs + parents teaser
cuts, parents walkthrough. Consider screen-recording the real localhost app for
maximum authenticity (real fonts/data) once a lighthouse league is live.
