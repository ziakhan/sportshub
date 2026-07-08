---
tags: [type/reference, moc/identity]
---

# 🪪 Identity & Pages (initiative)

**Owner vision (2026-07-08).** Give every entity — clubs, leagues, teams, players,
users — a **unique Instagram-style handle** (reservable now, searchable, taggable
later) and let clubs/leagues run their SportsHub page as a **customizable
"website"** (hero, branding, announcements, live stats/tryouts). Many clubs can't
afford a real website; the platform becomes it — and that's a stickiness + data
moat, and competitor parity (Jersey Watch / SportsEngine sell website builders).

Rough plans (draft — detail later):
- [[handles-identity]] — universal `@handle` namespace: reserve + search + resolve. **Do the reservation early (land-grab).** Includes the multi-tenant routing research. · `draft`
- [[customizable-pages]] — club/league customizable public page: hero + branding + announcements + auto-pulled stats/tryouts rail. · `draft`
- [[player-profile-privacy]] — simple public/private profile toggle (minor-safe, no follows yet). · `draft`

**Builds on what exists:** `Tenant.slug` + `customDomain` + subdomain middleware, `TenantBranding` (logo/colors), name-privacy (`MediaConsent`/`publicPlayerName`).
**Relates to:** [[_moc-content-ux]] · [[_moc-compliance]] (minor privacy/consent) · source [[requirements-map]]

⬅ [[Home]] · [[_dashboard|Roadmap dashboard]]
