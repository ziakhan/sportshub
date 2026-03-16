# Youth Basketball Hub - Implementation Summary

**Last Updated**: March 16, 2026

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Monorepo | Turborepo |
| Auth | NextAuth.js v4 (Credentials provider, JWT sessions, bcrypt) |
| Database | PostgreSQL + Prisma 5.8.1 |
| Permissions | CASL v6 |
| Styling | Tailwind CSS |
| Forms | react-hook-form + zod |
| Payments | Stripe (planned, not yet integrated) |
| Runtime | Node.js 18 |

---

## Sprint 1: Foundation + Club + Tryouts

**Status**: Complete

### Authentication & User Management
- NextAuth.js v4 with Credentials provider (email/password)
- bcrypt password hashing (12 rounds)
- JWT session strategy (no separate session table)
- Sign-up at `/api/auth/signup`, sign-in via NextAuth
- Protected routes via middleware (JWT token check)
- Session provider wrapper for client components

### Multi-Tenancy
- Subdomain routing via middleware (`warriors-demo.localhost:3000`)
- `x-tenant-slug` header injection
- Row-level tenant isolation (tenantId on all scoped tables)
- Tenant branding (logo, colors, fonts)
- Tenant feature flags (max teams, max staff, etc.)

### RBAC & Permissions
- 11 roles: ClubOwner, ClubManager, Staff, TeamManager, Scorekeeper, LeagueOwner, LeagueManager, Parent, Player, Referee, PlatformAdmin
- CASL ability definitions per role
- `Can` component for conditional rendering
- UserRole table with scoping: tenantId, teamId, leagueId, gameId
- Multi-role support (one user can have many roles)

### Team Management
- Create team with age group, gender, season, description
- Teams grid view with player/game counts
- Team-level staff assignment during creation (Head Coach, Assistant Coach, Team Manager)
- `designation` field on UserRole for coaching sub-types ("HeadCoach", "AssistantCoach")
- Team creation available from both club context (`/clubs/[id]/teams/create`) and tenant context (`/teams/create`)

### Staff & Invitation System
- Staff invitation by email (`POST /api/clubs/[id]/staff`)
- Staff join request flow (`POST /api/clubs/[id]/staff/requests`)
- Invitation accept/decline (`PATCH /api/invitations/[id]`)
- On acceptance: UserRole created automatically with tenant + team scope
- Designation passthrough: invitation carries designation, applied to UserRole on accept
- Roles supported: ClubManager, Staff, TeamManager
- Available staff API for team assignment (`GET /api/clubs/[id]/staff/available`)

### Tryout System
- Create tryouts with fee, location, schedule, max participants
- Published vs draft, public vs private (invite-only)
- Tryout marketplace at `/marketplace`
- Browse/filter by age group, gender, fee
- Club branding on tryout cards
- Signup API structure (payment integration pending)

### Notifications
- In-app notification system
- Staff invitation notifications (invite sent, accepted, declined)
- Team assignment notifications
- Notifications page at `/notifications`

---

## Sprint 2: UX Redesign & Onboarding

**Status**: Complete

### Homepage
- Landing page with hero, audience cards (Parents, Club Owners, Referees, League Organizers)
- "How It Works" section
- Auth-aware: logged-in users redirect to `/dashboard`, anonymous users see landing page
- Error pages: `global-error.tsx`, `not-found.tsx`, `error.tsx`

### Two-Step Onboarding Flow
- Step 1: Single role selection (Parent, ClubOwner, Staff, Referee, Player 13+, LeagueOwner)
- Step 2: Role-specific profile form
- ClubOwner skips step 2 — redirects to `/clubs/create`
- `onboardedAt` field on User model tracks completion
- Onboarding guard in dashboard layout (server component, not middleware)

### Role-Specific Onboarding Forms
- **Parent**: Phone number
- **Player (13+)**: Date of birth (age validation), gender, jersey number — creates Player record
- **Staff**: Phone number
- **Referee**: Certification level, standard fee, available regions — creates RefereeProfile
- **LeagueOwner**: League name, season, description — creates League record

