# Youth Basketball Hub

Youth Basketball Hub is a multi-tenant platform for youth basketball clubs, leagues, staff, players, referees, and families.

The current repo is a Turborepo monorepo with a Next.js 14 web app, Prisma/PostgreSQL data layer, NextAuth credentials auth, and shared packages for auth, db, UI, payments, and config.

## Current Status

- Auth, onboarding, club flows, team management, staff invitations, tryouts, offers, notifications, and admin impersonation are implemented.
- The active auth system is NextAuth with email/password credentials and JWT sessions.
- The active database stack is Prisma 5 plus PostgreSQL.
- Focused Vitest coverage is in place for middleware, auth credentials, signup, onboarding, staff invitations, team invite flows, invitation responses, and auth helper impersonation behavior.
- TypeScript type-check is passing.
- A lightweight automated test setup now exists via Vitest in the web app.

## Tech Stack

| Layer         | Technology                                     |
| ------------- | ---------------------------------------------- |
| App framework | Next.js 14 App Router                          |
| Monorepo      | Turborepo                                      |
| Language      | TypeScript                                     |
| Auth          | NextAuth.js v4                                 |
| Database      | PostgreSQL                                     |
| ORM           | Prisma 5                                       |
| Styling       | Tailwind CSS                                   |
| Forms         | react-hook-form + zod                          |
| Permissions   | CASL                                           |
| Payments      | Stripe package scaffolded, partial integration |

## Workspace Layout

```text
apps/
	web/                  Next.js application
packages/
	auth/                 Shared auth utilities
	config/               Shared config
	db/                   Prisma client access and seed script
	payments/             Payment-related helpers
	ui/                   Shared UI components
prisma/
	schema.prisma         Main Prisma schema
	migrations/           Prisma migrations
docs/
	sprint-1-summary.md   Implementation summary
	platform-specification.md
design-mockups/
	Standalone HTML design explorations
```

## Prerequisites

- Node.js 18.17+
- npm 9+
- Docker

## Local Setup

1. Install dependencies

```bash
npm install
```

2. Start PostgreSQL

```bash
docker-compose up -d
```

3. Configure environment variables

Create a local env file and set at minimum:

```bash
DATABASE_URL=postgresql://...
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=replace-with-a-long-random-secret
```

Optional variables depend on the feature you are working on, for example app URL or Stripe keys.

4. Generate Prisma client

```bash
npm run db:generate
```

5. Apply schema to the local database

```bash
npm run db:push
```

If you want to use migrations instead:

```bash
npm run db:migrate
```

6. Seed local data if needed

```bash
npm run db:seed
```

7. Start the app

```bash
npm run dev
```

Open http://localhost:3000.

## Useful Scripts

### Root

```bash
npm run dev
npm run build
npm run lint
npm run test
npm run type-check
npm run format
```

### Database

```bash
npm run db:generate
npm run db:push
npm run db:migrate
npm run db:studio
npm run db:seed
```

## Auth Model

- Sign-up is handled by the API route at apps/web/src/app/api/auth/signup/route.ts.
- Sign-in is handled through NextAuth credentials in apps/web/src/lib/auth.ts.
- Sessions use JWT strategy.
- Protected routes are enforced in apps/web/src/middleware.ts.
- Server-side user and role helpers live in apps/web/src/lib/auth-helpers.ts.

## Multi-Tenancy Model

- Public platform routes live under the main app.
- Clubs are modeled as tenants.
- Tenant context is derived from subdomain and custom-domain handling in middleware.
- Scoped roles are stored in UserRole with optional tenant, team, league, and game scope.

## Key Domain Areas Already in Repo

- User onboarding
- Club creation and club claiming
- Team creation and editing
- Staff invitations and team assignment
- Tryouts and signups
- Offers and offer templates
- Notifications
- League and tournament groundwork
- Admin user tooling and impersonation

## Testing Status

The repo currently has:

- Vitest-based route and helper coverage via `npm run test`
- TypeScript type-checking via `npm run type-check`
- GitHub Actions CI that runs `npm run db:generate`, `npm test`, `npm run type-check`, and `npm run build` on `master` and `develop`
- No committed end-to-end test runner configuration

Current automated coverage focuses on:

- Middleware auth redirects and tenant header injection
- Credential auth normalization
- Signup normalization and duplicate handling
- Onboarding role creation and next-step routing
- Club staff invitations
- Team invite flows on create and update
- Invitation accept and decline flows
- Auth helper impersonation behavior

The next testing step should be a small integration layer around invitation acceptance, notifications, and onboarding-to-dashboard transitions rather than jumping straight to broad E2E coverage.

## Prisma Note

This repo is currently configured around Prisma 5.8.x in packages/db/package.json.

If your editor shows warnings about Prisma 7 datasource configuration such as moving `url` to `prisma.config.ts`, that is editor and tooling drift rather than a current repo break. The current package scripts and schema are still based on Prisma 5 conventions.

## Documentation

- docs/platform-specification.md
- docs/sprint-1-summary.md
- CLAUDE.md

## Development Notes

- CASL uses some `as any` assertions as a practical compatibility workaround.
- Club owner onboarding currently routes to club creation.
- Emails are normalized to lowercase in auth and invite flows.
- The repo may contain local design-mockup files and generated artifacts unrelated to the main app runtime.

## Next Recommended Work

1. Add a minimal automated test layer for auth, onboarding, and middleware access control.
2. Add a small integration slice around invitation acceptance, notification creation, and onboarding completion flows.
3. Keep README and sprint summary aligned with the actual implementation as flows evolve.
4. Decide on a deliberate Prisma upgrade path later instead of mixing Prisma 5 runtime with Prisma 7 editor conventions ad hoc.
