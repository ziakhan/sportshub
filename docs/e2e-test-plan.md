# End-to-End Test Plan: Youth Basketball Hub

## Phase 0: Prerequisites & Setup

1. Fresh database seed (`npx prisma db seed`)
2. Verify dev server runs on `localhost:3000`
3. Verify all 10 seed accounts can log in (password: `TestPass123!`)

---

## Phase 1: Registration & Onboarding

| # | Scenario | Status | Notes |
|---|----------|--------|-------|
| 1.1 | **Parent registers** — signup with email/password, select "Parent" role, complete profile form | ✅ Built | |
| 1.2 | **Parent adds child (under 13)** — via `/players/add`, verify COPPA fields (`isMinor`, `consentGiven`, `canLogin=false`) | ✅ Built | |
| 1.3 | **Parent adds child (13+)** — same flow but `canLogin` can be true | ✅ Built | |
| 1.4 | **Player (13+) self-registers** — signup, select "Player" role, complete player profile, verify `parentId = user.id` | ✅ Built | |
| 1.5 | **Staff member registers** — signup, select "Staff" role, complete staff onboarding | ✅ Built | |
| 1.6 | **Club Owner registers** — signup, select "ClubOwner", verify redirect to `/clubs/create` (skips profile form) | ✅ Built | |
| 1.7 | **League Owner registers** — signup, select "LeagueOwner", complete league profile | ✅ Built | |
| 1.8 | **Referee registers** — signup, select "Referee", complete referee profile | ✅ Built | |
| 1.9 | **Duplicate email rejected** — try signing up with existing email | ✅ Built | |
| 1.10 | **Invalid password rejected** — weak password validation | ✅ Built | |

---

## Phase 2: Club Setup & Staff Management

| # | Scenario | Status | Notes |
|---|----------|--------|-------|
| 2.1 | **Club Owner creates club** — name, slug, branding, timezone | ✅ Built | |
| 2.2 | **Club Owner invites staff by email** — via `/clubs/[id]/staff`, creates `StaffInvitation` (type=INVITE) | ✅ Built | |
| 2.3 | **Staff accepts invitation** — via `/api/invitations/[id]`, creates UserRole with designation | ✅ Built | |
| 2.4 | **Staff declines invitation** — status updates to DECLINED | ✅ Built | |
| 2.5 | **Staff requests to join club** — type=REQUEST flow | ✅ Built | |
| 2.6 | **Club Owner removes staff** — via staff management page | ✅ Built | |
| 2.7 | **Verify notifications created** for invite/accept/decline events | ✅ Built | In-app only, no email |

---

## Phase 3: Team Creation & Staff Assignment

| # | Scenario | Status | Notes |
|---|----------|--------|-------|
| 3.1 | **Create team** — name, ageGroup, gender, season | ✅ Built | |
| 3.2 | **Assign existing staff as HeadCoach** during team creation | ✅ Built | |
| 3.3 | **Assign existing staff as AssistantCoach** during team creation | ✅ Built | |
| 3.4 | **Invite new staff by email** during team creation | ✅ Built | Creates StaffInvitation |
| 3.5 | **Edit team** — update details, change staff | ✅ Built | |
| 3.6 | **Verify staff gets scoped UserRole** — `teamId` set on UserRole | ✅ Built | |

---

## Phase 4: Tryout Creation & Discovery

| # | Scenario | Status | Notes |
|---|----------|--------|-------|
| 4.1 | **Club creates tryout** — title, ageGroup, gender, date, location, fee, maxParticipants | ✅ Built | |
| 4.2 | **Link tryout to team** — optional `teamId` association | ✅ Built | |
| 4.3 | **Publish tryout** — via `/api/tryouts/[id]/publish` | ✅ Built | |
| 4.4 | **Tryout appears in marketplace** — `/marketplace` page | ✅ Built | |
| 4.5 | **Parent signs up child for tryout** — via `/tryouts/[id]` signup form | ✅ Built | |
| 4.6 | **Player (13+) signs up self** — same flow | ✅ Built | |
| 4.7 | **Cancel tryout signup** | ✅ Built | |
| 4.8 | **Max participants enforced** — signup rejected when full | ✅ Built | Verify logic exists |
| 4.9 | **Unpublish tryout** — removed from marketplace | ✅ Built | |

---

## Phase 5: Offers & Team Finalization ⚠️ NEEDS BUILDING

| # | Scenario | Status | What's Needed |
|---|----------|--------|---------------|
| 5.1 | **Club reviews tryout signups** — list all signups for a tryout | ⚠️ Partial | API exists, needs management UI |
| 5.2 | **Club makes offer to player** — seasonFee, installments, expiresAt | ❌ No API | Need `POST /api/offers` |
| 5.3 | **Offer notification sent** — in-app + email | ❌ No email | Need email integration + notification creation |
| 5.4 | **Parent/Player views offer** | ❌ No page | Need `/offers` or `/offers/[id]` page |
| 5.5 | **Parent/Player accepts offer** | ❌ No API | Need `PATCH /api/offers/[id]` (status=ACCEPTED) |
| 5.6 | **Parent/Player declines offer** | ❌ No API | Need same endpoint (status=DECLINED) |
| 5.7 | **Offer expires automatically** | ❌ No logic | Need cron/check on `expiresAt` |
| 5.8 | **Accepted offer → TeamPlayer created** | ❌ No logic | On accept, create `TeamPlayer` record |
| 5.9 | **Club views finalized roster** | ❌ No page | Need team roster page showing TeamPlayers |

