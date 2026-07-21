---
updated: 2026-07-20
status: shipped-phase-1
tier: 0
area: compliance
effort: M
source: layer2
tags: [theme/compliance, type/plan, status/shipped-phase-1]
---

# ✍️ Liability waivers + e-signature

> **✅ PHASE 1 + IN-FLOW SIGNING SHIPPED 2026-07-20 (local, unpushed — runbook
> #33).** Schema (WaiverDocument/SignRequest/Signature), ON template library
> (ack+indemnity, Rowan's concussion code w/ annual renewal, media consent),
> league+club CRUD APIs & management UI, **approval → auto-email flow live**,
> public tokenized signing page w/ SignaturePad, season Signing-status grid
> w/ re-send, version-bump re-signing.
>
> **OWNER RULING (same day): signatures are collected at TRANSACTION MOMENTS —
> "to be on a team the waiver should be sent with the offer"; camps/house
> leagues "signed with the registration while they register"; no separate
> signing moment.** Implemented: offer accept + camp/HL/tryout signup APIs
> return 409 WAIVERS_REQUIRED with outstanding docs; shared WaiverSignGate
> modal (SignaturePad) collects signatures via session-authenticated
> POST /api/waivers/sign-inline (parent-child checked), then the flow retries
> (offer retry reuses an already-paid deposit intent). Server enforces
> independently of the client. Int tests 12/12 (seed 1134), suite 321/321.
> **Still open (owner's call)**: signed-copy PDF render · club-side signature
> viewer · eligibility gate on unsigned league players · club dashboard nav
> link to /clubs/[id]/waivers (page live, reachable by URL).

> **OWNER SPEC 2026-07-20** (researched same day): waivers are issued by **both leagues
> and clubs**. League flow he wants: once a team's roster is submitted to the league and
> **approved, every parent on the roster automatically gets an email with the league's
> waiver to sign** for participation. Clubs need the *ability* too (school-gym practice
> permits etc.) but it's optional per club. Text: standard **templates we provide,
> customizable** per club/league.

**Tier 0 · effort M · from layer2.** Universal youth-sport requirement and the club's core legal shield; today the only signature capture is the referee scoresheet.

## Research findings (2026-07-20)

- **Who issues waivers in practice**: leagues/PSOs at team-entry time (owner has signed
  these as a parent), clubs at program registration, and facility owners indirectly —
  Ontario school boards require permit holders to carry **$2M general liability with the
  board as additional insured**; club affiliation with a PSO (e.g. Ontario Basketball)
  supplies that certificate. Clubs then paper over their own exposure with participation
  agreements. So: league waivers = always; club waivers = per-club option. Matches owner
  spec exactly.
- ⚖️ **Ontario legal reality**: parent-signed *liability* waivers for minors are widely
  expected to be **unenforceable** (no authoritative ON ruling; BC has ruled them
  unenforceable by statute; contract law + public policy point the same way). What holds
  value: **acknowledgment-of-risk** + **parent indemnity agreement** structures. Product
  implication: our templates should be structured as Acknowledgment of Risk + Indemnity,
  not naive "you can't sue us" text, and we should never market them as bulletproof.
- 📋 **Rowan's Law (Ontario, mandatory since 2019)**: athletes u26, parents of u18s,
  coaches, trainers, officials must **annually** (within 12 months before registration)
  review Concussion Awareness Resources + acknowledge the org's **Concussion Code of
  Conduct**; orgs must gate registration on it (OBA blocks league registration until the
  whole team has acknowledged). This is a *legally required* waiver-engine use case, not
  optional — ties to [[concussion-rowans-law]].
- **LeagueApps parity bar**: multiple waivers per registration flow, e-sign now mandatory,
  generated PDF with waiver name, participant, signer name, e-signature, IP address, and
  acceptance date, downloadable from console. We should match the PDF/audit format.

## Scope

- **Waiver document model** (per club AND per league, versioned): title, body (rich text),
  type (acknowledgment-of-risk / indemnity / concussion code / custom), audience
  (participants of a program | team roster in a league season), required/optional,
  annual-renewal flag (Rowan's Law needs yearly re-acknowledgment).
- **Template library**: provided starters — Acknowledgment of Risk & Indemnity (Ontario-
  structured), Concussion Code of Conduct (Rowan's Law), photo/media consent, school-
  facility conduct. Club/league can customize text; version bump on edit.
- **League auto-send flow (owner's headline)**: on roster **submission approval** for a
  league season → email every parent/guardian on the roster a signing link (reuse OCI
  email + magic-token pattern); track per-player status; league dashboard shows
  signed/outstanding per team; optional gate: player ineligible until signed.
- **Club flow**: attach waiver(s) to any registration path (tryout/camp/house-league/
  offer acceptance) as a blocking form step.
- **E-signature capture** (reuse SignaturePad), stored with signer name, participant,
  version, timestamp, IP → **PDF render matching the LeagueApps audit bar**.
- **Admin views**: who signed what/when/which version; expiring annual acknowledgments;
  CSV export.

## Acceptance

- League approves a roster → parents receive waiver emails automatically; league sees
  per-team signed/outstanding and can gate eligibility.
- A club can require a customized waiver at any registration path; parent must sign
  before the signup completes; signed record retrievable with version + timestamp + IP.
- Annual-renewal waivers re-trigger within 12 months per Rowan's Law.

## Dependencies

registration-forms (can render as a form step)

## Refs

[[registration-forms]] · [[concussion-rowans-law]] · [[leagueapps-comparison]] ·
[[requirements-map]] · [[coverage-audit]] · [[_moc-compliance]]

⬅ [[_dashboard|Roadmap dashboard]] · [[_moc-compliance]]