### Role-Aware Dashboard
- Sidebar + top nav + role badges
- Conditional sections per role (Parent, ClubOwner, Staff, Referee, Player, LeagueOwner)
- "Edit Profile" links on section headers
- Sidebar navigation adapts based on user roles
- Sign-out button

### Profile Management
- `/settings/profile` — Edit name & phone
- `/referee/profile` — Edit certification, fee, regions
- `GET/PATCH /api/user/profile`
- `GET/PATCH /api/referee/profile`

---

## Sprint 3: Auth Migration + Team Staff Assignment

**Status**: Complete

### Auth Migration (Clerk → NextAuth)
- Replaced Clerk v4 with NextAuth.js v4 across ~40 files
- Removed clerkId dependency, all auth now uses DB User UUID
- Credentials provider with bcrypt password validation
- JWT sessions — no external auth service dependency
- Middleware: NextAuth JWT token check + tenant routing
- Env vars: `NEXTAUTH_URL`, `NEXTAUTH_SECRET`

### Team Creation with Staff Assignment
- Assign staff (coaches, team managers) during team creation
- Select existing club staff from dropdown (fetched from `/api/clubs/[id]/staff/available`)
- Invite new staff by email — creates StaffInvitation with team scope
- Role picker: Head Coach, Assistant Coach, Team Manager
- Head Coach limit: max 1 per team (validated client-side and server-side)
- Existing staff get UserRole created immediately (in transaction with team creation)
- Invited staff get role assigned when they accept the invitation
- `designation` field on both UserRole and StaffInvitation models

---

## Sprint 4: Coach → Staff Role Rename

**Status**: Complete

### Role Rename
- Renamed `Coach` to `Staff` in the Prisma Role enum and across ~30 files
- Staff is now the generic role for all non-owner club/league personnel
- During onboarding, users sign up as generic "Staff" with no designation
- Specific designations (HeadCoach, AssistantCoach) assigned when a club or league adds staff to a team
- All other role enum values (ClubManager, TeamManager, Scorekeeper, LeagueManager) remain unchanged

### Files Changed
- **Schema**: `Coach` → `Staff` in Role enum (`prisma/schema.prisma`)
- **Shared libs**: `coachOnboardingSchema` → `staffOnboardingSchema`, permissions case label
- **Onboarding**: `coach-form.tsx` → `staff-form.tsx`, role options updated
- **Dashboard**: `coach-section.tsx` → `staff-section.tsx`, data property `coach` → `staff`, sidebar label
- **API routes**: 7 routes updated (staff invite, available, requests, teams, invitations, tryouts, onboarding)
- **UI pages**: Team creation (2 routes), club staff page, club detail page
- **Seed data**: `coach@sportshub.test` → `staff@sportshub.test`, role assignments
- **Dev tools**: Test user creation, role switcher
- **Landing page**: Copy updated

### Design Decisions
- HeadCoach/AssistantCoach designations on UserRole.designation remain unchanged (they describe the coaching *function* within a Staff role)
- DB strategy: force-reset + reseed (project in dev mode with seed script)

---

## Database Schema (25+ tables)

### Core
| Table | Purpose |
|-------|---------|
| `User` | Users with email/passwordHash, soft delete, onboarding tracking |
| `UserRole` | Multi-role with scoping (tenantId, teamId, leagueId, gameId) + designation |
| `Tenant` | Clubs — slug, custom domain, Stripe account, subscription plan |
| `TenantBranding` | Logo, colors, fonts, custom CSS |
| `TenantFeatures` | Feature flags (tournaments, reviews, chat, analytics, limits) |

### Teams & Players
| Table | Purpose |
|-------|---------|
| `Team` | Teams with age group, gender, season |
| `Player` | Players with COPPA compliance (isMinor, parentalConsent) |
| `TeamPlayer` | Roster join table with status (ACTIVE/INACTIVE/SUSPENDED) |

