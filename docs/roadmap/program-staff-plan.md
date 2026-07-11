---
updated: 2026-07-11
status: shipped
tier: 1
area: platform
effort: M
source: owner
tags: [theme/platform, type/plan, status/shipped]
---

# 👥 Program staff — a person in charge of every camp / house league — ✅ SHIPPED 2026-07-11 (camps + HL; tournaments deferred by owner)

**Owner direction (2026-07-11):** programs (camps, house leagues — probably
tournaments too, undecided) should have assignable staff: a lead (the person
in charge, e.g. lead coach) plus helpers (assistant coaches). Not mandatory
at creation; assignable any time after. Assigned people should see their
programs. Separately: coaches (Staff role) must NOT see program-creation
options — that's club-admin turf (fix shipping with this batch).

## Schema (proposed — additive)

```prisma
enum ProgramStaffDesignation { LEAD, ASSISTANT }
enum ProgramType { CAMP, HOUSE_LEAGUE, TOURNAMENT }

model ProgramStaff {
  id            String
  programType   ProgramType
  programId     String   // soft ref (Camp/HouseLeague/Tournament by type)
  userId        String   // FK User, cascade
  designation   ProgramStaffDesignation @default(ASSISTANT)
  assignedById  String
  createdAt     DateTime
  @@unique([programType, programId, userId])
  @@index([userId])
  @@index([programType, programId])
}
```

Soft polymorphic ref mirrors `EventRsvp` (three program tables, no shared
parent). Reusing `UserRole` would mean three more nullable scope FKs — the
game-scoped referee precedent exists, but `UserRole` drives global nav/role
logic and program assignment shouldn't imply a platform role.

## Behavior

- **Assign UI** on the club's camp/HL manage pages: pick from the club's
  existing staff (Staff/TeamManager/ClubManager UserRole holders) with a
  designation; add/remove any time. (Invite-by-email for non-members can
  reuse StaffInvitation later — v2.)
- **Visibility:** assigned staff get a "My Programs" block (staff dashboard
  section + staff sidebar) listing their camps/HLs with dates and links.
- **Access level — OWNER DECIDED 2026-07-11: manage-lite.** Assigned staff
  see the program, view registrants, run check-in, and edit description/
  schedule. Pricing, publish/unpublish, delete stay club-admin-only.
- **Tournaments — OWNER DECIDED 2026-07-11: deferred, but plan it.**
  Owner's notes to design against later: tournaments run league-like and
  need a **Tournament Lead / director** role; venues must be decided;
  likely schedule generation; referees and scorers get assigned; usually
  ONE session (a weekend or a week) rather than a season. "Very similar
  configuration to a league but with some differences." Design tournament
  staffing together with that pass — don't bolt the camp model onto it.

## Out of scope (this pass)
- Program dates as My Calendar lenses (noted in [[my-calendar-plan]] follow-ups)
- Pay/comp for program staff; scheduling staff shifts

## Refs
[[my-calendar-plan]] · [[feature-backlog]] · [[coverage-audit]]
