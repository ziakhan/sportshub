---
updated: 2026-07-08
status: draft
tier: 2
area: identity
effort: L
source: owner
tags: [theme/identity, type/plan, status/draft]
---

# 🪪 Universal @handles — reserve, search, resolve

**Tier 2 · effort L · from owner · DRAFT (rough plan; detail later).** One global,
Instagram-style handle namespace for every identity — clubs, leagues, teams,
players, users. **Phase 1 is just reservation + resolution**; tagging/follows come
later.

## Problem
Entities have inconsistent public URLs (clubs use `slug`, leagues/teams/players use
raw UUIDs) and there's no reservable personal identity. We want `@handle` as the
universal, searchable, memorable address — and we want people to be able to claim
theirs **now** before the namespace fills up.

## Scope (Phase 1 — reserve only)
- Central **Handle registry** so one namespace is unique across all entity types.
- Claim/reserve a handle from settings for a user / club / league / player (team later).
- Uniqueness + normalization + reserved-word enforcement; search-by-handle.
- `/@handle` resolves to the entity's existing public page (render or redirect).
- **No** tagging, follows, or permissions yet.

## Research & rough architecture (multi-tenant handle routing)

**What we already have:** `Tenant.slug` (unique) + `Tenant.customDomain` (unique) +
subdomain routing in `middleware.ts` (`x-tenant-slug`); `TenantBranding`; clubs at
`/club/[slug]`, others at `/{league,team,player}/[id]`. No `handle`/`username` field.

**Model — one central registry (recommended)** over per-model `handle` fields:
```
Handle { handle @unique (normalized), displayHandle, ownerType (USER|CLUB|LEAGUE|TEAM|PLAYER),
         ownerId, status (RESERVED|ACTIVE), createdAt }  + prior-handle redirects later
```
Why central: a single global namespace (a club and a user can't collide), atomic
reservation, one search index, entity-agnostic resolver. A user may own several
handles (their personal one + their club's) — `ownerType/ownerId` covers it.

**Normalization / rules:** lowercase; `[a-z0-9._]`; length 3–30; no leading/trailing
or doubled separators; case-insensitive uniqueness; profanity/impersonation guard (later).

**Reserved words (block):** our ~18 top-level routes (`club, league, leagues, team,
player, news, scores, live, marketplace, events, camp, house-league, tournament,
tryout, invitations, for-clubs, for-leagues, style-guide`) + system words (`admin,
api, app, www, help, support, about, settings, dashboard, manage, sign-in, sign-up,
onboarding, welcome, post-login`).

**Routing — three options:**
- **A) `/@handle` sigil (RECOMMENDED)** — Threads/Mastodon-style. The `@` never
  collides with our routes, so the handle namespace stays cleanly separate. One
  resolver route looks up the registry → renders/redirects to the entity page.
  *(Next.js note: `@` is special in folder names — implement as a normal dynamic
  segment whose value carries the `@`, not an `app/@[handle]` folder.)*
- **B) subdomain `handle.domain`** — heavier (wildcard DNS); we already have the
  infra. Best kept as a **club/league premium** ("your own subdomain"), not the default.
- **C) bare `/handle`** (GitHub/Instagram) — needs a strict, permanent reserved list
  and risks colliding with every future route. Not recommended.
- **Recommendation:** `/@handle` universal default; keep subdomain + `customDomain`
  as the club premium tier.

## Acceptance (Phase 1)
- Any user/club/league/player can reserve a unique handle; duplicates + reserved words are rejected.
- `/@handle` loads that entity's public page; unknown handle → 404.
- A handle search finds the entity.

## Dependencies
none (foundational). Enables [[customizable-pages]] and future tagging.

## Open questions (for the detailed plan)
- Handle changes + old→new redirects / history? Verified badges? Anti-squatting policy?
- Migrate existing club `slug` → handle, or keep both?
- One personal handle per user vs. only entity handles?

## Refs
[[customizable-pages]] · [[player-profile-privacy]] · [[_moc-identity]] · [[requirements-map]] · [[coverage-audit]] · [[_moc-content-ux]]

⬅ [[_dashboard|Roadmap dashboard]] · [[_moc-identity]]
