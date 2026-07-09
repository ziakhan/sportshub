---
tags: [type/reference, moc/shipped]
---

# ✅ What's Built (Shipped)

A **feature-centric** view of completed work — the answer to "how much is done?"
The graph colors *documents*, and a plan stays a plan after you ship it, so this
list exists to show the real surface area that's live. Source of truth for the
running record is [[outstanding-items]]; deploy state is in [[pending-deploy-actions]].

> Most of this is **live in production** (first big deploy 2026-07-06); a few
> items are local/unpushed pending the owner's deploy go-ahead.

## 🧱 Foundation
- ✅ Auth (NextAuth v4, credentials + JWT), multi-tenancy (subdomain routing), CASL permissions — [[sprint-1-summary]]
- ✅ Action-driven roles + onboarding flow (role select → profile) — [[_moc-onboarding]]
- ✅ Admin console + cookie-based impersonation; country/currency controls (CA/CAD)

## 🏀 Club operations
- ✅ Clubs: create, claim (188 imported unclaimed), branding (logo/colors)
- ✅ Teams: CRUD, staff assignment + coach designations, manual override kit (coach roster authority, invite-by-email, audit trail)
- ✅ Tryouts: create/publish, signups, mobile day-of check-in
- ✅ Offers: templates, multi-package options, bulk send — [[offer-package-options-design]]
- ✅ Order Sheet; club discovery + reviews

## 🏆 Leagues & scheduling — [[_moc-leagues]]
- ✅ Leagues v2: seasons, divisions, team submissions, frozen roster snapshots — [[league-v2-plan]]
- ✅ Regular-season schedule generator (preview → commit); sessions + venue days + courts + start/end times
- ✅ Schedule-commit fan-out (bell + email to staff & rostered families); roster versions + change-request flow
- ✅ Multi-team events (e.g. Media Day) on the one team calendar + phone iCal feed

## 📋 Live scoring — [[_moc-scoring]]
- ✅ Two-tap scoring console (offline-first, append-only events) — [[live-scoring-design]]
- ✅ Attendance, scoresheet + server-rendered PDF, referee PIN sign-off
- ✅ Standings + leaders compute

## 💳 Payments — [[_moc-payments]]
- ✅ Modes: offline / direct / platform-collect (stages 1–4) + 7-posture admin console — [[payments-design]]
- ✅ Card-on-file (Stripe Customer + SetupIntent), offer payment terms (full/plan + deposit + installments) — [[payments-plan-v2]]
- ✅ Deposit-gated accept with one-click saved card; auto-charge + reminder crons
- ✅ Webhooks (invoice.paid / payment_failed → receipts); parent installment timeline; league Connect parity
- ✅ Live-verified end-to-end in Stripe test mode

## 🎨 Content & public site — [[_moc-content-ux]]
- ✅ AI game recaps (auto-publish on finalize, template fallback) — [[public-site-content-plan]]
- ✅ Homepage (scoreboard strip, your-teams rail, news/leaders); league / team / player / news pages
- ✅ Follow model + star affordance; content-first homepage for signed-in members — [[home-redesign-plan]]
- ✅ Site IA N1: personalized nav dropdowns, Manage door, /scores, role-aware /post-login — [[site-ia-plan]]
- ✅ **Customizable club & league pages** — branded hero (banner/logo/colors/tagline/description) + sticky sub-nav + two-zone drag-drop block editor (`@dnd-kit`) + image upload + contact + socials + announcements (club); branded hero + editor (league) — [[customizable-pages]]

## 🤝 Engagement — [[_moc-offers-engagement]]
- ✅ Team ↔ family chat + public chat dock
- ✅ Team polls & surveys; practice scheduling (slots → announce → live calendar → iCal) — [[engagement-features-plan]]

## 🧑‍⚖️ Referee
- ✅ Uber-style session booking (pool + availability + broadcast offers); availability declaration

## 🚪 Onboarding completion (this session)
- ✅ Data-driven completion checklist (role-aware, derived from real records) — [[onboarding-tutorials-plan]]
- ✅ Top-nav "Setup %" pill + dashboard "finish setup" card
- ✅ First-run soft gate (`/welcome`), universal routing, "Create your club" as step one

## ⚙️ Platform health & demos
- ✅ NPH demo world seeder (real clubs, two leagues, full pipeline) — [[nph-demo-seed-plan]]
- ✅ Capacity planner; perf fixes (polling / N+1 / memoization) — [[perf-audit-2026-07-06]]
- ✅ 4-layer test architecture + world-builder simulation — [[test-architecture]]; WS1–WS4 trust fixes — [[architecture-review]]

---

**In flight (not done):** see `in-progress` docs — [[home-redesign-plan]], [[site-ia-plan]],
[[public-site-content-plan]], [[engagement-features-plan]], [[onboarding-tutorials-plan]].
**Next up:** [[feature-backlog]] · **Before go-live:** [[launch-blockers]].

⬅ [[Home]]
