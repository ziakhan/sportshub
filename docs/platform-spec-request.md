You are a principal product architect + full-stack technical lead. Design a build-ready multi-tenant white-label platform called “Youth Basketball Hub” using:

TECH STACK (MANDATORY)
- Frontend/Web: Next.js (App Router), TypeScript
- Mobile packaging: Capacitor (preferred) OR React Native (explain tradeoffs)
- Payments: Stripe + Stripe Connect (Express or Custom—recommend one and justify)
- Database: Choose the best fit and explain why (default preference: Postgres). Use Prisma ORM unless you recommend otherwise.
- Realtime: WebSockets (or SSE) for live scoring + updates
- Auth: Recommend a secure approach (NextAuth/Auth.js, Clerk, or custom) and justify
- Hosting/Infra: Recommend an approach (Vercel for web + managed DB + background jobs)

PRODUCT CONTEXT
This is a youth basketball sports hub for:
1) Clubs: club owners, club managers, coaches, team managers
2) Leagues: league owners/managers
3) Parents and players (family linking)
4) Referees
5) Platform admins

CORE FEATURES (REQUIREMENTS)
A) Clubs can:
- Register a club or claim an existing club
- Create teams and define age groups (U10–U18 configurable)
- Create tryouts (fees, locations, dates, details) and publish publicly
- Make offers to players/parents after tryouts; form teams after acceptance
- Define practice schedules + venues
- Day-to-day communications by coach/team manager (chat + announcements)
- Manage and accept payments + payment schedules
- Join leagues; submit rosters with one click
- Run tournaments: accept teams, schedule venues, manage tournament payments
- Exhibition games: publish availability, discover other teams, arrange games
- Find referees for events

B) Leagues can:
- Define leagues + divisions
- Run tournaments
- Accept teams from clubs, finalize leagues, create schedules
- Communicate with clubs and teams/parents/players
- Accept league/tournament fees
- Find referees

C) Parents/Players can:
- Manage accounts (linked family)
- Discover tryouts, sign up, pay fees
- Accept/decline team offers
- Communicate with team/club
- View stats

D) Referees can:
- Create profile
- Request to ref for league/club events
- Accept jobs
- Set fees and accept payments

E) Platform admins can:
- Manage/approve/verify/suspend any actor
- Moderate reviews/ratings, handle disputes, payments issues, audit everything

SCORING + STATS
- Live scorekeeping by authorized scorekeepers (club/league)
- Real-time updates + historical archive per game
- Leaderboards, season averages, team records, W/L, ranks, standings by league/division/season
- Use an auditable event-log model for game actions (so stats can be recalculated)

REVIEWS + RATINGS
- Star rating + written reviews for clubs, leagues, coaches, referees
- Anti-abuse: verified participation, one review per season, moderation, dispute flow

MULTI-TENANCY + WHITE-LABEL (CRITICAL)
- This must be a multi-tenant SaaS with white-labeling primarily for CLUBS.
- Each club can have:
  - Custom branding (name/logo/colors), custom domain (clubdomain.com or subdomain),
  - Optional app identity configuration (for packaged app builds), and
  - Tenant-level feature toggles (e.g., enable tournaments, enable payments, enable reviews).
- Data isolation must be explicit and safe. Prefer row-level isolation in Postgres with tenant_id + strict access control; mention if you recommend Postgres RLS.
- Support “global marketplace” discovery (tryouts, exhibition games) while respecting tenant boundaries.
- Allow a club to run multiple teams and seasons, and participate in multiple leagues.

WHAT TO PRODUCE (IN THIS EXACT ORDER)
1) Assumptions + Key Decisions
- State assumptions (regions, currencies, minors, etc.)
- Decide on DB and tenancy model and justify (e.g., Postgres + schema-per-tenant vs row-level tenant_id + RLS)
- Decide on Stripe Connect type (Express vs Custom) and justify for clubs/leagues/referees payouts

2) PRD / Product Spec (MVP vs v1 vs v2)
- Vision, personas, top user journeys
- Feature list and priority
- Non-functional requirements

3) White-Label + Multi-Tenant Architecture
- Tenant model: Club as tenant (plus leagues as entities possibly cross-tenant)
- Domain routing approach for Next.js (custom domains + subdomains)
- Branding delivery (themes, assets, runtime config)
- Feature flags per tenant
- Data isolation and access patterns
- How cross-tenant interactions work (leagues/tournaments/exhibition games)

4) RBAC + Permission Matrix
- Roles: ClubOwner, ClubManager, Coach, TeamManager, LeagueOwner, LeagueManager, Parent, Player, Referee, Admin, Scorekeeper
- Provide a permission matrix table (CRUD + approve + publish + pay + scorekeep)

5) Data Model (Postgres-friendly)
- Entities and relationships (describe ERD in text)
- Include key fields, indexes, constraints
- Include tenant_id rules everywhere it belongs
- Include audit logging entities
- Include messaging/notifications entities
- Include game event log + derived stats tables

6) API Design (REST or GraphQL)
- Endpoint list grouped by domain
- Provide example request/response for critical endpoints:
  - create club/claim club
  - create tryout + publish
  - tryout signup + payment intent
  - offer flow accept/decline
  - roster submission to league
  - schedule creation + conflict check
  - game scorekeeping events + realtime subscription
  - finalize game + publish stats
  - reviews create/moderate
- Realtime design: WebSocket channels/rooms keyed by game_id + tenant considerations

7) Payments, Fees, Payouts (Stripe + Connect)
- Payment flows: tryouts, league fees, tournament fees, referee fees
- Who is merchant of record in each case (platform vs club vs league)
- Split payments if needed (platform fee + club fee)
- Refunds/chargebacks and disputes
- Ledger strategy and reconciliation jobs
- Webhooks design and idempotency

8) UX / Screens (Mobile-first)
- Screen list per actor group
- Step-by-step flows:
  - Club onboarding + branding + domain setup + staff invites
  - Team creation → tryout → offers → roster
  - League onboarding → accept teams → schedule → standings
  - Parent: discover tryout → signup/pay → offer → season comms → stats
  - Referee: profile → availability → accept job → payout
  - Scorekeeper: live actions → corrections → finalize
- Notifications: in-app + push/email strategy

9) Scheduling Engine
- Data model for schedules/venues
- Conflict detection logic
- Manual + assisted schedule generation approach
- Reschedule workflow and auditability

10) Implementation Plan (Next.js)
- Project structure (apps, packages if monorepo)
- Recommended libraries:
  - UI (e.g., shadcn/ui or MUI—choose one and justify)
  - State management
  - Realtime client
- Background jobs (queue system)
- Observability
- CI/CD
- Security checklist

11) MVP Delivery Plan
- 6–10 epics with acceptance criteria
- Suggested sprint plan and milestones
- Risks and mitigations

OUTPUT RULES
- Be concrete and build-ready: name tables, fields, endpoints, roles
- Use headings + bullets + tables where appropriate
- Include tradeoffs and reasoning for choices
- Do not hand-wave. If an area is complex, propose a clear “phase 1 vs phase 2” approach.

Start now and produce section (1). After section (1), continue through all sections without asking me questions unless absolutely necessary.