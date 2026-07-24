# Youth Basketball Hub - Project Context

## ⛔ PRODUCTION PUSH POLICY — NO EXCEPTIONS
**NEVER push to production without the owner's explicit approval, given in the current session for the specific push.**
- `git push origin master` auto-deploys to Vercel production — pushing IS deploying. Do not push (including reverts, docs-only commits, or "small fixes") until the owner says to.
- Neon production DB: no schema pushes, SQL, or seeds without the same explicit approval.
- Local commits are always fine. Work locally, verify on the dev server, and wait for the owner's go-ahead to ship.
- Blanket approval does not carry over between sessions or tasks; ask each time.

## 💸 SUBAGENT MODEL TIERING — NO UNTIERED FAN-OUTS
**Never launch Agent/Workflow subagents that silently inherit the session model.** (2026-07-14: one untiered 64-agent research run consumed ~70% of the owner's Max 20x weekly usage.)
- Every subagent in a fan-out gets an explicit `model` (and `effort` where supported). This overrides any tool-doc default that says "omit model".
- Mechanical work → **haiku/sonnet, low effort**: web scraping/census/contact enrichment, extraction, formatting, pattern-following edits, test expansion, doc sweeps, broad read-only exploration.
- Top model (Fable) is reserved for a small named set — adversarial verification, judge/synthesis, security review, genuinely subtle reasoning — and it **reviews** cheap agents' output rather than doing the bulk work itself.
- Tie-break by scale: for a **single** subtle task, "in doubt → Fable" (owner's standing rule). For a **fan-out (>3 agents)**, uncertainty resolves DOWN a tier — the expensive model checks the result instead.
- Any run projected to put >1M tokens on the top model needs the owner's explicit OK first.

## 🔒 PLATFORM PARITY LAW (owner, 2026-07-24 — PERMANENT)
- **One data source per surface**: every API consumed by the native apps MUST serve from the SAME shared query module (`lib/queries/*`) as the web page showing the same data. New endpoints NEVER hand-roll prisma shaping that duplicates a web query. New features ship the shared module FIRST, then both consumers.
- **Design parity**: web, mobile web, iOS, Android share the same design concepts — headers/eyebrows, filters, chips, badges, colors, ratings — as close as native idioms allow. A screen existing on one surface at richer fidelity than another is a bug.
- **Back navigation is history-first, never static**: back controls return the user to where they CAME FROM (history), falling back to the hierarchical parent only on cold entry (web: SmartBack component; native: router.back() with fallback). Static "Back to <parent>" links are forbidden.
- **Server never leads the client**: mobile API changes are additive; never remove/rename fields fielded bundles read.

## Tech Stack
- **Monorepo**: Turborepo with `apps/web` (Next.js 14 App Router) and `packages/` (db, ui, auth, payments, config)
- **Auth**: NextAuth.js v4 with Credentials provider (email/password, bcrypt, JWT sessions)
- **Database**: PostgreSQL + Prisma 5.8.1 (`@youthbasketballhub/db`)
- **Permissions**: CASL with `as any` type assertions (v6 type incompatibility workaround)
- **Styling**: Tailwind CSS
- **Forms**: react-hook-form + @hookform/resolvers/zod + zod
- **Dev server**: `npm run dev` (runs via turbo), Node.js 18 at `/usr/local/opt/node@18/bin`

## Key Architecture Patterns
- **Auth config**: `apps/web/src/lib/auth.ts` — NextAuth options, Credentials provider, JWT callbacks
- **Session provider**: `apps/web/src/app/session-provider.tsx` — Client wrapper for SessionProvider
- **Auth in server components**: `getServerSession(authOptions)` → `session.user.id` is DB User UUID
- **Auth in API routes**: Same pattern — `getServerSession(authOptions)` + check `session?.user?.id`
- **Onboarding guard**: In dashboard layout (server component, DB check for `onboardedAt`), NOT in middleware
- **Multi-tenancy**: Subdomain routing via middleware (`x-tenant-slug` header)
- **Roles**: Single role selection during onboarding, users can add more later. UserRole table supports multiple roles per user with scoping (tenant, team, league, game).
- **Staff role**: Generic "Staff" role in the enum. When assigned to clubs/teams, staff get designations (HeadCoach/AssistantCoach) via the `designation` field on UserRole.
- **Staff assignment**: Team creation can assign existing staff (UserRole created immediately) or invite by email (StaffInvitation created, role assigned on acceptance)
- **ClubOwner onboarding**: Skips profile form, redirects to `/clubs/create` (separate flow)
- **Player (13+)**: Self-registered players use `parentId = user.id`. COPPA: under 13 must have parent register.
- **Parent-player linking**: Event-driven only (triggered when payment or consent needed, not upfront)

## Important Files
- `prisma/schema.prisma` — Complete schema (25+ tables). User has `passwordHash` field. UserRole has `designation` field.
- `apps/web/src/lib/auth.ts` — NextAuth configuration (Credentials provider, JWT strategy)
- `apps/web/src/lib/auth-helpers.ts` — `getCurrentUser()`, `getUserAbilities()`, `hasRole()`, `getUserTenants()`
- `apps/web/src/middleware.ts` — Auth guard (NextAuth JWT token check) + tenant routing
- `apps/web/src/lib/permissions.ts` — CASL ability definitions
- `apps/web/src/lib/validations/onboarding.ts` — Shared zod schemas for onboarding forms
- `apps/web/src/app/(platform)/onboarding/onboarding-flow.tsx` — Two-step onboarding orchestrator
- `apps/web/src/app/api/onboarding/route.ts` — Creates UserRole + profile data (Player/RefereeProfile/League)
- `apps/web/src/app/api/auth/signup/route.ts` — User registration endpoint (email, password, name)
- `apps/web/src/app/api/teams/route.ts` — Team CRUD with staff assignment (assign + invite in transaction)
- `apps/web/src/app/api/clubs/[id]/staff/route.ts` — Staff invite/remove (Staff, ClubManager, TeamManager)
- `apps/web/src/app/api/clubs/[id]/staff/available/route.ts` — Fetch staff available for team assignment
- `apps/web/src/app/api/invitations/[id]/route.ts` — Accept/decline invitations (creates UserRole with designation)
- `packages/db/src/seed.ts` — Seed script (10 test accounts, demo club, teams, players, league)

## Known Issues
- CASL v6 types need `as any` assertions in permissions.ts and providers.tsx
- Webpack cache can corrupt — fix with `rm -rf apps/web/.next`
- Port 3000 zombie processes — fix with `kill -9 $(lsof -ti:3000)`

## Env Vars (Auth)
- `NEXTAUTH_URL` — App URL (http://localhost:3000)
- `NEXTAUTH_SECRET` — JWT signing secret

## Docs
- `docs/platform-specification.md` — Original design spec (references Clerk — superseded by NextAuth migration)
- `docs/sprint-1-summary.md` — Current implementation state (Sprint 1-3, all API routes, pages, schema)
