---
updated: 2026-07-20
tags: [theme/research, type/competitor, status/current]
---

# LeagueApps teardown vs SportsHub One (researched 2026-07-20)

> Trigger: owner heard "they also have paid club pages, chat, schedules" while prepping
> first-look demos for club owners. This is the fact-check. Sister docs:
> [[expansion-strategy-2026-07]] (TeamLinkt = top Canadian threat), canada-league-landscape
> (RAMP #1 volume in Canada). LeagueApps is the **US premium incumbent**.

## Who they are

NYC-based, one of the two big US youth sports management platforms (with TeamSnap).
Products: the management platform (registration, payments, communications, scheduling,
reporting, facilities, integrations), the **LeagueApps Play** mobile app (free), custom
**WordPress websites via their paid "Design Shop"**, and safety/background-check services
(they **acquired NCSI**, plus a Yardstik integration). FundPlay = their charity arm.
Sports: baseball, basketball, field hockey, football, hockey, lacrosse, soccer, softball,
volleyball. Customers by type: clubs, leagues, camps, tournaments, facilities.

## Pricing model (the wedge)

No public pricing — custom quotes. Reviewers on G2/Capterra/SoftwareAdvice consistently
report a **per-registration platform fee up to ~5.9% on top of card processing**. A club
with 1,000 registrations at $250 avg hands LeagueApps ~$14,750/season before processing.
Organizations can pass an optional $1–5 "processing fee" to parents. Offline payments free.

## Feature-by-feature vs us

| Area | LeagueApps | SportsHub One | Verdict |
|---|---|---|---|
| Registration | Multiple models, custom forms, flexible pricing, payment plans, autopay, stored cards, invoicing | Seasons/camps/house-leagues/tournaments, Stripe, installments, offers, withdrawal approvals | ≈ Parity; theirs more e-commerce-mature, ours simpler |
| Payments | Plans + auto-billing; invoicing called "clunky" in reviews | Stripe rails, installment plans, per-team offer templates | ≈ Parity |
| Scheduling | Round-robin generator, tournament brackets in <1 min with seeds + auto-advance on score entry, pool play, drag-and-drop, conflict prevention | Season scheduler (sessions/days/venues/courts), playoff generation with auto-advance, reschedule/cancel comm templates | ≈ Parity; both auto-advance brackets |
| Scores & standings | **Post-game score entry by admins only**; standings auto-update; outcomes Final/OT/Forfeit etc. **No live scoring** | **Real live scoring**: clock, play-by-play, box scores, public live game page polling every 10s | **We win big** |
| Live streaming | None (BallerTV is a separate company, not a LeagueApps feature) | Planned: [[live-streaming-plan]] (fixed channels, court placement, scorekeeper confirm) | **We win** once shipped |
| Chat / comms | Play app: team chat + photos, coach notes (priority alerts), admin announcements (email+push). Reviews: "messaging needs improvement", **Android app missing features iOS has** | Team group chats with web + iOS + Android parity (hard rule), bell notifications, email templates | **We win** on parity + web chat |
| Club pages / websites | Paid Design Shop building a **WordPress site** (designer-assisted, custom CSS) — separate property from the platform | Public club pages native to the platform: customizable sections, reviews + ratings, club claiming, SEO, city pages | Different games; ours is built-in + has a **discovery/reviews layer they lack entirely** |
| Content | None | AI game recaps, news covers, follow feeds | **We win** |
| Mobile app | Play app free, well-rated, but iOS-first (Android gaps documented) | Native iOS (TestFlight) + Android, full-parity rule | ≈ We're newer but parity-strict |
| Facilities mgmt | Yes — facility scheduling/management product | No | **They win** |
| Reporting | Mature real-time reporting suite | Basic dashboards | **They win** |
| Integrations | Integration Center: accounting, background checks (NCSI owned, Yardstik), recruiting, hotels, marketing, evaluations | None yet (Twilio seam dark, no marketplace) | **They win** |
| Safety/compliance | NCSI background checks in-product | Roadmap ([[staff-background-checks]]) | **They win** (US-centric though) |
| Referees | Not a product | Referee booking + assignment + PIN scoring | **We win** |
| Tryouts/evaluations | Player evaluations via third-party integration partners | Native tryout registration, check-in, notes, bulk offers + public tryout browse w/ club ratings. **Scoring rubric NOT built** ([[tryout-evaluations]] = planned, tier 1) | Mixed: our tryout *pipeline* is native and strong; player *scoring* is manual today — do NOT claim evaluations in demos |
| Market | US-focused | Canada-first (single birth-year, e-transfer pain, CAD) | Different battlegrounds |

## Review-sourced weaknesses (G2/Capterra/SoftwareAdvice/Trustpilot)

- Complexity: "flexible and complex… can get confusing"; asks for better FAQs.
- Billing/invoicing described as clunky; registrations "difficult to build" (some reviews).
- Android app second-class vs iOS (missing home icon, month calendar, features).
- Messaging functionality a common improvement request.
- Support experiences split: much praise, but also "customer service was terrible" and a
  reported 14-day app outage with noncommittal responses.
- The ~5.9% per-registration take is the structural resentment point.

## Deep dive: the three areas where they beat us (researched 2026-07-20)

**Reporting depth.** Not just stat tiles — a real analytics product ("LeagueApps
Analytics"): customizable dashboards; org-level registrations report searchable/filterable
across *all* of an operator's sites; Program Comparisons (program-over-program /
season-over-season); Transaction Summary per program; Program Transactions with
program + subprogram financial breakdowns; Discount Code Redemptions across site, program
and team level; attendance, member-info, and payment-plan reports. Accounting-grade
reconciliation: every payment, credit, and refund tracked for dispute handling; donations
and e-commerce trends. Exports to CSV/Excel/PDF including **scheduled exports with saved
filters**. Plus a Gateway Payments Dashboard for their in-house payment gateway. Our side
today: club dashboard tiles + capacity planner; no report builder, no exports, no
scheduled reports, no cross-program finance views. A multi-program club's treasurer lives
in exactly these screens.

**Integration ecosystem.** "Integration Center" = push/pull member data with no double
entry across accounting, background checks, college recruiting, hotel booking (US travel
tournaments), digital marketing, and player evaluations. Named partners we verified:
Yardstik (screening), NCSI (owned outright), Ankored (real-time compliance status shown
inside LeagueApps). Competitive meaning: they sit as the hub of an operator's back office,
which raises switching costs. Our side: zero integrations live (Twilio seam dark).
Mitigation: hotel booking / college recruiting are US-travel-circuit concerns; our
beachhead (small Canadian clubs) mostly doesn't buy on this.

**In-product background checks.** Two prongs: they **acquired NCSI** (National Center for
Safety Initiatives — screening + safety services now in-house), and the **Yardstik
integration automates the whole loop**: every newly registered staff member for connected
programs is auto-sent to Yardstik on sync and enters an FCRA-compliant screening
invitation flow; results and statuses sync back into LeagueApps Reporting where admins
view and act; one LeagueApps site maps to one Yardstik sub-account with chosen packages.
Concretely: a club screening 40 coaches gets register → auto-invite → status dashboard.
Our side: nothing yet ([[staff-background-checks]] roadmap). Canadian angle: our
equivalent is provincial vulnerable-sector checks (different rails, no FCRA), so parity
here means a Canadian-native flow, not copying Yardstik.

(Fourth gap, minor for our market: a dedicated facilities-management product — court/field
rental scheduling for facility businesses. We don't target facility operators yet.)

## Demo talking points vs "we already use LeagueApps / looked at it"

1. **"What do you pay per registration?"** Their model skims up to ~5.9% of every signup
   forever. (Our pricing isn't final — don't quote ours; just plant the math.)
2. **"Can parents watch the game live?"** LeagueApps enters scores *after* the game.
   We run the live clock, play-by-play, and box score on a public page, with streaming
   coming on the same page.
3. **"Open your club's page on Google."** Their public web presence is a separately-paid
   WordPress site; ours is built in with reviews, discovery, and SEO.
4. **Android parents.** Their own users report the Android app lags iOS. We ship every
   feature to web + iOS + Android in the same pass.
5. Concede gracefully when asked: facilities management, deep reporting, US background-check
   integrations — real gaps on our side today, on the roadmap.

## Sources

leagueapps.com (home, /youth-sports-management-platform/*, /pricing, /youth-sports-websites,
/leagueapps-play-mobile-app, /media-room NCSI acquisition, Integration Center) ·
support.leagueapps.com (scoring & standings, schedule generator, bracket generator, Play app
guides) · G2 + Capterra + SoftwareAdvice + GetApp review pages (fee reports, cons) ·
waresport.com + leaguearc.com competitor pages (5.9% figure corroboration) · ballertv.com
(separate company confirmation).
