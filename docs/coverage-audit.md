---
updated: 2026-07-08
tags: [theme/system, type/reference, status/living]
---

# 🧭 Coverage Audit — how complete is the platform?

**Layer 1 audit** (2026-07-08): *what's built vs. what we planned*, across all 11
personas + integrations. Derived by enumerating the code (`scripts/coverage-audit.ts`
→ 136 API routes · 91 pages · 73 models) and a judged read of every surface by
persona.

> **Honest caveats.** (1) "Built" ≠ "works" — code presence is structural; correctness
> still comes from tests + verify runs. (2) This is Layer 1 only: it measures us against
> *our own* target. The full-requirements question ("is what we planned the complete
> platform?") is **Layer 2**, not yet run — expect real additions there (safety screening,
> emergency/medical, tax receipts, refunds UI, etc.). (3) %s below are **directional
> judgment**, not measured.
>
> Refresh: re-run `npx tsx scripts/coverage-audit.ts` for the surface inventory; re-run
> the persona sweep for the judged status. Companion view: [[_moc-shipped|What's Built]].

**Legend:** ✅ done · 🟡 partial · 🔌 disconnected (built one side, not wired) · 🔒 gated (intentional) · ⛔ missing

## Snapshot — completeness by persona

| Persona | Rough coverage | Headline gaps |
|---|---|---|
| Anonymous visitor | ~95% | global search is weak |
| **Parent** | ~80% | 🔌 camp & house-league signup unreachable; tryout-pay copy stale; no notif prefs |
| **Player (13+)** | ~70% | ⛔ no self-onboarding; player-invite accept UI unclear |
| ClubOwner | ~88% | logo/profile write-once; ⛔ club-wide announce; ⛔ surveys |
| ClubManager | ~88% | same as owner |
| Staff / Coach | ~85% | 🟡 can create but not *publish* tryouts |
| TeamManager | ~85% | same as coach |
| LeagueOwner | ~85% | ⛔ playoff generation; ⛔ league-wide event push (API-only); currency uneditable |
| LeagueManager | ~85% | same as league owner |
| **Referee** | ~80% | ⛔ never paid in-product (fee is display-only) |
| **Scorekeeper** | ~30% | 🔌 **role is a dead end — can't actually score** |
| PlatformAdmin | ~85% | ⛔ content moderation UI; analytics = count tiles only |

**Overall read:** the operational core is *far* more complete than doc-status implied —
most personas are 80–90% functional end-to-end. Completion is concentrated in a
**short list of high-leverage gaps** below, several of which are cheap "wire the last
mile" fixes rather than net-new builds.

## 🔧 Gap register (ranked)

### Tier 1 — Disconnected: built but unreachable (highest ROI — wiring, not building)
1. 🔌 **Camp registration** — `api/camps/[id]/signup` works, but the public camp page's only CTA bounces to `/dashboard`. Parents can't register for camps. *(0 UI callers)*
2. 🔌 **House-league registration** — identical to camps; API built, no signup UI.
3. 🔌 **Scorekeeper can't score** — the `Scorekeeper` role is seeded and shows a "Score games" nav link, but `lib/scoring/authz.ts` only authorizes league owner + club staff → a scorekeeper-only user gets 403. Per-game `Game.scorekeepers` scoping is deferred.
4. 🔌 **Player-invitation accept** — `api/player-invitations/[id]` mints an offer on accept, but there's no clear family-facing accept screen (only *staff* invitations have one); 13+ self-claim path unclear.
5. 🟡 **Tryout payment** — signup creates a real payable obligation, but the form says "payment coming soon"; payment only happens later via `/payments`. Stale/confusing copy.

### Tier 2 — Missing capabilities (real, expected for this product)
6. ⛔ **Referee payouts** — a per-game fee is captured + displayed, but no obligation/payout/Connect for officials. Referees are never paid through the platform (contrast: league fees are fully wired).
7. ⛔ **Playoff generation** — `playoffFormat`/`playoffTeams` are saved, but the scheduler only produces `REGULAR` games; no bracket generation. *(known backlog item)*
8. ⛔ **Player (13+) self-onboarding** — player records are only created by a parent; no self-register path.
9. ⛔ **Broadcast comms** — no club-wide announcement, and league-wide event push is API-only (the only UI is scoped to one club's teams).
10. ⛔ **Refund initiation** — inbound `charge.refunded` is reconciled, but there's no admin/club UI to *start* a refund.
11. ⛔ **Content moderation (admin)** — no UI to unpublish/take down reviews or news/recaps.
12. ⛔ **Surveys** — polls exist (team-scoped); surveys do not.
13. ⛔ **Notification preferences + channel parity** — email fires ad-hoc per event (not from the central notify layer), bell covers ~40 event types, no per-user preferences, no push.

### Tier 3 — Partial / edit-gaps
14. 🟡 **Club branding write-once** — logo is a pasted URL at *create* only (no upload, not editable after); only `primaryColor` editable in settings; contact/address/description never editable.
15. 🟡 **League currency uneditable** — read for formatting, but not in the create form or update schema.
16. 🔌 **Team-level offer-templates** — the API exists but the page just redirects to the club-level one.
17. 🟡 **Media embeds** — `MediaAsset` supports video, but in practice recaps/news render images only; no YouTube/iframe embed render path found. *(verify — prior notes claimed YouTube highlights)*
18. 🟡 **Analytics** — admin has count tiles + recent lists only; no time-series.
19. 🟡 **Search** — client-side filter over the club directory; no global/entity search.

### Dead / orphaned endpoints (cleanup candidates)
- `api/tenants/lookup` — 0 references (subdomain routing is inline in middleware). Likely dead.
- `api/clubs/[id]/staff/requests` — self-serve "request to join as staff" API with no UI to submit or review.

## 🔌 Integrations

| Integration | Status | Note |
|---|---|---|
| Stripe — charges, card-on-file, Connect (club + league), webhooks, crons | ✅ | destination + direct; 6 webhook events; CRON_SECRET-guarded charge-due + reminders |
| Stripe — refunds | 🟡 | inbound reconciliation only; no initiate-refund UI |
| Stripe Connect — referee | ⛔ | no referee payout rail |
| Email | 🟡 | nodemailer/SMTP, default = Mailpit (dev). Real templates fire; **needs a prod SMTP provider**; no provider SDK; no prefs UI |
| Google Places (venues) | ✅ | graceful degrade without key |
| iCal feed | ✅ | per-user token, 180-day, cancellations |
| AI recaps (Anthropic) | ✅ | `claude-opus-4-8`, template fallback so recaps always publish |
| Media / video embeds | 🟡 | image in practice; video render path unconfirmed |
| Web push | ⛔ | not built (marketing tile says "coming soon") |
| SMS | ⛔ | not built |
| Calendar 2-way sync (Google/Apple) | ⛔ | iCal pull only |
| Neon | 🟡 | generic Postgres via Prisma; no Neon serverless driver |

## 🔒 Intentional (not gaps)
- **Family Pass paywall** — `hasFamilyPass()` returns `true` today; premium gate scaffolded for P3.
- **Marketing "COMING SOON" badges** on the homepage *understate* reality — live scoring and the notification bell are built; web-push is the only truly-missing piece behind those tiles.

## ✔️ Corrections to prior beliefs
- **Reviews are NOT hidden.** The long-standing note ("review system gated behind `{false && …}`, enable end of season") is **stale** — reviews render live on the public club page and the API works; a full scan found zero `{false &&}` in the app. *(Update CLAUDE.md / memory.)*

## How this stays current
- **Surface inventory** auto-refreshes from code: `npx tsx scripts/coverage-audit.ts` (counts, routes, integrations, hidden markers).
- **Judged status** (this doc) refreshes by re-running the persona sweep — no hand-maintained rows.
- **Next:** run **Layer 2 (requirements discovery)** to build the true denominator and turn "~85% of what we planned" into "~X% of a complete platform."

⬅ [[Home]] · see also [[_moc-shipped|What's Built]] · [[outstanding-items]] · [[feature-backlog]]
