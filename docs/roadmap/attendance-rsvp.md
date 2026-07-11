---
updated: 2026-07-11
status: shipped
tier: 1
area: engagement
effort: M
source: layer2
tags: [theme/engagement, type/plan, status/shipped]
---

# ✅ Practice/event attendance + RSVP — SHIPPED 2026-07-11

**Tier 1 · effort M · from layer2.** The daily coach⇄parent loop.

## Shipped (2026-07-11, commit `b3559a7` + My Calendar follow-up)
- `EventRsvp` (player-keyed; PRACTICE | GAME | TEAM_EVENT soft ref; Neon
  runbook #24) + `PUT /api/rsvp` (parent/13+-self, roster-validated, upsert)
- Family **Going / Maybe / Can't go** on the team calendar + [[my-calendar-plan]]
  (agenda cards AND grid click-popovers)
- Staff roll-up per item ("5 going · 2 out · 3 no reply" + names/notes)
- Scoring console pre-marks Not-going players absent at roll call
- Late Not-going flip (<48h) bells+pushes staff; daily reminder cron
  nudges unanswered families (needs CRON_SECRET on Vercel)

## Still open (follow-ups)
- **Coach practice-attendance marking + history** — game attendance exists
  (scoring roll call, event-sourced); practices have RSVP intent but no
  recorded actuals. Feeds fairness/playing-time analytics.
- Availability declaration windows (season-level "away these weeks")

## Acceptance
- ✅ Families RSVP to a practice/event and coaches see the count
- ⬜ Coach marks practice attendance (follow-up above)

## Refs
[[my-calendar-plan]] · [[engagement-features-plan]] · [[requirements-map]] · [[coverage-audit]] · [[_moc-offers-engagement]]

⬅ [[_dashboard|Roadmap dashboard]] · [[_moc-offers-engagement]]
