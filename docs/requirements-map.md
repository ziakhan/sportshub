---
updated: 2026-07-08
tags: [theme/system, type/reference, status/living]
---

# 🧱 Requirements Map — the complete-platform denominator (Layer 2)

The **target set** a complete Ontario youth-basketball platform needs, derived from
first principles (compliance · money · lifecycle · parity/non-functional) —
*independent of what we happened to build*. Companion to [[coverage-audit]] (Layer 1
= what's built). This is open-ended and iterative by nature; it will grow.

> **The honest re-read.** Layer 1 said we've built ~85% of *what we planned*. Against
> this fuller denominator, we're closer to **~60% of a complete platform** — not a
> regression, a *truer baseline*. The operational core (clubs, leagues, scoring,
> payments, content) is genuinely strong (~85%); what's largely unbuilt are whole
> categories we never planned: **safety/compliance (~10%)**, money edges (~55%),
> retention/lifecycle (~50%), and localization/accessibility/ops (~40%).

## ✔️ Corrections to Layer 1 (the layers cross-checked each other)
- **Refund initiation — HAVE, not missing.** A merchant Refund button exists (`obligations-table.tsx` → `PATCH /api/payments/[id]`, `reverse_transfer`). Real gap = refund *policy/proration*.
- **13+ player self-onboarding — HAVE, not missing.** `role-selector` offers it; onboarding creates `Player{canLogin:true}`. Real gap = the player-*invitation* accept UI.
- **Media/video embeds — partial, not image-only.** A YouTube `<iframe>` (news) and a `<video>` tile exist.

---

## Requirement register (by domain)
Legend: importance **T0** table-stakes/legal · **T1** important · **T2** nice-to-have · status ✅ have · 🟡 partial · ⛔ missing

### ⚖️ Compliance & safety (Ontario) — highest legal stakes, mostly ⛔
- **Rowan's Law concussion** acknowledgement + removal/return-to-play — **T0 ⛔** *(Ontario statute for orgs registering minors)*
- **Emergency contact + medical/allergy/medication** on the Player — **T0 ⛔** *(life-safety; Player model has none)*
- **Liability waiver + e-signature** at registration — **T0 ⛔** *(only signature capture today is the ref scoresheet)*
- **Vulnerable-sector / police background-check** tracking for staff/coaches — **T0 ⛔** *(mandated; coaches assigned with no screening gate)*
- **PIPEDA baseline** — Privacy Policy/ToS acceptance, purpose consent, data export, self-serve deletion — **T0 ⛔/🟡** *(soft-delete plumbing exists)*
- Codes of conduct (player/parent/coach) + ack — **T1 ⛔**; Report-abuse / content flag — **T1 🟡** *(fields exist, no flow/UI)*
- Proof of insurance on file — **T1 ⛔**; Coach certification (NCCP) tracking — **T1 ⛔** *(refs only today)*
- Discipline: suspension/ejection record — **T1 🟡** *(enums only)*; Age verification — **T1 🟡**

### 💰 Money & commerce edges
- **Waitlists** (camps/leagues/tryouts at capacity) — **T0 🟡** *(WAITLISTED enum unused; full = hard-reject today)*
- **Refund policy + prorated mid-season withdrawal** — **T1 ⛔** *(button exists, policy/proration doesn't)*
- **Canadian year-end tax / childcare receipts** (CRA T778) — **T1 ⛔**
- **Financial aid intake** (Jumpstart, KidSport) + scholarships — **T1 ⛔** *(only manual "waive")*
- **Sibling/family discount + promo codes** — **T1 ⛔**
- Registration cancellation (paid) self-serve — **T1 🟡**; Downloadable receipt/statement PDF — **T1 🟡**
- **Referee payouts** — **T1 ⛔**; Coach stipends — **T2 ⛔**
- Chargeback/dispute webhook — **T1 🟡** *(enum, no handler)*; Club/league financial reporting — **T1 🟡**
- Uniform/merch ordering — **✅ (bundled Order Sheet)**; inventory/store — **T2 ⛔**; Fundraising/sponsorship — **T2 ⛔**; GST/HST on fees — **T2 ⛔**

### 🔄 Lifecycle & retention
- **Season rollover / returning-player re-registration** — **T0 ⛔** *(the retention revenue loop; `Team.season` is free text)*
- **Practice/event attendance + RSVP** — **T0/T1 ⛔** *(announce-only; RSVP already backlogged)*
- **Tryout evaluation rubric** (coach ratings feeding offers) — **T1 ⛔** *(tryout→offer decision is blind)*
- **Co-guardian / two-household** support — **T0 ⛔** *(single `parentId` FK)*
- Player transfer intra-club — **T1 🟡** / inter-club — **T1 ⛔**; Call-ups/guest players — **T1 ⛔**
- Injured player status — **T1 ⛔** *(no INJURED enum)*; Notification preferences (per-channel/event, unsubscribe) — **T0 ⛔** *(CASL)*
- Self-serve account deactivation/deletion — **T0 ⛔**; Volunteer signup sheets — **T1 ⛔**; Carpool — **T2 ⛔** *(owner-parked)*

### 🏗 Parity & platform / non-functional
- **Registration forms + custom fields** — **T0 ⛔** *(category core; OBA runs on RAMP for this — also the vehicle for waivers/medical/consent above)*
- **Bilingual FR-CA + AODA/WCAG accessibility** — **T0 ⛔/🟡** *(Ontario law; zero i18n, cosmetic a11y)*
- **Data import (migration) + export** — **T1 ⛔** *(GTM blocker — can't displace RAMP/TeamSnap without roster/schedule import)*
- **Observability (Sentry) + rate limiting + MFA** — **T1 ⛔** *(SaaS ops/liability baseline)*
- **Prod email provider** (SPF/DKIM) — **T0 🟡** *(Mailpit default; hard launch blocker — owner-side, tracked in [[launch-blockers]])*
- Mobile app / installable PWA + push — **T1 ⛔**; SMS — **T1 ⛔**; 2-way calendar sync — **T2 ⛔**
- SEO sitemap/robots/JSON-LD — **T1 🟡/⛔**; Website builder / custom domain — **T2 🟡**; Live streaming — **T2 ⛔**; Recruiting/exposure — **T1 🟡**; Public API/webhooks — **T2 ⛔**; Help center — **T1 ⛔ (planned)**; Playoff/bracket generation — **T1 🟡** *(configured, not generated)*; Broadcast (club/league-wide) — **T1 🟡** *(API-only)*

---

## 🎯 Merged build backlog (Layer-1 disconnects + Layer-2 net-new), tiered

### Tier 0 — Before a real (paid, public) launch: legal / safety / trust
1. **Registration + custom fields** as the container for → **waivers + e-sign**, **Rowan's Law concussion ack**, **emergency contact + medical/allergy**, **photo/PIPEDA consent** at signup.
2. **Background-check status tracking** gating staff/coach assignment.
3. **PIPEDA/CASL baseline** — Privacy Policy + ToS acceptance, notification preferences + unsubscribe, self-serve data export & deletion.
4. **Prod email provider** *(owner-side; [[launch-blockers]])*.

### Tier 1 — Core product completeness (wire the last mile + the revenue loop)
5. **Invitation → register → accept → onboarding continuity for ALL invite types + manual bypass-add** ← *owner priority, building first (see [[coverage-audit]] + the flow map).*
6. **Camp & house-league registration UI** (APIs exist, no UI).
7. **Scorekeeper can actually score** (role is a 403 dead end).
8. **Waitlists** (enum stub → queue + promote + notify).
9. **Season rollover / re-registration** (retention loop).
10. **Refund policy + prorated withdrawal**; **referee payouts**.
11. **Practice/event attendance + RSVP**; **tryout evaluation rubric**.

### Tier 2 — Parity & operations
Bilingual FR-CA + AODA accessibility · data import/export · observability + rate-limit + MFA · playoff generation · broadcast comms · financial aid + sibling/promo discounts + tax receipts · co-guardian/two-household · content moderation UI · operator analytics · dispute webhook + receipt PDFs.

### Tier 3 — Differentiators / later
Mobile app/PWA + push · SMS · 2-way calendar sync · live streaming · recruiting profiles · merch store · fundraising/sponsorship · website builder · public API.

---

## 📁 Tracked plan docs
Every backlog item above is a plan doc in `roadmap/` — a node in the graph, tracked on
the [[_dashboard|Build Dashboard]]. Statuses flip planned → in-progress → shipped as we go.

**Tier 0** — [[registration-forms]] · [[waivers-esign]] · [[concussion-rowans-law]] · [[player-safety-medical]] · [[staff-background-checks]] · [[privacy-pipeda-casl]]
**Tier 1** — [[invitation-continuity]] · [[camp-houseleague-registration]] · [[scorekeeper-access]] · [[waitlists]] · [[season-rollover]] · [[refunds-withdrawals]] · [[referee-payouts]] · [[attendance-rsvp]] · [[tryout-evaluations]]
**Tier 2** — [[i18n-accessibility]] · [[data-import-export]] · [[observability-security]] · [[playoff-generation]] · [[broadcast-comms]] · [[financial-aid-discounts]] · [[co-guardian-households]] · [[content-moderation-analytics]]
**Tier 3** — [[mobile-pwa-push]] · [[differentiators-future]]
**Initiative — Identity & Pages** ([[_moc-identity]], draft) — [[handles-identity]] · [[customizable-pages]] · [[player-profile-privacy]]

## How we build
One cohesive feature at a time (never batch). **Starting now: [[invitation-continuity]]**
— highest-value plumbing the rest rides on, and the owner's explicit ask. Each build
updates its plan's `status` (→ shipped) + [[_moc-shipped]] on ship, and the
[[_dashboard]] reflects it automatically.

⬅ [[Home]] · see also [[coverage-audit|Coverage Audit]] · [[feature-backlog]] · [[launch-blockers]]
