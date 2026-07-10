---
updated: 2026-07-09
status: shipped
tier: 1
area: platform
effort: L
source: owner
tags: [theme/platform, type/plan, status/proposed]
---

# 🔄 Season continuity — finishing a season and starting the next

**Owner ask (2026-07-09):** how do clubs finish a season and continue to the next? Teams don't
come back identical — the coach may stay, the roster mostly turns over, kids age up. Fall/spring →
summer → fall/spring must be easy for clubs. League seasons don't "continue" (everyone re-submits),
they complete → lock → archive, and a new season is created. Plus: re-engagement email (invite
last year's families to tryouts, renew a house league, remind clubs a league season is open) and
the consent architecture that legally allows it.

---

## 1. Ground truth (verified in code, 2026-07-09)

| Fact | Consequence |
|---|---|
| `Team` is a **permanent row**; `Team.season` is a free-text display string; **no archive/status field, no lineage field** | Dead teams accumulate forever in the club UI; "Huskies U13 2025-26" and "Huskies U14 2026-27" have no relationship |
| League side is **already instance-based**: `League` (permanent) → `Season` (instance) → submissions/rosters/games; rosters freeze per season; status now validated one-way through COMPLETED | The owner's league mental model is ~already built — only close-out UX + re-registration reminders are missing |
| `TeamPlayer` has ACTIVE/INACTIVE; roster membership never expires by season | Last season's kids stay "on the team" forever unless manually released |
| The **offer pipeline is the only onboarding rail** (tryout → offer → accept → roster + payment); `PlayerInvitation` (invite-by-email → offer) already exists | Rollover should reuse offers — they already carry fees, sizes, consent, payment |
| Offer templates are per-team; practice slots are per-team | A "new season team" loses both unless we copy them |
| Email infra = `sendEmail` + 3 transactional senders (offer, player-invite, staff-invite). **Zero** marketing/blast capability, **zero** unsubscribe/consent infrastructure of any kind | Re-engagement email is a new feature AND a compliance surface (CASL — we're Canadian) |

## 2. The core design: club teams become "programs with season instances" — lightly

Don't restructure the schema into Program/TeamSeason (invasive; games, stats, chat, offers all FK
to Team). Instead, keep `Team` and add **archive + lineage + a rollover wizard**:

**Schema (additive):**
```prisma
model Team {
  archivedAt        DateTime?   // hidden from active lists; history intact
  continuedFromId   String?     // lineage: the previous season's team
  continuedFrom     Team?       @relation("TeamLineage", ...)
  continuations     Team[]      @relation("TeamLineage")
}
```

**The "Start next season" wizard** (entry: button on an active-but-ending or archived team, plus a
club-dashboard nudge when a linked league season hits COMPLETED):

1. **Archive** the old team (`archivedAt = now`) — club Teams page defaults to active with an
   "Archived (N)" toggle; public/team pages, games, stats keep working (read-only history).
2. **Create the new team** prefilled: name (with suggested **age-up**, U13 → U14), same
   ageGroup+1/gender, new season label; `continuedFromId` set.
3. **Staff carry-over**: checkboxes per staff member (head coach usually stays) — creates the
   UserRole rows on the new team.
4. **Player carry-over**: pick returning players from the old roster → the wizard generates
   **offers** (using a chosen offer template) — the family accepts/pays exactly like a tryout
   offer. Not picked = not contacted (they can still come through tryouts). This is the
   "auto-offer some players spots for next season" ask, built on the rail that already exists.
5. **Copies**: offer templates (duplicated to the new team) and optionally the practice-slot
   weekly pattern. Old team chat archives read-only (fork: or stays open 30 days — owner call).
6. **Next steps card**: "Create tryout for remaining spots" (pre-linked to the new team) +
   "Notify last season's families" (→ §4 messaging).

Why this shape: zero disruption to existing FKs, history stays truthful (2025-26 standings show
the 2025-26 team), lineage enables future multi-season player/program stats, and the offer rail
means rollover inherits payments, sizes, jersey prefs, and consent for free.

## 3. League seasons: close-out is 90% built — finish the last 10%

Per the owner: league seasons **don't continue** — clubs re-submit every time. Current machinery
already matches. Remaining gaps:

- **"Complete season" close-out moment**: when status → COMPLETED, show a summary (final
  standings, champions, stats leaders) + a "Create next season" button that prefills from the old
  one (divisions layout, fees, scoring config — NOT teams). Divisions/venues copy is a convenience,
  not a link.
- **Archived-but-viewable**: public season page already persists; add a "Past seasons" section on
  the league page/manage list so history is browsable instead of buried.
- **Re-registration reminder** (→ §4): when a new season opens REGISTRATION, one-click "Notify
  clubs from past seasons" — audience = ClubOwners/Managers of every tenant with a submission in
  any prior season of this league. This is org-to-org (business contact), the legally easy case.

## 4. Re-engagement messaging ("Messages" for clubs & leagues)

New feature, one composer, **audiences derived from engagement data** (no manual lists):

| Sender | Audience options (computed) |
|---|---|
| Club | A team's roster families (current or a past/archived team) · past registrants of a specific camp / house league / tryout · **everyone who ever engaged with the club** (union) |
| League | Club owners/managers of teams from past seasons · (later) followers |

Composer: subject + body (merge fields: player first name, program name, CTA link), preview,
send. Every send is logged (`MessageLog`) with audience snapshot; per-recipient suppression from
§5 consent is applied at send time. Primary use cases, all owner-named:
- **Team continuation**: "U14 is forming — tryouts May 12" to last season's U13 families (pairs
  with the wizard's carry-over offers for the invited-back subset).
- **House league / camp renewal**: "Duplicate as new" button on an ENDED camp/HL (clone → new
  dates → DRAFT) + blast to past registrants when published.
- **League registration open**: reminder to past-season clubs.
- **Blanket club promo**: the generic "email everyone who's engaged with us."

Rate-limit per org (e.g. N sends/day), require verified org (ACTIVE tenant), and route through
the existing email lib.

## 5. Consent & CASL — the owner's question: is one consent enough?

**No — and Canadian law agrees with your instinct.** Under CASL, the *sender* of a commercial
electronic message is the club or league, not the platform. Consent attaches to the relationship
with that specific organization:

- **Transactional messages** (offer notifications, receipts, game changes, invite emails —
  everything we send today) are fine and stay outside marketing consent.
- **Marketing/re-engagement** (all of §4) needs consent per sending org: **express** (a checkbox)
  or **implied** via *existing business relationship* — a registration/purchase gives ~2 years of
  implied consent with that org. Registration IS the relationship, so past camp families are
  emailable by that club out of the box — but only that club, with expiry.

**Model (additive schema):**
```prisma
model CommunicationConsent {
  userId    String
  scope     ConsentScope   // PLATFORM | TENANT | LEAGUE
  tenantId  String?        // exactly one of these per scope
  leagueId  String?
  status    ConsentStatus  // EXPRESS | IMPLIED | WITHDRAWN
  source    String         // "registration:camp:<id>" | "checkbox:signup" | "unsubscribe-link"
  lastEngagedAt DateTime   // rolls forward on each new registration → implied-consent window
  @@unique([userId, scope, tenantId, leagueId])
}
```
- Registration flows upsert IMPLIED consent for that org (+ an optional express checkbox: "Email
  me about future programs from {Club}").
- Signup gains a platform-scope checkbox for platform news (separate from org consent).
- **Every §4 email**: footer identifies the org + platform and carries two unsubscribe links —
  "from {Club}" (org-scope WITHDRAWN) and "manage all" → `/settings/communications` preference
  page (per-org toggles + global). Withdrawal is send-time enforced via suppression check.
- IMPLIED consent older than the window (~2y since `lastEngagedAt`) is skipped at send time.

So: **three consent layers — platform, per-club, per-league** — with implied consent doing most
of the work automatically and express checkboxes strengthening it. One global consent would both
over-send (org the user never wanted) and under-protect us legally.

## 6. Same-lines adjacencies (catalogued, not all wave-1)

- **Age-up suggestion** in the wizard (U13→U14) — trivial once rollover exists.
- **Player season history**: lineage + SeasonRoster snapshots enable "played 3 seasons with
  Huskies" on player pages later.
- **Waitlist for renewed programs** (dead `WAITLISTED` enum) — natural once HL renewal + blasts
  create demand spikes.
- **Tryout auto-link**: wizard's "create tryout" pre-targets the new team (exists today via
  pre-select).
- **Referee/scorekeeper pools** are per-league and persist — no season work needed.
- **Club dashboard season-awareness**: "3 teams ended their season — start next season?" nudge.

## 7. Build increments — ✅ ALL FIVE SHIPPED 2026-07-09 (local, unpushed)

1. ✅ **Archive + lineage + wizard core** — `Team.archivedAt` + `continuedFromId`
   ("TeamLineage" self-relation, runbook #20), archive/rollover APIs, 4-step
   "Start next season" wizard (staff carry-over, grade-aware age-up). E2E-proven.
2. ✅ **Carry-over offers** — wizard step 4 stages offers via `createOfferForPlayer`.
3. ✅ **League close-out** — complete-season summary, "Create next season" prefill,
   past-seasons list.
4. ✅ **Consent foundation** — `CommunicationConsent`/`MessageLog` (runbook #19),
   registration upserts, `/settings/communications`, HMAC unsubscribe, marketing
   footers (shipped FIRST, in Phase 1, before any composer).
5. ✅ **Messages composer + audiences + logs** (clubs + leagues) + camp/HL
   "Duplicate as new". Consent-enforced at send time — live-verified
   ("Sent to 1, 28 skipped for consent").

## 8. Owner decision forks — ✅ ALL DECIDED 2026-07-09

1. Old team chat after archive: **read-only immediately**.
2. Carry-over offers: **staged as drafts + one "Send all" click** (club reviews fees first).
3. Express-consent checkbox: **unchecked** (strict CASL posture; implied consent still applies).
4. Platform-scope marketing: **build now** — admin-side platform composer ships with the
   club/league composer (phase 3), on the same consent rail (PLATFORM scope).
5. League re-engagement audience: **Owners + Managers only** (no team staff).

Related decisions from the same session: account deletion = soft-delete **keeping historical
names** in past box scores/rosters; reviews = **relationship-gated + author edit/delete + admin
moderation queue**; TenantFeatures = **wire a `hasFeature()` helper with all flags ON, no
enforcement** until pricing launches.

⬅ [[_dashboard|Roadmap dashboard]] · related: [[editability-audit]] · [[feature-backlog]] · `docs/league-v2-plan.md`
