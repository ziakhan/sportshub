# Youth Basketball Hub - Project Context

## ⛔ PRODUCTION DEPLOY POLICY — NO EXCEPTIONS
**Git pushes are ALLOWED for everyone. Production DEPLOYS require the owner's (Zia's) explicit approval, given in the current session for the specific deploy.**
- Committing and pushing to GitHub (`git push origin ...`) deploys NOTHING and never needs approval — Vercel CI/CD was disconnected 2026-07-24 (`vercel.json` `git.deploymentEnabled:false`), so GitHub is a plain code mirror. QA docs, bug reports, fixes, and work-in-progress branches: push freely.
- What DOES need the owner's explicit go-ahead, every time:
  - Running the box deploy script (`ssh sh 'sudo /opt/sportshub/scripts/deploy/oracle-box/deploy.sh'`) — that is the production deploy.
  - EAS OTA publishes and app-store builds/submits.
  - Any schema push, SQL, or seed against the box DB or Neon (local DB is always fine).
  - Re-enabling Vercel git deployments.
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
- **News is ALWAYS a card** (owner 2026-07-25): cover image + kind chip + title + date — every surface (news tab, feed, social, club/team/season pages, web and native). Never a list row with an icon.
- **Server never leads the client**: mobile API changes are additive; never remove/rename fields fielded bundles read.

## 🎨 DESIGN TOOLING LAW (owner, 2026-08-15 — PERMANENT)
- **Every NEW design — a surface, template, component look, or visual system — starts with a ui-ux-pro-max consult** (the Skill). Applying an already-approved spec mechanically does not require re-consulting, but any fresh visual decision does. No exceptions for agents: briefs must pass the consult's conclusions down.
- **Product UI graphics (icons, placeholders, motifs, dynamic art like jersey-number mugs) are hand-authored SVG in code** — they must be themable, dynamic, and crisp at every size. Image generators are the wrong tool here.
- **Marketing/illustrative/photographic assets use image-generation tools** (Canva / Higgsfield connectors when authorized, or external models), never hand-drawn SVG.
- Design iterations follow estimate-first: draft on a preview page (~10 min), owner approves the look, THEN wire and validate.

**Asset-generation decision tree (owner + ui-ux-pro-max consult, 2026-08-15):**
1. UI system graphic (icon, placeholder, motif, dynamic art) → hand-authored SVG in code. Always.
2. Marketing creative CARRYING TEXT (ads, banners, reels with copy) → the authored HTML/CSS pipeline (`scripts/marketing/render-creatives.mjs`, Playwright render) or Canva brand templates. Never raw image models for text; they mangle type.
3. One-off photographic/illustrative art (textures, arena backgrounds, hero art, mascots) → **Higgsfield MCP is the default generator** (`generate_image`, `models_explore(action:'recommend')` to pick the model, `upscale_image` for finals, batch tools for sets). Connected at the account level; attaches per session.
4. Branded layout documents (social templates, one-pagers, deck exports) → Canva MCP with the brand kit.
5. **Gemini image gen (nano banana): deliberately NOT integrated.** Higgsfield covers generation. Revisit only if surgical photo-editing/character-consistency needs appear; wiring is a GEMINI_API_KEY + small script, no connector required.
6. Discipline on all generated art: one illustration style per surface family (never mixed), compress finals (WebP), no emoji-as-icons, product screenshots stay real screenshots.

## 🔀 PARALLEL SESSION LAW (owner, 2026-08-18 — PERMANENT)
**More than one Claude session runs in this repo at once. They share one working tree, one git index and one `.next`.** Every rule below exists because on 2026-08-18 a finished feature — the club review console, its integration test, four verification scripts, the rewritten importer and the 1,516-row census — was found sitting UNTRACKED for three days, through **110 commits and 3 production deploys**. Neither session did anything wrong: each correctly scoped `git add` to its own paths. Nobody owned the close-out.
- **A session commits its own work before it ends.** Not optional, and the single rule that would have prevented all of it. A WIP commit you amend later is fine. Uncommitted work at session end is the only way work gets orphaned.
- **Orphan sweep before EVERY push and EVERY deploy**: `npm run check:orphans`. This gate failed three times running on 08-17. Untracked files pass tsc, tests and the local build, then are simply absent from what ships.
- **Never `git add -A` when another session may be live.** Stage explicit paths. `git add -A` is what nearly committed `sessions/*.json`, which carries a live `next-auth.session-token`.
- **Whoever deploys checks whose commits they are shipping**: `git log <last-deployed-sha>..HEAD`. Confirm any commit you did not write is meant to go out. A deploy ships the other session's committed work whether you looked or not.
- **One session owns the box at a time** — deploys, DB writes, imports, migrations. Two sessions racing `deploy.sh` or an import script is far worse than any orphaning.
- **Prefer a worktree when both sessions write code**: `git worktree add ../sportshub-<topic> -b wip/<topic>`, then symlink `node_modules`. Separate `git status` and separate `.next`, which also removes the shared-build corruption listed under Known Issues.
- **Deploy verification is three-way**: local HEAD, `origin/master` and the box must be the SAME full SHA. Compare full hashes, never abbreviations of different lengths.

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