### Tryouts & Offers
| Table | Purpose |
|-------|---------|
| `Tryout` | Tryouts with fee, schedule, publish status |
| `TryoutSignup` | Parent signups with payment link |
| `Offer` | Team offers to players with fees and installments |

### Leagues & Games
| Table | Purpose |
|-------|---------|
| `League` | Leagues with season, owner, age cutoff |
| `LeagueDivision` | Divisions within leagues (age/gender based) |
| `LeagueTeam` | Team registration with status and payment |
| `Game` | Scheduled games with scoring |
| `GameEvent` | Play-by-play events (scores, fouls, rebounds) |
| `PlayerStat` | Per-game player statistics |

### Operations
| Table | Purpose |
|-------|---------|
| `Venue` | Locations with address and capacity |
| `Practice` | Scheduled practices |
| `Payment` | Stripe payments with installment support |
| `RefereeProfile` | Certification, fees, regions, Stripe account |

### Communication & Admin
| Table | Purpose |
|-------|---------|
| `Announcement` | Club/team announcements |
| `StaffInvitation` | Invite/request workflow with designation support |
| `Notification` | In-app notifications with read status |
| `Review` | Club/league reviews with moderation |
| `AuditLog` | Action logging per user/role |

---

## API Routes (24 endpoints)

### Auth
| Method | Route | Purpose |
|--------|-------|---------|
| `*` | `/api/auth/[...nextauth]` | NextAuth handler (sign-in, sign-out, session) |
| `POST` | `/api/auth/signup` | User registration |

### Users & Profiles
| Method | Route | Purpose |
|--------|-------|---------|
| `POST` | `/api/onboarding` | Complete onboarding (role + profile) |
| `GET/PATCH` | `/api/user/profile` | User profile CRUD |
| `GET/PATCH` | `/api/referee/profile` | Referee profile CRUD |
| `GET` | `/api/notifications` | User notifications |

### Clubs (Tenants)
| Method | Route | Purpose |
|--------|-------|---------|
| `GET/POST` | `/api/tenants` | List/create clubs |
| `GET` | `/api/tenants/lookup` | Lookup by slug/domain |
| `GET/PATCH` | `/api/clubs/[id]` | Club detail/update |

### Staff
| Method | Route | Purpose |
|--------|-------|---------|
| `GET/POST/DELETE` | `/api/clubs/[id]/staff` | List/invite/remove staff |
| `GET` | `/api/clubs/[id]/staff/available` | Staff available for team assignment |
| `POST` | `/api/clubs/[id]/staff/requests` | Staff join requests |
| `PATCH` | `/api/invitations/[id]` | Accept/decline invitation |

### Teams
| Method | Route | Purpose |
|--------|-------|---------|
| `GET/POST` | `/api/teams` | List/create teams (with staff assignment) |

### Players
| Method | Route | Purpose |
|--------|-------|---------|
| `GET/POST` | `/api/players` | List/add players |
| `GET/PATCH/DELETE` | `/api/players/[id]` | Player CRUD |

### Tryouts
| Method | Route | Purpose |
|--------|-------|---------|
| `GET/POST` | `/api/tryouts` | List/create tryouts |
| `GET/PATCH` | `/api/tryouts/[id]` | Tryout detail/update |
| `POST` | `/api/tryouts/[id]/publish` | Publish to marketplace |
| `POST` | `/api/tryouts/[id]/signup` | Tryout signup |

### Dev/Admin
| Method | Route | Purpose |
|--------|-------|---------|
| `GET` | `/api/health` | Health check |
| `POST` | `/api/create-test-users` | Seed test users |
| `POST` | `/api/dev/switch-role` | Dev role switching |

---

## Pages (26 routes)

