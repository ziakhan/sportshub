# NPH 2026-27 Fall/Winter Registration — Alignment & Demo Plan

> Research 2026-07-29 (owner request). Source: northpolehoops.com — [2026 application](https://northpolehoops.com/2026-application/), [season overview](https://northpolehoops.com/2026-season/), [league registration](https://northpolehoops.com/league-registration/), stats.northpolehoops.com.
> Question: are we aligned with what NPH's team-onboarding process needs, and can we provision their league structure as a demo to show them an easier path?

## 1. What NPH is running (their current process)

**Who registers:** clubs/prep programs apply PER TEAM into NPH leagues (this is B2B team registration, not parent/player signup — our league-side flow, not our program-signup flow).

**Their funnel today:**
1. **Marketing pages** (2026-season, league-registration) → "Apply Now" → one shared **4-step web form** (Jotform-style, no account):
   - **Step 1 — league selection.** Boys: NPA Canada, NPA USA, D1 Academy, D1 Scholastic, D1 Junior, Showcase League (grades 6-12 / U12–U19+). Girls: WNPA Canada, WNPA USA, D1 Senior Open, D1 Junior Open, Showcase League High School, Showcase League Elementary.
   - **Step 2 — program info.** Team name, city, social handles, team synopsis + top prospects, reason for joining, "Program Vision — goals over 1/3/5 years"; optional academic provider + school website + home gym; logo upload (2 files). Point of contact: name, role, email, phone.
   - **Step 3 — uniform upsell.** Interested / not interested; packages "starting at $85 CAD" (2 jerseys + 2 shorts).
   - **Step 4 — terms + digital signature.** 50% NON-REFUNDABLE deposit to hold the spot; balance due 2 weeks before tip-off; no refunds; $500 forfeit fee per forfeited game; rules distributed as a **Google Drive PDF**; checkbox + draw-signature.
2. **Fees:** Showcase League **$3,990.00 per team** (Boys/Girls × Tier 1/Tier 2 listed as four shop items). No online payment visible on the application — deposit/balance appears to be invoiced manually afterward.
3. **Stats/standings/schedules:** separate subdomain stats.northpolehoops.com — third-party/custom stats platform; renders raw `{{template}}` placeholders on load, TBA/TBD rows, disconnected from the marketing site.

**What their stack visibly lacks:** applicant accounts + status tracking (form fires into a void until a human replies), payment collection wired to the application (manual deposit chasing), structured rules/document hosting, and ANY family-facing layer after a team is admitted (no schedules-to-parents, chat, RSVP, live scores in one place).

## 2. Alignment verdict — feature by feature

| NPH need | Our platform | Status |
|---|---|---|
| Multiple leagues under one org | League entities; owner-nph@ demo persona already holds 3 leagues | ✅ |
| Fall/winter season w/ registration window | `Season` (`type: FALL_WINTER`, `registrationDeadline`, `status: REGISTRATION`) | ✅ |
| Divisions by age/grade, gender, tier (Tier 1/2) | `Division` (`ageGroup`, `gender`, `tier`, `maxTeams`) | ✅ exact fit |
| Team applies → league accepts/rejects | `TeamSubmission` `PENDING → APPROVED/REJECTED/WITHDRAWN` + league review dashboard | ✅ exact fit |
| $3,990 team fee | `Season.teamFee` + per-submission `registrationFee` override, `RegistrationPaymentStatus` (UNPAID / PAID_MANUAL / PAID_STRIPE / WAIVED) | ✅ |
| Program identity (logo, city, socials, gym) | Club profile IS this data — entered once, reused every season (their form re-asks every year) | ✅ better |
| Games guaranteed ("session" format) | `Season.gamesGuaranteed`, sessions/venues scheduler, blackouts | ✅ |
| T&C acceptance + digital signature | Waiver/e-sign infra (`WaiverDocument`/`SignRequest`/`Signature` + reminders) — built for player waivers | 🟡 adapt to team-level agreement at submission (small) |
| 50% deposit + balance 2 wks before tip-off | Installments exist for club→parent offers (`OfferInstallmentTerm`, scheduled charging) but NOT for league team fees | 🟡 gap G2 (bridgeable day one via PAID_MANUAL + our e-transfer rail; native deposit schedule = small build) |
| Free-text application questions (synopsis, vision, reason, academic provider) | No custom-question builder on season registration | 🔴 gap G1 (the one real build) |
| Uniform package upsell | Not a feature | 🔴 gap G3 (v1: one interest checkbox stored on submission; fine to skip) |
| $500 forfeit fee | Manual obligation/charge possible; no automated forfeit fee | 🟡 policy text now, automation later |
| Rules & regulations distribution | League public page (vs their Google Drive link) | ✅ (host/link) |
| Stats, standings, schedules, box scores | Integrated on the same domain + live scoring + auto recaps + digest/social cards + native app | ✅ far ahead of their stats subdomain |
| Payment collection wired to registration | Stripe + e-transfer reconciliation rail (1.5% story vs manual invoicing), overdue nagging, accounting exports | ✅ ahead |

**Verdict: strongly aligned.** Our league-side model was evidently designed for exactly this shape (application → review → fee → roster → schedule → live ops). Of their entire funnel, only three things don't map 1:1: custom application questions (G1, the only must-build for a faithful demo), deposit schedules on team fees (G2, demonstrable today via manual-payment status + a payment-plan talking point), and the uniform upsell (G3, cosmetic).

## 3. The pitch this demo makes (why we're EASIER for NPH)

1. **Apply-once, reuse forever:** clubs on the platform carry their profile (logo, city, socials, gym) — a returning program's application is 3 clicks, not a 20-field annual re-type.
2. **Application pipeline, not an inbox:** every submission lands PENDING in the league dashboard with accept/reject, division assignment, fee status, and automatic notifications — vs a form that emails a human.
3. **Money wired in:** deposit tracked on the submission, balance chased automatically (overdue nags), e-transfer rail at 1.5% vs manual invoicing; accounting exports for their bookkeeper.
4. **The season runs itself after admission:** scheduler (sessions/venues/blackouts), live scoring, integrated standings/box scores ON the same site (their stats subdomain visibly renders broken template code), auto recaps + social cards, referee booking + settlements.
5. **The layer they simply don't have:** every admitted team gets chat, family schedules/RSVP, phone-calendar sync, native app, news cards — NPH's product ends where ours begins.

## 4. Demo provisioning plan (buildable now, LOCAL first)

Extend the demo seed (or a sibling seed `scripts/seed-nph-fallwinter.ts`) under the existing NPH demo org (owner-nph@):
- **Leagues/seasons:** "NPH Showcase League 2026-27" (FALL_WINTER, registration OPEN, teamFee $3,990, gamesGuaranteed set) with divisions mirroring their real sheet — Boys Tier 1/Tier 2, Girls Tier 1/Tier 2, age groups U12–U19; plus thin "NPA" and "D1" leagues (Academy/Scholastic/Junior divisions) to show the multi-league selector.
- **Pipeline in every state:** seeded submissions PENDING (2), APPROVED+deposit PAID_MANUAL (2), APPROVED+UNPAID w/ overdue nag visible (1), REJECTED (1) — so the review dashboard demos itself.
- **T&C:** league waiver document containing their real terms (deposit, forfeit fee, commitment) attached to the season — shows e-sign replacing the Jotform signature.
- **Demo script:** club persona (owner-force@) applies to Showcase Tier 1 → NPH persona approves + records deposit → team appears in standings-ready division.
- Gaps G1/G2 acknowledged live if asked; G1 (custom questions per season) is the follow-up build if NPH engages.
- ⛔ Local seed only; box reseed = owner-approved deploy step.

## 5. Open items
- G1 build decision (custom application questions on season registration) — recommend building before a real NPH pitch, not needed for first internal demo.
- G2: deposit/balance schedule on `TeamSubmission` (reuse installment math) — small, high pitch value ("we automate your 50%-deposit chase").
- Whether to model NPA/WNPA "Canada vs USA" split (skip for demo; Canada only).