---

## Phase 6: Payment Flows ⚠️ NEEDS BUILDING

| # | Scenario | Status | What's Needed |
|---|----------|--------|---------------|
| 6.1 | **Tryout fee payment** — Stripe checkout on signup | ⚠️ Partial | Stripe package exists, flow not wired |
| 6.2 | **Season fee payment** — on offer acceptance | ❌ | Need payment flow tied to offers |
| 6.3 | **Installment payments** — recurring payments | ❌ | Schema supports it, no logic |
| 6.4 | **Payment receipt/confirmation** | ❌ | Need notification + email |
| 6.5 | **Refund on signup cancellation** | ❌ | Need refund logic |

---

## Phase 7: League Setup & Season Management ⚠️ NEEDS BUILDING

| # | Scenario | Status | What's Needed |
|---|----------|--------|---------------|
| 7.1 | **League Owner creates league** | ⚠️ Partial | Onboarding creates League, no full management |
| 7.2 | **Create season** — start/end dates, enrollment deadline | ❌ | No Season model (could use League fields or new model) |
| 7.3 | **Define divisions** — age brackets, gender, max team capacity | ⚠️ Partial | `LeagueDivision` exists in schema, no API/UI |
| 7.4 | **Club submits team to league** | ❌ | Need `POST /api/leagues/[id]/teams` → creates `LeagueTeam` (PENDING) |
| 7.5 | **League reviews team submissions** | ❌ | Need league management page |
| 7.6 | **League approves/rejects teams** | ❌ | Need `PATCH /api/leagues/[id]/teams/[teamId]` |
| 7.7 | **League registration fee payment** | ❌ | Need payment flow |
| 7.8 | **Enrollment deadline enforced** | ❌ | Need date check logic |
| 7.9 | **League finalizes season** — locks rosters | ❌ | Need finalization endpoint |

---

## Phase 8: Venues & Scheduling ⚠️ NEEDS BUILDING

| # | Scenario | Status | What's Needed |
|---|----------|--------|---------------|
| 8.1 | **League defines venues** | ❌ | Need `POST /api/leagues/[id]/venues` or venue management |
| 8.2 | **League defines days of play** | ❌ | No day-of-play model — need schema addition |
| 8.3 | **System generates game schedule** | ❌ | Need scheduling algorithm (round-robin per division) |
| 8.4 | **View generated schedule** | ❌ | Need schedule page |
| 8.5 | **Reschedule/cancel game** | ❌ | Game model supports status changes, no API |
| 8.6 | **Venue conflict detection** | ❌ | Need overlap checking logic |

---

## Phase 9: Game Day & Scoring ⚠️ NEEDS BUILDING

| # | Scenario | Status | What's Needed |
|---|----------|--------|---------------|
| 9.1 | **Scorekeeper records game events** | ❌ | `GameEvent` model exists, no API |
| 9.2 | **Record player stats** | ❌ | `PlayerStat` model exists, no API |
| 9.3 | **Finalize game score** | ❌ | Need `PATCH /api/games/[id]` (finalizedAt) |
| 9.4 | **View standings** | ❌ | Need standings calculation from Game results |

---

## Phase 10: Communication & Notifications

| # | Scenario | Status | What's Needed |
|---|----------|--------|---------------|
| 10.1 | **In-app notifications display** | ✅ Built | Notification bell + page |
| 10.2 | **Mark notification as read** | ✅ Built | |
| 10.3 | **Email notifications** | ❌ | No email provider integrated |
| 10.4 | **Club announcements** | ❌ | `Announcement` model exists, no API/UI |
| 10.5 | **Team announcements** | ❌ | Same |

---

## Additional Scenarios (Not in Original List)

| # | Scenario | Category |
|---|----------|----------|
| A1 | **Referee assignment to games** | Game Management |
| A2 | **Referee fee payment per game** | Payments |
| A3 | **Club branding on tenant subdomain** | Multi-tenancy |
| A4 | **Role-based dashboard content** — each role sees different dashboard | Permissions |
| A5 | **CASL permission enforcement** — staff can't edit other clubs, parents can only see own kids | Security |
| A6 | **COPPA compliance** — under-13 player can't self-register, can't login without parent consent | Compliance |
| A7 | **Multi-role users** — user with both Parent and Staff roles | Edge case |
| A8 | **Club subscription tiers** — FREE/BASIC/PRO/ENTERPRISE feature limits | Payments |
| A9 | **Audit logging** — verify actions create AuditLog entries | Compliance |
| A10 | **Reviews/ratings of clubs** | Social |
| A11 | **Practice scheduling** | Team Management |
| A12 | **Player stat aggregation** across games/season | Reporting |

---

## Implementation Priority

To make the full E2E flow testable, build in this order:

1. **Offer APIs + UI** (Phase 5) — critical link between tryouts and team finalization
2. **League management APIs + UI** (Phase 7) — division CRUD, team submission, approval
3. **Email integration** (Phase 10) — pick a provider (Resend is simplest for Next.js)
4. **Scheduling algorithm** (Phase 8) — round-robin generator per division
5. **Payment flows** (Phase 6) — wire Stripe checkout into tryout signup and offer acceptance
6. **Game day APIs** (Phase 9) — scoring, stats, standings

---

## Summary

- **Phases 1–4**: Fully testable today
- **Phase 5 onward**: Requires new API routes, pages, and integrations
- **32 database models** exist covering the full domain — most backend schema is ready
- **Key gaps**: Offer management, league admin, email delivery, scheduling engine, payment wiring