### Public
| Route | Description |
|-------|-------------|
| `/` | Landing page (auth-aware redirect) |
| `/sign-in` | Email/password sign-in |
| `/sign-up` | Registration form |
| `/marketplace` | Public tryout marketplace |

### Platform (authenticated)
| Route | Description |
|-------|-------------|
| `/dashboard` | Role-aware dashboard with sidebar |
| `/onboarding` | Two-step onboarding flow |
| `/clubs/create` | Create new club |
| `/clubs/[id]` | Club overview |
| `/clubs/[id]/teams` | Club teams list |
| `/clubs/[id]/teams/create` | Create team with staff assignment |
| `/clubs/[id]/tryouts` | Club tryouts list |
| `/clubs/[id]/tryouts/create` | Create tryout |
| `/clubs/[id]/staff` | Staff management (invite/remove) |
| `/clubs/[id]/settings` | Club settings |
| `/players` | Player list |
| `/players/add` | Add player |
| `/players/[id]/edit` | Edit player |
| `/tryouts/[id]` | Tryout detail |
| `/notifications` | Notifications |
| `/settings/profile` | Edit user profile |
| `/referee/profile` | Edit referee profile |

### Tenant (subdomain routing)
| Route | Description |
|-------|-------------|
| `/teams` | Tenant teams list |
| `/teams/create` | Create team (tenant context) |

---

## Project Structure

```
youth-basketball-hub/
├── apps/web/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx                    # Landing page
│   │   │   ├── layout.tsx                  # Root layout (AuthProvider)
│   │   │   ├── session-provider.tsx         # NextAuth SessionProvider wrapper
│   │   │   ├── error.tsx / not-found.tsx / global-error.tsx
│   │   │   ├── (auth)/
│   │   │   │   ├── sign-in/[[...sign-in]]/page.tsx
│   │   │   │   └── sign-up/[[...sign-up]]/page.tsx
│   │   │   ├── (platform)/
│   │   │   │   ├── dashboard/              # Layout + page + sidebar + sections
│   │   │   │   ├── onboarding/             # Flow + role-specific forms
│   │   │   │   ├── clubs/                  # Create + [id]/(teams, tryouts, staff, settings)
│   │   │   │   ├── players/                # List + add + [id]/edit
│   │   │   │   ├── tryouts/[id]/           # Tryout detail
│   │   │   │   ├── marketplace/            # Public tryout browse
│   │   │   │   ├── notifications/          # Notification list
│   │   │   │   ├── settings/profile/       # User profile edit
│   │   │   │   └── referee/profile/        # Referee profile edit
│   │   │   ├── (tenant)/
│   │   │   │   └── teams/                  # Tenant-scoped team pages
│   │   │   └── api/                        # 24 API route handlers
│   │   ├── lib/
│   │   │   ├── auth.ts                     # NextAuth config
│   │   │   ├── auth-helpers.ts             # getCurrentUser, getUserAbilities, etc.
│   │   │   ├── permissions.ts              # CASL ability definitions
│   │   │   ├── providers.tsx               # CASL AbilityProvider
│   │   │   └── validations/onboarding.ts   # Shared zod schemas
│   │   ├── types/next-auth.d.ts            # NextAuth type extensions
│   │   └── middleware.ts                   # Auth guard + tenant routing
│   └── package.json
├── packages/
│   ├── db/         # Prisma client + seed script
│   ├── ui/         # Shared UI components
│   ├── auth/       # NextAuth helpers re-export
│   ├── payments/   # Stripe utilities (placeholder)
│   └── config/     # Shared constants (age groups, etc.)
├── prisma/
│   └── schema.prisma    # 25+ tables
├── docs/
│   ├── platform-specification.md   # Original design spec
│   └── sprint-1-summary.md         # This file
└── CLAUDE.md        # AI assistant context
```

---

## Seed Data

Run: `cd packages/db && npm run db:seed`

All accounts use password: `TestPass123!`

