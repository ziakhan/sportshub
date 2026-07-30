# League Operators (Organizations) + Two-Level Season Registration

> Status: **V1 SHIPPED 2026-07-29 night** (owner: "go ahead and finish them"). Decisions taken (owner delegated): deposit attaches at TEAM approval; over-plan submissions allowed (approval is the gate, Entries view flags planned-vs-submitted); operator page public day one.
> Shipped: Organization + branding inheritance (resolved in getPublicSeason so web+mobile inherit identically) + /org/[slug] + "Run by" chip · WaiverDocument.audience (CLUB_OFFICIAL signed at entry; parent flows audience-scoped) · ClubSeasonEntry (planned teams, application answers from Season.applicationQuestions, typed signature) + club Enter form (/seasons/[id]/enter + public-page link) + league Entries panel w/ approve/decline · deposit schedules (Season.depositPct, balance due start-14d, deposit-paid badges) · season clone ("Renew" deep-copy) · season-scoped club blasts.
> Still open: OrgAdmin role wiring into league authz (enum/column only), TeamSubmission.entryId linkage + entry-required enforcement mode, org staff management UI.
> Companions: docs/research/nph-fall-winter-2026-alignment.md (G1 questions, G2 deposits, G4 = this doc).

## 1. Owner rulings (2026-07-29)
- **League names persist year over year** ("Showcase League", "Summer League", "Rep League", "Academy League") and are *renewed* each year. → Matches the existing model exactly: `League` is the permanent product, `Season` is the yearly instance. NO change to that layer.
- **The operator stays the same** across all of a group's leagues → new `Organization` layer ABOVE League.
- **Staff:** some users manage *everything* the operator runs; others manage *one league*. Both assignable.
- **Club T&C is signed by clubs, not parents** (owner caught the demo bug: the registration T&C rendered as a per-player parent waiver — fixed in seed; the real fix is the audience field below).
- **Registration is TWO commitments, not one** (owner insight from NPH's real form): first the **club** commits to the season — application answers, program identity, planned team counts (lets the league plan courts/capacity) — then **individual teams** are registered under that commitment by club staff. The long application questionnaire belongs to the CLUB step, never per team.

## 2. Schema (additive)

```prisma
model Organization {           // the league operator, e.g. North Pole Hoops
  id           String  @id @default(uuid())
  name         String                      // "North Pole Hoops"
  slug         String  @unique
  logoUrl      String? @db.Text            // leagues inherit unless overridden
  bannerUrl    String? @db.Text
  primaryColor String?
  tagline      String?
  socials      Json?
  description  String? @db.Text            // operator boilerplate block
  leagues      League[]
}
// League: + organizationId String? (nullable — standalone leagues stay valid)
// UserRole: role OrgAdmin w/ organizationId scope (new column, like tenantId/leagueId)
```

**Inheritance rule:** league branding fields become *overrides* — render `league.logoUrl ?? org.logoUrl` etc. League pages show "Run by {org.name}" linking `/org/[slug]` (public operator profile listing all its leagues — replaces today's hack of stamping every NPH-owned league with the same branding via updateMany in the seed).

**Operator-level resources** (move up or share): waiver templates/documents (ONE T&C for all leagues), referee pool, venue list. League-level keeps: seasons, divisions, fees, rules-of-play settings.

```prisma
model ClubSeasonEntry {        // level 1: the CLUB's commitment to a season
  id            String @id @default(uuid())
  seasonId      String
  tenantId      String
  status        EntryStatus    // DRAFT SUBMITTED APPROVED REJECTED WITHDRAWN
  plannedTeams  Json?          // {"U13-T1": 2, "U15-T1": 1} — capacity planning
  answers       Json?          // G1 application questions (synopsis, vision, ...)
  signedById    String?        // club official who e-signed the T&C
  signedAt      DateTime?
  signatureData String? @db.Text
  @@unique([seasonId, tenantId])
}
// TeamSubmission: + entryId String? → level 2 hangs off the club entry.
// SeasonQuestion (G1): per-season question builder; answers stored on the ENTRY.
// WaiverDocument: + audience WaiverAudience @default(PARENT)  // PARENT | CLUB_OFFICIAL
//   CLUB_OFFICIAL docs are signed once on the ClubSeasonEntry; never emailed to parents.
```

## 3. Flows
- **Club side:** "Enter {season}" on the season page → entry form (application questions + planned team counts + club official signs the T&C) → league approves the ENTRY → club then registers teams one by one (existing TeamSubmission flow, now lightweight: division + roster only) up to/adjusting their plan.
- **League side:** season gets an **Entries** view (clubs, planned counts vs actual submissions, answers, signature state) feeding capacity planning; Teams tab unchanged underneath.
- **Deposits (G2):** the 50% deposit obligation attaches at entry approval or first team approval (owner call), balance auto-due at season start − 14d, reusing installment math + overdue nags.

## 4. Build order + sizing
1. `Organization` + inheritance rendering + `/org/[slug]` + OrgAdmin role — **M**
2. `WaiverDocument.audience` + club-official signing on entry — **S-M**
3. `ClubSeasonEntry` + entry flow + Entries view + TeamSubmission.entryId — **M-L**
4. `SeasonQuestion` builder (G1) on the entry form — **S-M** (shrinks: one form per club, not per team)
5. Deposit schedule (G2) — **S-M**
Total ≈ the pre-pitch package; 3-5 focused days with tests.

## 5. Open owner decisions
- Deposit trigger: entry approval vs first team approval?
- Can a club register MORE teams than planned without league sign-off?
- Operator profile page public at launch, or after claiming exists for leagues?