| Role | Email | Scope |
|------|-------|-------|
| PlatformAdmin | admin@sportshub.test | Global |
| ClubOwner | owner@sportshub.test | Warriors Basketball Club |
| ClubManager | manager@sportshub.test | Warriors Basketball Club |
| Staff | staff@sportshub.test | Warriors / U12 Boys (Head Coach) |
| TeamManager | teammanager@sportshub.test | Warriors / U14 Girls |
| Parent | parent@sportshub.test | Has child: Jordan (U12 Boys) |
| Parent | parent2@sportshub.test | Has child: Riley (U14 Girls) |
| Referee | referee@sportshub.test | Level 2, $55/game |
| LeagueOwner | league@sportshub.test | Metro Youth Basketball League |
| Scorekeeper | scorekeeper@sportshub.test | Warriors Basketball Club |

Demo club URL: `http://warriors-demo.localhost:3000`

---

## Key Design Decisions

1. **NextAuth over Clerk**: Clerk v4 had persistent issues (2FA quirks, dev browser redirect loops, broken metadata API). NextAuth gives full control with no external service dependency.
2. **JWT sessions**: No separate session table. User UUID stored in JWT token, accessed via `session.user.id`.
3. **Designation over separate Role enum**: Coaching sub-types (HeadCoach/AssistantCoach) stored as `designation` field on UserRole, not as separate Role enum values. Avoids breaking existing role checks.
4. **Onboarding guard in layout, not middleware**: Prisma can't run in Edge runtime.
5. **DB-only onboarding tracking**: `onboardedAt` field on User, no external service metadata.
6. **Single role selection at onboarding**: Simpler UX. Users add more roles later.
7. **Event-driven parent-player linking**: Only triggered when payment/consent needed, not upfront.
8. **Team-scoped + tenant-scoped roles**: A Staff member has both a tenant-level role (club member) and a team-scoped role (assigned to specific team with designation).

---

## Known Issues

- CASL v6 types need `as any` assertions in permissions.ts and providers.tsx
- Webpack cache corruption: fix with `rm -rf apps/web/.next`
- Port 3000 zombies: `kill -9 $(lsof -ti:3000)`
- `/players/add` page: `useSearchParams()` not wrapped in Suspense boundary (build warning)
- Pre-existing Prisma version warning (5.8.1 → 7.5.0 available)

---

## What's Implemented vs Planned

### Implemented
- Authentication (NextAuth, email/password)
- Multi-tenant architecture (subdomain routing)
- RBAC (11 roles, CASL permissions)
- Club management (create, settings, branding)
- Team management (create with staff assignment)
- Staff system (invite, request, accept/decline, team assignment)
- Player management (add, edit, COPPA compliance)
- Tryout system (create, publish, marketplace)
- Onboarding flow (role-based, two-step)
- Dashboard (role-aware sections)
- Profile management (user, referee)
- Notifications (in-app)
- Seed data (10 test accounts, demo club, teams, players, tryout, league)

### Needs Implementation
- Tryout signup with payment (Stripe integration)
- Offer system (team offers to players)
- League management (registration, divisions)
- Game scheduling (conflict detection)
- Live scorekeeping (real-time scores)
- Stats calculation (per-game, standings)
- Stripe Connect (payments, payouts)
- Mobile optimization (PWA, Capacitor)

---

## Environment Variables

```env
# Database
DATABASE_URL="postgresql://..."

# Auth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-here"

# Stripe (planned)
STRIPE_SECRET_KEY="sk_test_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."
```

---

## Getting Started

```bash
# Prerequisites: Node.js 18, PostgreSQL running

# Install dependencies
npm install

# Set up database
export PATH="/usr/local/opt/node@18/bin:$PATH"
npx prisma db push --schema=prisma/schema.prisma

# Seed test data
cd packages/db && npm run db:seed && cd ../..

# Start dev server
npm run dev

# Open http://localhost:3000
# Sign in with any test account (password: TestPass123!)
```
