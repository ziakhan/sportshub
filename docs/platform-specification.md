# Youth Basketball Hub - Complete Platform Specification

---

## 1. Assumptions + Key Decisions

### 1.1 Core Assumptions

#### Geographic & Regulatory
- **Primary Market**: United States (initial launch)
- **Currency**: USD (with architecture supporting future multi-currency)
- **Minor Protection**: COPPA compliance required (children under 13)
  - Parent/guardian must create and manage accounts for players under 13
  - No direct marketing to minors
  - Parental consent required for data collection
- **Payment Processing**: PCI DSS compliance via Stripe (no card data stored)
- **Data Residency**: US-based hosting initially (AWS us-east-1 or Vercel US regions)

#### Business Model
- **Platform Revenue**: 
  - Transaction fees on payments (2-5% platform fee on top of Stripe fees)
  - Tiered subscription plans for clubs/leagues (Basic/Pro/Enterprise)
  - Optional premium features (advanced analytics, custom branding)
- **Free Tier**: Parents/players/referees use platform for free
- **Merchant of Record**: Varies by transaction type (detailed in Section 7)

#### Scale Assumptions (Year 1)
- 100-500 clubs
- 1,000-5,000 teams
- 50-200 leagues
- 20,000-100,000 parents/players
- 500-2,000 referees
- Peak concurrent users: 5,000-10,000 (during game days)

---

### 1.2 Key Technical Decisions

#### Decision 1: Database - PostgreSQL with Row-Level Tenancy

**Choice**: PostgreSQL 15+ with row-level `tenant_id` + Row Level Security (RLS)

**Justification**:
- **Row-level tenancy** (single schema, tenant_id column) over schema-per-tenant:
  - ✅ Simpler operations, migrations, backups
  - ✅ Better for cross-tenant queries (leagues spanning multiple clubs)
  - ✅ Easier connection pooling and resource management
  - ✅ Cost-effective at our scale (< 1000 tenants initially)
  - ❌ Requires strict query discipline (always filter by tenant_id)
  
- **PostgreSQL RLS** for defense-in-depth:
  - Policies enforce tenant isolation at database level
  - Protection against application-level bugs
  - Example policy: `CREATE POLICY tenant_isolation ON teams FOR ALL USING (tenant_id = current_setting('app.current_tenant')::uuid)`

- **Managed Service**: AWS RDS PostgreSQL or Supabase
  - Automated backups, point-in-time recovery
  - Read replicas for analytics/reporting
  - Connection pooling via PgBouncer

**Alternative Considered**: Schema-per-tenant
- Rejected: Adds operational complexity, harder to query across tenants for marketplace features

---

#### Decision 2: Stripe Connect - Express Accounts

**Choice**: Stripe Connect with **Express Accounts** for clubs, leagues, and referees

**Justification**:
- **Express vs Custom**:
  - ✅ **Express**: Stripe handles onboarding, compliance, tax forms (1099), payouts UI
  - ✅ Faster time-to-market (no custom payout dashboard needed for MVP)
  - ✅ Stripe manages identity verification, fraud prevention
  - ✅ Simpler for non-technical club owners
  - ❌ Less branding control (acceptable tradeoff for MVP)
  - ❌ Stripe-hosted onboarding flow (but can be embedded)

- **Custom Accounts**: Considered for v2+ if clubs demand fully white-labeled payout experience

**Payment Flow Architecture**:
- **Platform as Merchant of Record** for all transactions
- **Destination Charges** to club/league/referee Connect accounts
- Platform fee deducted automatically (application_fee_amount)
- Supports refunds, disputes, chargebacks centrally

**Onboarding**:
- Clubs/leagues/referees complete Stripe Express onboarding via embedded flow
- Store `stripe_account_id` in database
- Verify account status before enabling payouts

---

#### Decision 3: Authentication - Clerk

**Choice**: **Clerk** for authentication and user management

**Justification**:
- **Clerk vs NextAuth vs Custom**:
  - ✅ **Clerk**: Production-ready, multi-tenant aware, excellent DX
  - ✅ Built-in organization support (maps to clubs/leagues)
  - ✅ RBAC with custom claims (roles/permissions)
  - ✅ Social logins, MFA, session management out-of-box
  - ✅ Webhook support for user lifecycle events
  - ✅ COPPA-compliant parental consent flows
  - ❌ Cost: ~$25/month + $0.02/MAU (acceptable for SaaS)

- **NextAuth/Auth.js**: Considered but requires more custom work for orgs, RBAC
- **Custom**: Rejected due to security complexity, compliance burden

**Implementation**:
- Clerk Organizations = Clubs/Leagues (tenant entities)
- Clerk Roles: ClubOwner, ClubManager, Coach, etc.
- Custom metadata: `{ tenantId: uuid, playerIds: [], ... }`
- Middleware enforces tenant context on every request

---

#### Decision 4: ORM - Prisma

**Choice**: **Prisma ORM**

**Justification**:
- ✅ Type-safe queries (TypeScript)
- ✅ Excellent migrations workflow
- ✅ Supports RLS via raw queries or middleware
- ✅ Great DX with Prisma Studio for debugging
- ✅ Connection pooling via Prisma Data Proxy (optional)

**Tenant Isolation Pattern**:
```typescript
// Middleware to inject tenant_id
prisma.$use(async (params, next) => {
  const tenantId = getTenantFromContext(); // from Clerk session
  if (TENANT_SCOPED_MODELS.includes(params.model)) {
    if (params.action === 'findMany' || params.action === 'findFirst') {
      params.args.where = { ...params.args.where, tenantId };
    }
    // ... similar for create, update, delete
  }
  return next(params);
});
```

---

#### Decision 5: Mobile Strategy - Capacitor

**Choice**: **Capacitor** for mobile app packaging

**Justification**:
- **Capacitor vs React Native**:
  
  | Aspect | Capacitor | React Native |
  |--------|-----------|--------------|
  | Code Reuse | 95%+ (same Next.js app) | 60-70% (separate RN app) |
  | Development Speed | ✅ Faster (one codebase) | ❌ Slower (two codebases) |
  | Native Performance | ⚠️ WebView-based | ✅ Native components |
  | Offline Support | ✅ Good (PWA + plugins) | ✅ Excellent |
  | Push Notifications | ✅ Via plugins | ✅ Native |
  | App Store Approval | ✅ Standard | ✅ Standard |
  | Team Skillset | ✅ Web devs only | ❌ Requires RN expertise |

- **Decision**: Capacitor for MVP (faster, lower cost)
- **Future**: If performance issues arise (e.g., live scoring lag), consider React Native for specific screens

**Implementation**:
- Next.js app with responsive design (mobile-first)
- Capacitor wraps web app for iOS/Android
- Native plugins: Camera (profile pics), Push Notifications, Biometrics
- PWA fallback for web users

---

#### Decision 6: Real-time - WebSockets (Socket.io)

**Choice**: **Socket.io** for real-time features

**Justification**:
- **Use Cases**: Live game scoring, chat, notifications
- **Socket.io vs SSE vs Pusher**:
  - ✅ **Socket.io**: Bi-directional, fallback to polling, room-based (perfect for game_id channels)
  - ✅ Self-hosted (cost-effective at scale)
  - ✅ TypeScript support, Next.js integration
  - ❌ Requires separate server process (Next.js custom server or standalone)

- **SSE**: Considered but one-way only (not suitable for scorekeeper input)
- **Pusher/Ably**: Rejected due to cost at scale ($99-499/month)

**Architecture**:
- Standalone Socket.io server (Node.js) deployed on Railway/Render
- Redis adapter for horizontal scaling (multiple Socket.io instances)
- Rooms keyed by `game_id` or `team_id`
- Tenant validation on connection (verify user has access to game/team)

---

#### Decision 7: Hosting & Infrastructure

**Choice**: 
- **Web App**: Vercel (Next.js)
- **Database**: Supabase (Postgres + RLS + Realtime)
- **Background Jobs**: Inngest or Trigger.dev
- **File Storage**: Vercel Blob or AWS S3
- **CDN**: Vercel Edge Network

**Justification**:

| Component | Service | Why |
|-----------|---------|-----|
| Next.js App | Vercel | Zero-config, edge functions, preview deploys |
| Database | Supabase | Managed Postgres + RLS + Realtime (alternative to Socket.io) |
| Background Jobs | Inngest | Type-safe, retries, observability, free tier |
| File Storage | Vercel Blob | Integrated with Vercel, simple API |
| Monitoring | Sentry + Vercel Analytics | Error tracking + performance |

**Alternative Considered**: AWS (ECS + RDS + S3)
- Rejected for MVP: Higher ops burden, slower iteration
- Revisit for v2+ if Vercel costs become prohibitive (>$500/month)

---

#### Decision 8: Tenancy Model

**Choice**: **Club-as-Tenant** with cross-tenant league support

**Tenancy Rules**:
1. **Primary Tenant**: Club (each club = one tenant)
2. **Tenant-Scoped Data**: Teams, Players, Tryouts, Practices, Staff, Payments
3. **Cross-Tenant Entities**: Leagues, Tournaments, Games (have `league_id` but participants span tenants)
4. **Global Marketplace**: Tryouts, Exhibition Games (discoverable across tenants with privacy controls)

**Domain Routing**:
- `app.youthbasketballhub.com` - Platform homepage, global marketplace
- `{club-slug}.youthbasketballhub.com` - Club subdomain (tenant-specific)
- `custom-domain.com` - Custom domain (Pro/Enterprise plan)

**Tenant Resolution**:
```typescript
// Middleware extracts tenant from:
// 1. Custom domain → lookup tenant_id
// 2. Subdomain → lookup tenant_id
// 3. Fallback to user's primary organization (Clerk)
```

---

### 1.3 Non-Functional Requirements

| Requirement | Target | Strategy |
|-------------|--------|----------|
| **Availability** | 99.5% uptime | Vercel multi-region, Supabase HA |
| **Performance** | < 2s page load, < 500ms API | Edge caching, DB indexes, CDN |
| **Scalability** | 100K users, 10K concurrent | Horizontal scaling, connection pooling |
| **Security** | SOC 2 Type II (future) | RLS, RBAC, audit logs, encryption at rest |
| **Data Retention** | 7 years (financial) | Automated backups, archival to S3 Glacier |
| **Disaster Recovery** | RPO: 1 hour, RTO: 4 hours | Point-in-time recovery, runbooks |

---

### 1.4 Compliance & Legal

- **COPPA**: Parental consent for <13, no behavioral ads to minors
- **GDPR**: (Future) Data export, right to deletion, consent management
- **PCI DSS**: Stripe handles card data (SAQ-A compliance)
- **Accessibility**: WCAG 2.1 AA (keyboard nav, screen readers, color contrast)
- **Terms of Service**: Separate for clubs, parents, referees
- **Background Checks**: (Future) Integration with Checkr for coaches/staff

---

### 1.5 Summary of Key Decisions

| Decision Area | Choice | Rationale |
|---------------|--------|-----------|
| **Database** | PostgreSQL + row-level tenancy + RLS | Balance of simplicity, safety, cross-tenant queries |
| **Payments** | Stripe Connect Express | Fastest path to compliant payouts |
| **Auth** | Clerk | Production-ready, multi-tenant, RBAC built-in |
| **ORM** | Prisma | Type safety, great DX, RLS support |
| **Mobile** | Capacitor | 95% code reuse, faster MVP |
| **Realtime** | Socket.io (or Supabase Realtime) | Cost-effective, flexible |
| **Hosting** | Vercel + Supabase + Inngest | Fast iteration, low ops burden |
| **Tenancy** | Club-as-tenant, subdomain routing | Clear ownership, white-label ready |

---

## 2. PRD / Product Spec (MVP vs v1 vs v2)

### 2.1 Vision & Mission

**Vision**: Become the operating system for youth basketball, connecting clubs, leagues, families, and referees in a seamless, white-labeled ecosystem.

**Mission**: Empower youth basketball organizations to focus on player development by automating operations, payments, communications, and data—while giving families transparency and engagement.

**Differentiation**:
- **White-label first**: Clubs maintain their brand identity
- **End-to-end**: From tryouts to tournaments to stats—one platform
- **Multi-sided marketplace**: Clubs, leagues, families, referees all benefit
- **Mobile-first**: Parents and players live on their phones

---

### 2.2 Personas

#### P1: Club Owner (Sarah)
- **Role**: Owns a competitive youth basketball club (5-10 teams)
- **Goals**: Grow club reputation, streamline operations, increase revenue
- **Pain Points**: Manual tryout management, payment tracking chaos, fragmented tools (email, spreadsheets, Venmo)
- **Tech Savvy**: Medium (uses Stripe, SquareSpace)
- **Key Metric**: Revenue per team, parent satisfaction

#### P2: Coach / Team Manager (Marcus)
- **Role**: Coaches U14 boys team, manages day-to-day
- **Goals**: Communicate with parents, track attendance, focus on coaching
- **Pain Points**: Parent questions via text at all hours, no central roster
- **Tech Savvy**: Low-Medium (uses WhatsApp, Google Sheets)
- **Key Metric**: Team performance, parent engagement

#### P3: League Director (Jennifer)
- **Role**: Runs regional league with 40+ teams across 4 divisions
- **Goals**: Smooth season operations, fair scheduling, timely payments
- **Pain Points**: Manual scheduling, team registration chaos, referee no-shows
- **Tech Savvy**: Medium (uses LeagueApps or similar)
- **Key Metric**: League completion rate, referee availability

#### P4: Parent (David)
- **Role**: Father of 2 kids (ages 10, 13) playing basketball
- **Goals**: Find quality clubs, track kids' progress, manage payments
- **Pain Points**: Opaque tryout process, surprise fees, no visibility into stats
- **Tech Savvy**: High (expects Uber-like experience)
- **Key Metric**: Kids' happiness, value for money

#### P5: Player (Maya, age 15)
- **Role**: Competitive player, aspires to play college ball
- **Goals**: Improve skills, track stats, get recruited
- **Pain Points**: No centralized stats, hard to share highlights with scouts
- **Tech Savvy**: High (TikTok native)
- **Key Metric**: Stats improvement, social sharing

#### P6: Referee (James)
- **Role**: Certified referee, works 10-15 games/month
- **Goals**: Find games, get paid on time, build reputation
- **Pain Points**: Last-minute cancellations, delayed payments, no rating system
- **Tech Savvy**: Medium
- **Key Metric**: Games booked, payment speed

---

### 2.3 Top User Journeys

#### Journey 1: Club Onboarding → First Tryout → Team Formation
**Actor**: Club Owner (Sarah)

1. **Discover**: Finds platform via Google, sees demo
2. **Sign Up**: Creates account, completes Stripe Connect onboarding
3. **Setup Club**: Adds logo, colors, custom domain (optional)
4. **Invite Staff**: Adds coaches, team managers with roles
5. **Create Tryout**: Sets date, location, age group (U14), fee ($50)
6. **Publish**: Tryout goes live on club subdomain + global marketplace
7. **Manage Signups**: Parents register, pay online
8. **Tryout Day**: Coaches evaluate players (notes in app)
9. **Make Offers**: Sends offers to 12 players
10. **Form Team**: 10 accept, team roster finalized
11. **Set Schedule**: Adds practice times, venues
12. **Join League**: Submits roster to league with one click

**Success Criteria**: Team formed in < 2 weeks, 80%+ offer acceptance

---

#### Journey 2: Parent Discovers Tryout → Player Joins Team → Season Engagement
**Actor**: Parent (David)

1. **Discover**: Searches "youth basketball tryouts near me" → finds platform
2. **Browse**: Filters by age (U10), location (5 miles), date
3. **Club Profile**: Views club ratings, coach bios, past teams
4. **Register**: Creates account, adds son (age 10) with parental consent
5. **Pay**: $50 tryout fee via Stripe (saved card for future)
6. **Tryout Day**: Receives reminder notification
7. **Offer**: Gets offer notification, reviews team details
8. **Accept**: Accepts offer, pays season fee ($800, 4 installments)
9. **Season**: 
   - Views practice schedule, game schedule
   - Receives coach announcements
   - Watches live game scores
   - Views son's stats after each game
10. **Renew**: At season end, opts in for next season

**Success Criteria**: < 5 min signup, 90%+ payment success, high engagement

---

#### Journey 3: League Creates Season → Schedules Games → Publishes Standings
**Actor**: League Director (Jennifer)

1. **Create League**: Defines "Spring 2026 League", 4 divisions (U10-U16)
2. **Set Fees**: $500/team registration
3. **Open Registration**: Clubs submit teams
4. **Review Rosters**: Verifies player eligibility (age, club affiliation)
5. **Finalize**: Locks rosters 1 week before season
6. **Schedule**: Uses scheduling tool to assign games (8-game season)
   - Inputs venue availability
   - Conflict detection (no double-bookings)
7. **Assign Referees**: Sends requests to referee pool
8. **Publish**: Schedule goes live, parents/coaches notified
9. **Live Season**:
   - Scorekeepers enter live scores
   - Standings auto-update
   - Reschedules games as needed
10. **Playoffs**: Top 4 teams advance, bracket auto-generated
11. **Season End**: Publishes final stats, awards

**Success Criteria**: Schedule created in < 1 day, zero conflicts, 95%+ games completed

---

#### Journey 4: Referee Finds Games → Gets Paid
**Actor**: Referee (James)

1. **Create Profile**: Adds certifications, availability, fee ($50/game)
2. **Browse Jobs**: Sees open games in area (U12 game, Saturday 10am)
3. **Apply**: Requests to ref
4. **Accepted**: League approves, game added to calendar
5. **Game Day**: Checks in via app, confirms attendance
6. **Post-Game**: Submits final score (if scorekeeper role)
7. **Payout**: Receives payment 2 days later via Stripe Connect
8. **Rating**: League rates referee (5 stars)

**Success Criteria**: Payment within 48 hours, 4.5+ star average

---

### 2.4 Feature Prioritization (MVP → v1 → v2)

#### MVP (3-4 months) - Core Workflows
**Goal**: Enable one club to run tryouts, form teams, and join a league

| Feature | Priority | Complexity | Rationale |
|---------|----------|------------|-----------|
| **Auth & User Management** | P0 | Medium | Foundation (Clerk) |
| **Club Registration** | P0 | Medium | Primary tenant |
| **Tryout Creation & Publishing** | P0 | High | Key differentiator |
| **Parent Signup & Payment** | P0 | High | Revenue driver |
| **Team Formation (Offers)** | P0 | Medium | Core workflow |
| **Basic Roster Management** | P0 | Low | Table stakes |
| **League Creation** | P0 | Medium | Two-sided marketplace |
| **League Registration (Club → League)** | P0 | Medium | Cross-tenant |
| **Manual Schedule Creation** | P0 | Medium | MVP can be manual |
| **Basic Game Scorekeeping** | P0 | High | Real-time feature |
| **Standings & Stats (Basic)** | P0 | Medium | Parent engagement |
| **Stripe Connect Onboarding** | P0 | High | Payments foundation |
| **Payment Processing (Tryouts, Fees)** | P0 | High | Revenue |
| **Email Notifications** | P0 | Low | Communication |
| **Mobile-Responsive Web** | P0 | Medium | Mobile-first |

**Out of MVP**:
- Custom domains (use subdomains only)
- Advanced stats (just W/L, points)
- Referee marketplace (manual assignment)
- Chat (use announcements only)
- Mobile apps (web-only)
- Tournaments (leagues only)
- Exhibition games

---

#### v1 (6-8 months) - Scale & Polish
**Goal**: Support 50+ clubs, 200+ teams, 10+ leagues

| Feature | Priority | Complexity | Rationale |
|---------|----------|------------|-----------|
| **Custom Domains** | P1 | Medium | White-label premium |
| **Advanced Stats** | P1 | High | Player engagement (assists, rebounds, etc.) |
| **Referee Marketplace** | P1 | High | Supply-side growth |
| **In-App Chat** | P1 | Medium | Team communication |
| **Push Notifications** | P1 | Medium | Engagement driver |
| **Capacitor Mobile Apps** | P1 | Medium | App store presence |
| **Tournament Management** | P1 | High | Revenue opportunity |
| **Exhibition Game Matching** | P1 | Medium | Off-season engagement |
| **Automated Scheduling** | P1 | Very High | Ops efficiency |
| **Reviews & Ratings** | P1 | Medium | Trust & safety |
| **Admin Dashboard** | P1 | Medium | Platform ops |
| **Analytics for Clubs** | P1 | Medium | Retention tool |

---

#### v2 (12+ months) - Ecosystem & Growth
**Goal**: 500+ clubs, multi-region, advanced features

| Feature | Priority | Complexity | Rationale |
|---------|----------|------------|-----------|
| **Video Highlights** | P2 | High | Recruiting tool |
| **Recruiting Profiles** | P2 | High | College pipeline |
| **Multi-Sport Support** | P2 | Very High | Platform expansion |
| **Merchandise Store** | P2 | Medium | Revenue diversification |
| **Sponsorship Marketplace** | P2 | Medium | Club revenue |
| **Advanced Analytics (ML)** | P2 | Very High | Competitive edge |
| **International Support** | P2 | High | Geographic expansion |
| **White-Label Mobile Apps** | P2 | Very High | Enterprise feature |
| **API for 3rd Party Integrations** | P2 | Medium | Ecosystem play |

---

### 2.5 Non-Functional Requirements

#### Performance
- **Page Load**: < 2s (p95) on 4G connection
- **API Response**: < 500ms (p95) for CRUD operations
- **Real-time Latency**: < 1s for score updates
- **Database Queries**: < 100ms (p95) with proper indexing

#### Scalability
- **Concurrent Users**: 10,000 (game day peak)
- **Database**: 1M+ rows (teams, players, games)
- **File Storage**: 100GB (logos, photos)
- **WebSocket Connections**: 5,000 concurrent

#### Security
- **Authentication**: MFA optional, session timeout 7 days
- **Authorization**: RBAC enforced at API + DB (RLS)
- **Data Encryption**: At rest (AES-256), in transit (TLS 1.3)
- **Audit Logs**: All financial transactions, admin actions
- **Rate Limiting**: 100 req/min per user, 1000 req/min per tenant

#### Reliability
- **Uptime**: 99.5% (4 hours downtime/year)
- **Backup**: Daily automated, 30-day retention
- **Disaster Recovery**: 4-hour RTO, 1-hour RPO

#### Accessibility
- **WCAG 2.1 AA**: Keyboard navigation, screen reader support
- **Mobile**: Touch targets ≥ 44px, readable text (16px+)

#### Compliance
- **COPPA**: Parental consent, no ads to minors
- **PCI DSS**: SAQ-A (Stripe handles cards)
- **GDPR**: (Future) Data export, deletion

---

### 2.6 Success Metrics (North Star + KPIs)

#### North Star Metric
**Active Teams per Month**: Teams that have ≥1 game or practice logged

#### KPIs by Persona

| Persona | Metric | Target (Year 1) |
|---------|--------|-----------------|
| **Club** | Clubs onboarded | 100 |
| **Club** | Avg revenue per club | $5,000/year |
| **Club** | Retention rate | 80% |
| **League** | Leagues onboarded | 20 |
| **League** | Avg teams per league | 30 |
| **Parent** | Parent signups | 10,000 |
| **Parent** | Tryout conversion | 40% |
| **Parent** | Payment success rate | 95% |
| **Player** | Players registered | 15,000 |
| **Player** | Games with stats | 80% |
| **Referee** | Referees onboarded | 500 |
| **Referee** | Games reffed | 5,000 |
| **Platform** | GMV (Gross Merchandise Value) | $500K |
| **Platform** | Platform fee revenue | $25K (5% take rate) |

---

### 2.7 Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| **Low club adoption** | High | Medium | Free tier, white-glove onboarding, referral program |
| **Payment failures** | High | Low | Stripe reliability, retry logic, support |
| **Data breach** | Critical | Low | RLS, encryption, SOC 2 audit, insurance |
| **Scheduling conflicts** | Medium | High | Conflict detection, manual override, notifications |
| **Referee no-shows** | Medium | Medium | Ratings, deposits, backup pool |
| **Scope creep** | Medium | High | Strict MVP definition, phased roadmap |
| **Vercel costs** | Medium | Medium | Monitor usage, optimize, plan migration to AWS if needed |
| **Competitor (TeamSnap, LeagueApps)** | High | Medium | Focus on white-label + basketball-specific features |

---

## 3. White-Label + Multi-Tenant Architecture

### 3.1 Tenancy Model

#### Core Principle: Club-as-Tenant

**Primary Tenant**: Club
- Each club is a distinct tenant with isolated data
- `tenant_id` (UUID) is the primary isolation key
- Clubs can have multiple teams, staff, venues, etc.

**Secondary Entities** (Cross-Tenant):
- **Leagues**: Can span multiple clubs (cross-tenant)
- **Games**: Involve teams from different clubs
- **Tournaments**: Hosted by one club/league but accept teams from others
- **Referees**: Independent actors, work across clubs/leagues

**Tenant Hierarchy**:
```
Platform
├── Club A (tenant_id: uuid-a)
│   ├── Teams (U10, U12, U14)
│   ├── Staff (coaches, managers)
│   ├── Venues
│   └── Tryouts
├── Club B (tenant_id: uuid-b)
│   └── ...
└── Leagues (cross-tenant)
    ├── League 1 (has teams from Club A, B, C)
    └── League 2
```

---

### 3.2 Domain Routing Strategy

#### Domain Types

| Domain Type | Example | Use Case | Tenant Resolution |
|-------------|---------|----------|-------------------|
| **Platform Domain** | `app.youthbasketballhub.com` | Global marketplace, admin | No tenant (global context) |
| **Subdomain** | `warriors.youthbasketballhub.com` | Club-specific portal (MVP) | Lookup `tenant_id` by subdomain |
| **Custom Domain** | `warriorsbasketball.com` | White-label (v1+) | Lookup `tenant_id` by custom domain |

#### Next.js Middleware Implementation

```typescript
// middleware.ts
import { NextRequest, NextResponse } from 'next/server';

export async function middleware(req: NextRequest) {
  const hostname = req.headers.get('host') || '';
  const url = req.nextUrl;

  // 1. Extract tenant from domain
  let tenantSlug: string | null = null;
  let isCustomDomain = false;

  if (hostname === 'app.youthbasketballhub.com' || hostname === 'localhost:3000') {
    // Platform domain - no tenant (global marketplace)
    tenantSlug = null;
  } else if (hostname.endsWith('.youthbasketballhub.com')) {
    // Subdomain: warriors.youthbasketballhub.com
    tenantSlug = hostname.split('.')[0];
  } else {
    // Custom domain: warriorsbasketball.com
    isCustomDomain = true;
    tenantSlug = await lookupTenantByCustomDomain(hostname);
  }

  // 2. Lookup tenant_id from slug
  const tenantId = tenantSlug ? await getTenantId(tenantSlug) : null;

  // 3. Inject tenant context into request headers
  const requestHeaders = new Headers(req.headers);
  if (tenantId) {
    requestHeaders.set('x-tenant-id', tenantId);
    requestHeaders.set('x-tenant-slug', tenantSlug);
  }

  // 4. Rewrite to tenant-specific path (optional, for file-based routing)
  // Example: /warriors/dashboard -> /app/[tenant]/dashboard
  if (tenantSlug) {
    url.pathname = `/t/${tenantSlug}${url.pathname}`;
  }

  return NextResponse.rewrite(url, { request: { headers: requestHeaders } });
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
```

#### Tenant Lookup (Cached)

```typescript
// lib/tenant.ts
import { cache } from 'react';
import { prisma } from '@/lib/db';
import { headers } from 'next/headers';

// Cache tenant lookup per request
export const getTenantFromHeaders = cache(async () => {
  const headersList = headers();
  const tenantId = headersList.get('x-tenant-id');
  
  if (!tenantId) return null;

  return await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: { branding: true, features: true },
  });
});

// For API routes
export function getTenantIdFromRequest(req: Request): string | null {
  return req.headers.get('x-tenant-id');
}
```

---

### 3.3 Branding Delivery

#### Branding Configuration (Database)

```typescript
// Schema
model Tenant {
  id            String   @id @default(uuid())
  slug          String   @unique // warriors
  name          String   // "Warriors Basketball Club"
  customDomain  String?  @unique // warriorsbasketball.com
  
  // Branding
  branding      TenantBranding?
  features      TenantFeatures?
  
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

model TenantBranding {
  id            String   @id @default(uuid())
  tenantId      String   @unique
  tenant        Tenant   @relation(fields: [tenantId], references: [id])
  
  // Visual Identity
  logoUrl       String?  // CDN URL
  faviconUrl    String?
  primaryColor  String   @default("#1a73e8") // Hex
  secondaryColor String  @default("#34a853")
  accentColor   String   @default("#fbbc04")
  
  // Typography
  fontFamily    String   @default("Inter") // Google Font name
  
  // Custom CSS (advanced)
  customCss     String?  @db.Text
  
  // Email branding
  emailLogoUrl  String?
  emailFooter   String?  @db.Text
}

model TenantFeatures {
  id                String   @id @default(uuid())
  tenantId          String   @unique
  tenant            Tenant   @relation(fields: [tenantId], references: [id])
  
  // Feature flags
  enableTournaments Boolean  @default(false)
  enableReviews     Boolean  @default(true)
  enableChat        Boolean  @default(false)
  enableAnalytics   Boolean  @default(false)
  
  // Limits (based on plan)
  maxTeams          Int      @default(10)
  maxStaff          Int      @default(5)
}
```

#### Runtime Branding Application

```typescript
// app/layout.tsx (root layout)
import { getTenantFromHeaders } from '@/lib/tenant';

export default async function RootLayout({ children }) {
  const tenant = await getTenantFromHeaders();
  
  const branding = tenant?.branding || {
    primaryColor: '#1a73e8',
    secondaryColor: '#34a853',
    fontFamily: 'Inter',
  };

  return (
    <html lang="en">
      <head>
        <link rel="icon" href={branding.faviconUrl || '/favicon.ico'} />
        <link
          href={`https://fonts.googleapis.com/css2?family=${branding.fontFamily}:wght@400;500;600;700&display=swap`}
          rel="stylesheet"
        />
        <style dangerouslySetInnerHTML={{
          __html: `
            :root {
              --color-primary: ${branding.primaryColor};
              --color-secondary: ${branding.secondaryColor};
              --color-accent: ${branding.accentColor};
              --font-family: '${branding.fontFamily}', sans-serif;
            }
            ${branding.customCss || ''}
          `
        }} />
      </head>
      <body style={{ fontFamily: 'var(--font-family)' }}>
        <TenantProvider tenant={tenant}>
          {children}
        </TenantProvider>
      </body>
    </html>
  );
}
```

#### Branding Management UI

**Club Owner Flow**:
1. Navigate to `/settings/branding`
2. Upload logo (Vercel Blob → CDN URL)
3. Pick colors via color picker (live preview)
4. Select font from dropdown (Google Fonts)
5. Save → branding applies instantly (no rebuild needed)

---

### 3.4 Data Isolation & Access Patterns

#### Row-Level Security (RLS) Policies

```sql
-- Enable RLS on tenant-scoped tables
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access teams in their tenant
CREATE POLICY tenant_isolation_teams ON teams
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant')::uuid);

-- Similar policies for: players, staff, tryouts, practices, venues, payments
```

#### Prisma Middleware (Defense-in-Depth)

```typescript
// lib/db.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Tenant-scoped models
const TENANT_SCOPED_MODELS = [
  'Team', 'Player', 'Staff', 'Tryout', 'Practice', 'Venue', 'Payment', 'Announcement'
];

// Middleware to auto-inject tenant_id
prisma.$use(async (params, next) => {
  const tenantId = getTenantContext(); // from AsyncLocalStorage or headers

  if (!tenantId) {
    // Allow global queries (e.g., admin, public marketplace)
    return next(params);
  }

  if (TENANT_SCOPED_MODELS.includes(params.model)) {
    // Read operations: filter by tenant_id
    if (params.action === 'findMany' || params.action === 'findFirst' || params.action === 'findUnique') {
      params.args.where = { ...params.args.where, tenantId };
    }

    // Write operations: inject tenant_id
    if (params.action === 'create') {
      params.args.data = { ...params.args.data, tenantId };
    }

    if (params.action === 'createMany') {
      params.args.data = params.args.data.map(item => ({ ...item, tenantId }));
    }

    // Update/Delete: ensure tenant_id filter
    if (params.action === 'update' || params.action === 'updateMany' || params.action === 'delete' || params.action === 'deleteMany') {
      params.args.where = { ...params.args.where, tenantId };
    }
  }

  return next(params);
});

export { prisma };
```

#### Tenant Context Management

```typescript
// lib/tenant-context.ts
import { AsyncLocalStorage } from 'async_hooks';

const tenantContext = new AsyncLocalStorage<string>();

export function runWithTenant<T>(tenantId: string, fn: () => T): T {
  return tenantContext.run(tenantId, fn);
}

export function getTenantContext(): string | undefined {
  return tenantContext.getStore();
}

// In API route:
export async function GET(req: Request) {
  const tenantId = getTenantIdFromRequest(req);
  
  return runWithTenant(tenantId, async () => {
    // All Prisma queries here are auto-scoped to tenantId
    const teams = await prisma.team.findMany(); // Only tenant's teams
    return Response.json(teams);
  });
}
```

---

### 3.5 Cross-Tenant Interactions

#### Pattern 1: Leagues (Cross-Tenant Entity)

**Problem**: A league has teams from multiple clubs (tenants).

**Solution**: Leagues are **not tenant-scoped**. Instead, use join tables.

```typescript
model League {
  id          String   @id @default(uuid())
  name        String
  ownerId     String   // User who created league (could be club or independent)
  
  // No tenant_id - leagues are global
  
  teams       LeagueTeam[]
  games       Game[]
}

model LeagueTeam {
  id          String   @id @default(uuid())
  leagueId    String
  league      League   @relation(fields: [leagueId], references: [id])
  
  teamId      String
  team        Team     @relation(fields: [teamId], references: [id])
  
  // Team belongs to a tenant, but league doesn't
  // Access control: Check if user has permission to team OR league
}

model Team {
  id          String   @id @default(uuid())
  tenantId    String   // Club that owns this team
  tenant      Tenant   @relation(fields: [tenantId], references: [id])
  
  name        String
  ageGroup    String
  
  leagues     LeagueTeam[]
}
```

**Access Control**:
- **League Owner**: Can manage league, add/remove teams, create schedule
- **Club Owner**: Can submit their teams to league, view league details
- **Parents/Players**: Can view league standings, schedule (read-only)

**Query Example**:
```typescript
// Get all teams in a league (cross-tenant)
const leagueTeams = await prisma.leagueTeam.findMany({
  where: { leagueId },
  include: {
    team: {
      include: { tenant: true } // Include club branding
    }
  }
});
```

---

#### Pattern 2: Games (Cross-Tenant)

**Problem**: A game involves two teams from different clubs.

**Solution**: Games reference teams (which have tenant_id), but games themselves are league-scoped.

```typescript
model Game {
  id            String   @id @default(uuid())
  leagueId      String?  // Null for exhibition games
  league        League?  @relation(fields: [leagueId], references: [id])
  
  homeTeamId    String
  homeTeam      Team     @relation("HomeGames", fields: [homeTeamId], references: [id])
  
  awayTeamId    String
  awayTeam      Team     @relation("AwayGames", fields: [awayTeamId], references: [id])
  
  venueId       String?
  venue         Venue?   @relation(fields: [venueId], references: [id])
  
  scheduledAt   DateTime
  status        GameStatus // SCHEDULED, LIVE, COMPLETED, CANCELLED
  
  // Scoring
  homeScore     Int?
  awayScore     Int?
  
  events        GameEvent[] // Real-time scoring events
}
```

**Access Control**:
- **League Owner**: Full control
- **Home/Away Club**: Can view, assign scorekeeper
- **Scorekeeper**: Can update score, events
- **Parents/Players**: Read-only (if on team)

---

#### Pattern 3: Global Marketplace (Tryouts, Exhibition Games)

**Problem**: Parents should discover tryouts across all clubs.

**Solution**: Tryouts are tenant-scoped, but **published** tryouts are discoverable globally.

```typescript
model Tryout {
  id            String   @id @default(uuid())
  tenantId      String   // Club that owns tryout
  tenant        Tenant   @relation(fields: [tenantId], references: [id])
  
  title         String
  ageGroup      String
  location      String
  scheduledAt   DateTime
  fee           Decimal
  
  isPublished   Boolean  @default(false) // Only published tryouts in marketplace
  isPublic      Boolean  @default(true)  // Public vs private (invite-only)
  
  signups       TryoutSignup[]
}

// Global marketplace query (no tenant filter)
const publicTryouts = await prisma.tryout.findMany({
  where: {
    isPublished: true,
    isPublic: true,
    scheduledAt: { gte: new Date() }
  },
  include: { tenant: { include: { branding: true } } }, // Show club branding
  orderBy: { scheduledAt: 'asc' }
});
```

**Privacy Controls**:
- **isPublished**: Club must explicitly publish to marketplace
- **isPublic**: Private tryouts only visible to invited families
- **Tenant Branding**: Marketplace shows club logo, colors (white-label preserved)

---

### 3.6 Feature Flags per Tenant

#### Implementation

```typescript
// lib/features.ts
export async function hasFeature(tenantId: string, feature: string): Promise<boolean> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: { features: true }
  });

  return tenant?.features?.[feature] || false;
}

// In API route
export async function POST(req: Request) {
  const tenantId = getTenantIdFromRequest(req);
  
  if (!await hasFeature(tenantId, 'enableTournaments')) {
    return Response.json({ error: 'Tournaments not enabled for your club' }, { status: 403 });
  }

  // Create tournament...
}
```

#### Feature Flag UI

```typescript
// components/FeatureGate.tsx
export function FeatureGate({ feature, children, fallback = null }) {
  const { tenant } = useTenant();
  const enabled = tenant?.features?.[feature];

  if (!enabled) return fallback;
  return children;
}

// Usage
<FeatureGate feature="enableTournaments">
  <TournamentDashboard />
</FeatureGate>
```

---

### 3.7 Multi-Tenant Database Schema Summary

#### Tenant-Scoped Tables (have `tenant_id`)
- `teams`
- `players` (via team)
- `staff`
- `tryouts`
- `practices`
- `venues`
- `announcements`
- `payments` (club-initiated)

#### Cross-Tenant Tables (no `tenant_id`)
- `leagues`
- `games`
- `tournaments`
- `referees`
- `users` (can belong to multiple tenants via roles)

#### Join Tables (bridge tenants)
- `league_teams` (league ↔ team)
- `game_participants` (game ↔ team)
- `tournament_teams`

---

### 3.8 Tenant Onboarding Flow

#### Step-by-Step (Club Owner)

1. **Sign Up** (Clerk)
   - Email + password or Google OAuth
   - Creates Clerk user

2. **Create Club** (Tenant)
   - Form: Club name, slug (auto-generated, editable)
   - Creates `Tenant` record
   - Creates Clerk Organization (maps to tenant)
   - Assigns user as ClubOwner role

3. **Stripe Connect Onboarding**
   - Redirect to Stripe Express onboarding
   - Webhook receives `account.updated` → store `stripe_account_id`

4. **Branding Setup** (Optional)
   - Upload logo, pick colors
   - Preview live on subdomain

5. **Invite Staff** (Optional)
   - Send email invites to coaches, managers
   - They join Clerk Organization with Coach/Manager role

6. **Ready to Use**
   - Redirect to `/dashboard`
   - CTA: "Create Your First Tryout"

---

### 3.9 Tenant Isolation Testing Checklist

- [ ] **Query Isolation**: User from Club A cannot query Club B's teams
- [ ] **Write Isolation**: User from Club A cannot create team in Club B
- [ ] **URL Manipulation**: Changing `tenant_id` in URL/headers has no effect (server-side resolution)
- [ ] **Cross-Tenant Leaks**: League standings don't expose private team data
- [ ] **RLS Enforcement**: Direct SQL queries respect RLS policies
- [ ] **Middleware Coverage**: All CRUD operations go through Prisma middleware
- [ ] **Custom Domain**: Custom domain correctly resolves to tenant
- [ ] **Subdomain**: Subdomain correctly resolves to tenant
- [ ] **Branding**: Each tenant sees their own logo, colors
- [ ] **Feature Flags**: Disabled features return 403

---

## 4. RBAC + Permission Matrix

### 4.1 Role Definitions

#### Club Roles

| Role | Description | Scope | Typical User |
|------|-------------|-------|--------------|
| **ClubOwner** | Full control over club | Tenant-wide | Club founder/owner |
| **ClubManager** | Day-to-day operations | Tenant-wide | Director of operations |
| **Coach** | Team-level management | Team-scoped | Head coach |
| **TeamManager** | Team admin tasks | Team-scoped | Team parent volunteer |
| **Scorekeeper** | Game scoring only | Game-scoped | Designated scorekeeper |

#### League Roles

| Role | Description | Scope | Typical User |
|------|-------------|-------|--------------|
| **LeagueOwner** | Full control over league | League-wide | League founder |
| **LeagueManager** | League operations | League-wide | League coordinator |

#### Family Roles

| Role | Description | Scope | Typical User |
|------|-------------|-------|--------------|
| **Parent** | Manage family, pay fees | Family-scoped | Parent/guardian |
| **Player** | View own stats, schedule | Self-scoped | Youth player |

#### Independent Roles

| Role | Description | Scope | Typical User |
|------|-------------|-------|--------------|
| **Referee** | Officiate games, get paid | Game-scoped | Certified referee |
| **PlatformAdmin** | Platform-wide control | Global | Platform operator |

---

### 4.2 Permission Matrix

#### Legend
- ✅ = Full access
- 👁️ = Read-only
- ⚠️ = Conditional (see notes)
- ❌ = No access

#### Clubs & Teams

| Resource | Action | ClubOwner | ClubManager | Coach | TeamManager | Parent | Player | LeagueOwner | Referee | Admin |
|----------|--------|-----------|-------------|-------|-------------|--------|--------|-------------|---------|-------|
| **Club** | Create | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Club** | Read (own) | ✅ | ✅ | ✅ | ✅ | 👁️ | 👁️ | 👁️ | 👁️ | ✅ |
| **Club** | Update | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Club** | Delete | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Team** | Create | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Team** | Read (own) | ✅ | ✅ | ✅ | ✅ | ⚠️¹ | ⚠️¹ | 👁️ | 👁️ | ✅ |
| **Team** | Update | ✅ | ✅ | ⚠️² | ⚠️² | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Team** | Delete | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Staff** | Invite | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Staff** | Remove | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

**Notes**:
1. Parents/Players can read teams they're associated with
2. Coaches/TeamManagers can update only their assigned team

---

#### Tryouts & Offers

| Resource | Action | ClubOwner | ClubManager | Coach | TeamManager | Parent | Player | Admin |
|----------|--------|-----------|-------------|-------|-------------|--------|--------|-------|
| **Tryout** | Create | ✅ | ✅ | ⚠️³ | ❌ | ❌ | ❌ | ✅ |
| **Tryout** | Read (own club) | ✅ | ✅ | ✅ | ✅ | 👁️ | 👁️ | ✅ |
| **Tryout** | Read (marketplace) | 👁️ | 👁️ | 👁️ | 👁️ | 👁️ | 👁️ | ✅ |
| **Tryout** | Update | ✅ | ✅ | ⚠️³ | ❌ | ❌ | ❌ | ✅ |
| **Tryout** | Publish | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Tryout** | Delete | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **TryoutSignup** | Create | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ |
| **TryoutSignup** | Read | ✅ | ✅ | ✅ | ⚠️⁴ | ⚠️⁵ | ❌ | ✅ |
| **Offer** | Create | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| **Offer** | Accept/Decline | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ |

**Notes**:
3. Coaches can create/update tryouts if granted permission by club
4. TeamManagers can read signups for their team's tryouts
5. Parents can read their own signups

---

#### Leagues & Games

| Resource | Action | ClubOwner | Coach | Parent | Player | LeagueOwner | LeagueManager | Scorekeeper | Referee | Admin |
|----------|--------|-----------|-------|--------|--------|-------------|---------------|-------------|---------|-------|
| **League** | Create | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ |
| **League** | Read | 👁️ | 👁️ | 👁️ | 👁️ | ✅ | ✅ | 👁️ | 👁️ | ✅ |
| **League** | Update | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ |
| **League** | Delete | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ |
| **LeagueTeam** | Submit (join) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **LeagueTeam** | Approve | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ |
| **Game** | Create | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ |
| **Game** | Read | ⚠️⁶ | ⚠️⁶ | ⚠️⁶ | ⚠️⁶ | ✅ | ✅ | ⚠️⁶ | ⚠️⁶ | ✅ |
| **Game** | Update | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ |
| **Game** | Scorekeep | ❌ | ⚠️⁷ | ❌ | ❌ | ⚠️⁷ | ⚠️⁷ | ✅ | ❌ | ✅ |
| **Game** | Finalize | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ❌ | ✅ |

**Notes**:
6. Can read games involving their team/league
7. Can scorekeep if assigned as scorekeeper for that game

---

#### Payments

| Resource | Action | ClubOwner | ClubManager | Parent | LeagueOwner | Referee | Admin |
|----------|--------|-----------|-------------|--------|-------------|---------|-------|
| **Payment** | Create (charge) | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ |
| **Payment** | Pay | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ |
| **Payment** | Read (own) | ✅ | ✅ | ⚠️⁸ | ✅ | ⚠️⁸ | ✅ |
| **Payment** | Refund | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ |
| **Payout** | Request | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ |
| **Payout** | Read (own) | ✅ | ⚠️⁹ | ❌ | ✅ | ✅ | ✅ |

**Notes**:
8. Can read their own payments (as payer or payee)
9. ClubManagers can read club payouts if granted permission

---

#### Reviews & Ratings

| Resource | Action | ClubOwner | Coach | Parent | Player | LeagueOwner | Referee | Admin |
|----------|--------|-----------|-------|--------|--------|-------------|---------|-------|
| **Review** | Create | ❌ | ❌ | ⚠️¹⁰ | ❌ | ⚠️¹⁰ | ❌ | ✅ |
| **Review** | Read | ✅ | ✅ | 👁️ | 👁️ | ✅ | ⚠️¹¹ | ✅ |
| **Review** | Update (own) | ❌ | ❌ | ⚠️¹² | ❌ | ⚠️¹² | ❌ | ✅ |
| **Review** | Delete (own) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Review** | Moderate | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Review** | Dispute | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ |

**Notes**:
10. Can review if verified participation (parent reviewed club, league reviewed referee, etc.)
11. Referees can read reviews about themselves
12. Can edit within 24 hours of posting

---

#### Communications

| Resource | Action | ClubOwner | ClubManager | Coach | TeamManager | Parent | Player | LeagueOwner | Admin |
|----------|--------|-----------|-------------|-------|-------------|--------|--------|-------------|-------|
| **Announcement** | Create | ✅ | ✅ | ⚠️¹³ | ⚠️¹³ | ❌ | ❌ | ✅ | ✅ |
| **Announcement** | Read | ✅ | ✅ | ✅ | ✅ | ⚠️¹⁴ | ⚠️¹⁴ | ✅ | ✅ |
| **Chat** (v1+) | Send | ✅ | ✅ | ✅ | ✅ | ⚠️¹⁵ | ⚠️¹⁵ | ✅ | ✅ |
| **Chat** (v1+) | Read | ✅ | ✅ | ✅ | ✅ | ⚠️¹⁵ | ⚠️¹⁵ | ✅ | ✅ |

**Notes**:
13. Can create announcements for their team
14. Can read announcements for their team/league
15. Can participate in team/league chats they're part of

---

### 4.3 Permission Implementation

#### Database Schema

```typescript
model User {
  id            String   @id @default(uuid())
  clerkId       String   @unique
  email         String   @unique
  
  // User can have multiple roles across tenants
  roles         UserRole[]
  
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

model UserRole {
  id            String   @id @default(uuid())
  userId        String
  user          User     @relation(fields: [userId], references: [id])
  
  role          Role     // Enum: ClubOwner, Coach, Parent, etc.
  
  // Scope (nullable based on role)
  tenantId      String?  // For club roles
  tenant        Tenant?  @relation(fields: [tenantId], references: [id])
  
  teamId        String?  // For team-scoped roles (Coach, TeamManager)
  team          Team?    @relation(fields: [teamId], references: [id])
  
  leagueId      String?  // For league roles
  league        League?  @relation(fields: [leagueId], references: [id])
  
  createdAt     DateTime @default(now())
  
  @@unique([userId, role, tenantId, teamId, leagueId])
}

enum Role {
  ClubOwner
  ClubManager
  Coach
  TeamManager
  Scorekeeper
  LeagueOwner
  LeagueManager
  Parent
  Player
  Referee
  PlatformAdmin
}
```

---

#### Permission Checking (CASL)

```typescript
// lib/permissions.ts
import { AbilityBuilder, createMongoAbility } from '@casl/ability';
import { UserRole, Role } from '@prisma/client';

export function defineAbilitiesFor(user: User, roles: UserRole[]) {
  const { can, cannot, build } = new AbilityBuilder(createMongoAbility);

  roles.forEach(role => {
    switch (role.role) {
      case Role.ClubOwner:
        defineClubOwnerAbilities(can, role.tenantId);
        break;
      case Role.Coach:
        defineCoachAbilities(can, role.tenantId, role.teamId);
        break;
      case Role.Parent:
        defineParentAbilities(can, user.id);
        break;
      case Role.PlatformAdmin:
        can('manage', 'all'); // Full access
        break;
      // ... other roles
    }
  });

  return build();
}

function defineClubOwnerAbilities(can, tenantId: string) {
  // Full control over tenant resources
  can('manage', 'Club', { id: tenantId });
  can('manage', 'Team', { tenantId });
  can('manage', 'Tryout', { tenantId });
  can('manage', 'Staff', { tenantId });
  can('manage', 'Payment', { tenantId });
  
  // Can read leagues/games involving their teams
  can('read', 'League');
  can('read', 'Game', { 'homeTeam.tenantId': tenantId });
  can('read', 'Game', { 'awayTeam.tenantId': tenantId });
}

function defineCoachAbilities(can, tenantId: string, teamId: string) {
  // Read club info
  can('read', 'Club', { id: tenantId });
  
  // Manage assigned team
  can('read', 'Team', { id: teamId });
  can('update', 'Team', { id: teamId }); // Limited fields
  
  // Tryouts for their team
  can('read', 'Tryout', { tenantId });
  can('create', 'Tryout', { tenantId }); // If granted
  
  // Create offers
  can('create', 'Offer', { teamId });
  
  // Read games
  can('read', 'Game', { homeTeamId: teamId });
  can('read', 'Game', { awayTeamId: teamId });
  
  // Announcements
  can('create', 'Announcement', { teamId });
  can('read', 'Announcement', { teamId });
}

function defineParentAbilities(can, userId: string) {
  // Read public info
  can('read', 'Club');
  can('read', 'Tryout', { isPublished: true, isPublic: true });
  
  // Manage own family
  can('manage', 'Player', { parentId: userId });
  
  // Signup for tryouts
  can('create', 'TryoutSignup', { parentId: userId });
  can('read', 'TryoutSignup', { parentId: userId });
  
  // Accept/decline offers
  can('update', 'Offer', { 'player.parentId': userId });
  
  // Pay fees
  can('create', 'Payment', { payerId: userId });
  can('read', 'Payment', { payerId: userId });
  
  // Read team info (if child is on team)
  can('read', 'Team', { 'players.parentId': userId });
  can('read', 'Game', { 'homeTeam.players.parentId': userId });
  can('read', 'Game', { 'awayTeam.players.parentId': userId });
  
  // Create reviews (if participated)
  can('create', 'Review', { reviewerId: userId }); // + verification check
}
```

---

#### API Route Protection

```typescript
// app/api/teams/[id]/route.ts
import { getUser, getUserRoles } from '@/lib/auth';
import { defineAbilitiesFor } from '@/lib/permissions';
import { ForbiddenError } from '@casl/ability';

export async function PUT(req: Request, { params }) {
  const user = await getUser(req);
  const roles = await getUserRoles(user.id);
  const ability = defineAbilitiesFor(user, roles);

  const team = await prisma.team.findUnique({ where: { id: params.id } });
  
  // Check permission
  ForbiddenError.from(ability).throwUnlessCan('update', 'Team', team);

  // Proceed with update
  const data = await req.json();
  const updated = await prisma.team.update({
    where: { id: params.id },
    data
  });

  return Response.json(updated);
}
```

---

#### React Component Protection

```typescript
// components/PermissionGate.tsx
import { useAbility } from '@/hooks/useAbility';

export function Can({ action, subject, children, fallback = null }) {
  const ability = useAbility();
  
  if (ability.can(action, subject)) {
    return children;
  }
  
  return fallback;
}

// Usage
<Can action="create" subject="Tryout">
  <Button>Create Tryout</Button>
</Can>
```

---

### 4.4 Role Assignment Flows

#### Flow 1: Club Owner Invites Coach

1. ClubOwner navigates to `/staff/invite`
2. Enters email, selects role (Coach), selects team
3. System sends email invite with magic link
4. Coach clicks link, creates account (Clerk)
5. System creates `UserRole` record:
   ```typescript
   {
     userId: coach.id,
     role: Role.Coach,
     tenantId: club.id,
     teamId: selectedTeam.id
   }
   ```
6. Coach can now access team dashboard

---

#### Flow 2: Parent Signs Up

1. Parent creates account (Clerk)
2. System creates `UserRole` record:
   ```typescript
   {
     userId: parent.id,
     role: Role.Parent,
     tenantId: null, // Global role
     teamId: null,
     leagueId: null
   }
   ```
3. When player joins team (via offer acceptance), no new role needed
4. Permissions are inferred from player-parent relationship

---

#### Flow 3: Scorekeeper Assignment

1. LeagueOwner navigates to game details
2. Assigns user as scorekeeper for that game
3. System creates temporary `UserRole`:
   ```typescript
   {
     userId: scorekeeper.id,
     role: Role.Scorekeeper,
     gameId: game.id, // Game-scoped
     expiresAt: game.scheduledAt + 24 hours
   }
   ```
4. Scorekeeper can update game score during game window
5. Role auto-expires after game

---

### 4.5 Audit Logging

#### Audit Log Schema

```typescript
model AuditLog {
  id            String   @id @default(uuid())
  
  // Who
  userId        String
  user          User     @relation(fields: [userId], references: [id])
  userRole      Role     // Role at time of action
  
  // What
  action        String   // CREATE, UPDATE, DELETE, APPROVE, PAY, etc.
  resource      String   // Team, Payment, Game, etc.
  resourceId    String
  
  // Context
  tenantId      String?  // If tenant-scoped
  ipAddress     String
  userAgent     String
  
  // Details
  changes       Json?    // Before/after for updates
  metadata      Json?    // Additional context
  
  createdAt     DateTime @default(now())
  
  @@index([userId, createdAt])
  @@index([tenantId, createdAt])
  @@index([resource, resourceId])
}
```

#### Audit Middleware

```typescript
// lib/audit.ts
export async function logAudit(params: {
  userId: string;
  userRole: Role;
  action: string;
  resource: string;
  resourceId: string;
  tenantId?: string;
  changes?: any;
  req: Request;
}) {
  await prisma.auditLog.create({
    data: {
      ...params,
      ipAddress: req.headers.get('x-forwarded-for') || 'unknown',
      userAgent: req.headers.get('user-agent') || 'unknown',
    }
  });
}

// In API route
export async function DELETE(req: Request, { params }) {
  // ... permission check ...
  
  const team = await prisma.team.delete({ where: { id: params.id } });
  
  await logAudit({
    userId: user.id,
    userRole: primaryRole,
    action: 'DELETE',
    resource: 'Team',
    resourceId: team.id,
    tenantId: team.tenantId,
    req
  });
  
  return Response.json({ success: true });
}
```

---

## 5. Data Model (Postgres-friendly)

### 5.1 Entity Relationship Overview

```
Tenant (Club)
├── TenantBranding
├── TenantFeatures
├── Teams
│   ├── TeamPlayers
│   ├── LeagueTeams (cross-tenant)
│   └── Games (as home/away)
├── Staff (UserRoles)
├── Tryouts
│   └── TryoutSignups
├── Practices
├── Venues
├── Announcements
└── Payments

League (cross-tenant)
├── LeagueTeams
├── Games
└── LeagueDivisions

User
├── UserRoles (multi-tenant)
├── Players (as parent)
├── TryoutSignups
├── Payments (as payer)
└── AuditLogs

Game
├── GameEvents (scoring log)
├── PlayerStats (derived)
└── Referee assignment

Player
├── TeamPlayers
├── PlayerStats
└── Offers
```

---

### 5.2 Complete Prisma Schema

```prisma
// schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============================================
// CORE ENTITIES
// ============================================

model User {
  id            String   @id @default(uuid())
  clerkId       String   @unique
  email         String   @unique
  firstName     String?
  lastName      String?
  phoneNumber   String?
  avatarUrl     String?
  
  // Relationships
  roles         UserRole[]
  players       Player[]  @relation("ParentPlayers")
  tryoutSignups TryoutSignup[]
  paymentsAsPayer Payment[] @relation("PayerPayments")
  paymentsAsPayee Payment[] @relation("PayeePayments")
  auditLogs     AuditLog[]
  reviews       Review[]
  announcements Announcement[]
  
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  @@index([email])
  @@index([clerkId])
}

model UserRole {
  id            String   @id @default(uuid())
  userId        String
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  role          Role
  
  // Scope (nullable based on role)
  tenantId      String?
  tenant        Tenant?  @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  
  teamId        String?
  team          Team?    @relation(fields: [teamId], references: [id], onDelete: Cascade)
  
  leagueId      String?
  league        League?  @relation(fields: [leagueId], references: [id], onDelete: Cascade)
  
  gameId        String?  // For temporary scorekeeper role
  game          Game?    @relation(fields: [gameId], references: [id], onDelete: Cascade)
  
  expiresAt     DateTime? // For temporary roles
  
  createdAt     DateTime @default(now())
  
  @@unique([userId, role, tenantId, teamId, leagueId, gameId])
  @@index([userId])
  @@index([tenantId])
  @@index([teamId])
  @@index([leagueId])
}

enum Role {
  ClubOwner
  ClubManager
  Coach
  TeamManager
  Scorekeeper
  LeagueOwner
  LeagueManager
  Parent
  Player
  Referee
  PlatformAdmin
}

// ============================================
// MULTI-TENANCY
// ============================================

model Tenant {
  id            String   @id @default(uuid())
  slug          String   @unique
  name          String
  description   String?  @db.Text
  customDomain  String?  @unique
  
  // Stripe
  stripeAccountId String? @unique
  stripeAccountStatus String? // active, pending, restricted
  
  // Subscription
  plan          TenantPlan @default(FREE)
  planExpiresAt DateTime?
  
  // Relationships
  branding      TenantBranding?
  features      TenantFeatures?
  teams         Team[]
  staff         UserRole[]
  tryouts       Tryout[]
  practices     Practice[]
  venues        Venue[]
  announcements Announcement[]
  payments      Payment[] @relation("TenantPayments")
  
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  @@index([slug])
  @@index([customDomain])
}

enum TenantPlan {
  FREE
  BASIC
  PRO
  ENTERPRISE
}

model TenantBranding {
  id            String   @id @default(uuid())
  tenantId      String   @unique
  tenant        Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  
  logoUrl       String?
  faviconUrl    String?
  primaryColor  String   @default("#1a73e8")
  secondaryColor String  @default("#34a853")
  accentColor   String   @default("#fbbc04")
  fontFamily    String   @default("Inter")
  customCss     String?  @db.Text
  
  emailLogoUrl  String?
  emailFooter   String?  @db.Text
  
  updatedAt     DateTime @updatedAt
}

model TenantFeatures {
  id                String   @id @default(uuid())
  tenantId          String   @unique
  tenant            Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  
  enableTournaments Boolean  @default(false)
  enableReviews     Boolean  @default(true)
  enableChat        Boolean  @default(false)
  enableAnalytics   Boolean  @default(false)
  
  maxTeams          Int      @default(10)
  maxStaff          Int      @default(5)
  maxVenues         Int      @default(3)
}

// ============================================
// TEAMS & PLAYERS
// ============================================

model Team {
  id            String   @id @default(uuid())
  tenantId      String
  tenant        Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  
  name          String
  ageGroup      String   // U10, U12, U14, etc.
  gender        Gender?
  season        String?  // "Spring 2026"
  description   String?  @db.Text
  
  // Relationships
  players       TeamPlayer[]
  staff         UserRole[]
  leagues       LeagueTeam[]
  homeGames     Game[]   @relation("HomeTeam")
  awayGames     Game[]   @relation("AwayTeam")
  practices     Practice[]
  announcements Announcement[]
  offers        Offer[]
  
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  @@index([tenantId])
  @@index([ageGroup])
}

enum Gender {
  MALE
  FEMALE
  COED
}

model Player {
  id            String   @id @default(uuid())
  
  // Personal Info
  firstName     String
  lastName      String
  dateOfBirth   DateTime
  gender        Gender
  jerseyNumber  String?
  
  // Parent/Guardian
  parentId      String
  parent        User     @relation("ParentPlayers", fields: [parentId], references: [id], onDelete: Cascade)
  
  // Relationships
  teams         TeamPlayer[]
  stats         PlayerStat[]
  offers        Offer[]
  
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  @@index([parentId])
}

model TeamPlayer {
  id            String   @id @default(uuid())
  teamId        String
  team          Team     @relation(fields: [teamId], references: [id], onDelete: Cascade)
  
  playerId      String
  player        Player   @relation(fields: [playerId], references: [id], onDelete: Cascade)
  
  status        TeamPlayerStatus @default(ACTIVE)
  joinedAt      DateTime @default(now())
  leftAt        DateTime?
  
  @@unique([teamId, playerId])
  @@index([teamId])
  @@index([playerId])
}

enum TeamPlayerStatus {
  ACTIVE
  INACTIVE
  SUSPENDED
}

// ============================================
// TRYOUTS & OFFERS
// ============================================

model Tryout {
  id            String   @id @default(uuid())
  tenantId      String
  tenant        Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  
  title         String
  description   String?  @db.Text
  ageGroup      String
  gender        Gender?
  
  location      String
  scheduledAt   DateTime
  duration      Int?     // minutes
  
  fee           Decimal  @db.Decimal(10, 2)
  maxParticipants Int?
  
  isPublished   Boolean  @default(false)
  isPublic      Boolean  @default(true)
  
  // Relationships
  signups       TryoutSignup[]
  
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  @@index([tenantId])
  @@index([scheduledAt])
  @@index([isPublished, isPublic])
}

model TryoutSignup {
  id            String   @id @default(uuid())
  tryoutId      String
  tryout        Tryout   @relation(fields: [tryoutId], references: [id], onDelete: Cascade)
  
  userId        String   // Parent
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  playerName    String
  playerAge     Int
  playerGender  Gender
  
  status        TryoutSignupStatus @default(PENDING)
  paymentId     String?  @unique
  payment       Payment? @relation(fields: [paymentId], references: [id])
  
  notes         String?  @db.Text
  
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  @@unique([tryoutId, userId, playerName])
  @@index([tryoutId])
  @@index([userId])
}

enum TryoutSignupStatus {
  PENDING
  PAID
  CONFIRMED
  CANCELLED
}

model Offer {
  id            String   @id @default(uuid())
  teamId        String
  team          Team     @relation(fields: [teamId], references: [id], onDelete: Cascade)
  
  playerId      String
  player        Player   @relation(fields: [playerId], references: [id], onDelete: Cascade)
  
  status        OfferStatus @default(PENDING)
  
  seasonFee     Decimal  @db.Decimal(10, 2)
  installments  Int      @default(1)
  
  message       String?  @db.Text
  expiresAt     DateTime
  
  respondedAt   DateTime?
  
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  @@index([teamId])
  @@index([playerId])
  @@index([status])
}

enum OfferStatus {
  PENDING
  ACCEPTED
  DECLINED
  EXPIRED
}

// ============================================
// LEAGUES & GAMES
// ============================================

model League {
  id            String   @id @default(uuid())
  name          String
  description   String?  @db.Text
  season        String   // "Spring 2026"
  
  ownerId       String
  
  // Stripe
  stripeAccountId String? @unique
  
  // Relationships
  divisions     LeagueDivision[]
  teams         LeagueTeam[]
  games         Game[]
  staff         UserRole[]
  
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  @@index([season])
}

model LeagueDivision {
  id            String   @id @default(uuid())
  leagueId      String
  league        League   @relation(fields: [leagueId], references: [id], onDelete: Cascade)
  
  name          String   // "U12 Boys Division A"
  ageGroup      String
  gender        Gender?
  
  teams         LeagueTeam[]
  
  @@index([leagueId])
}

model LeagueTeam {
  id            String   @id @default(uuid())
  leagueId      String
  league        League   @relation(fields: [leagueId], references: [id], onDelete: Cascade)
  
  divisionId    String?
  division      LeagueDivision? @relation(fields: [divisionId], references: [id])
  
  teamId        String
  team          Team     @relation(fields: [teamId], references: [id], onDelete: Cascade)
  
  status        LeagueTeamStatus @default(PENDING)
  registrationFee Decimal? @db.Decimal(10, 2)
  paymentId     String?  @unique
  payment       Payment? @relation(fields: [paymentId], references: [id])
  
  createdAt     DateTime @default(now())
  
  @@unique([leagueId, teamId])
  @@index([leagueId])
  @@index([teamId])
}

enum LeagueTeamStatus {
  PENDING
  APPROVED
  REJECTED
  WITHDRAWN
}

model Game {
  id            String   @id @default(uuid())
  leagueId      String?
  league        League?  @relation(fields: [leagueId], references: [id])
  
  homeTeamId    String
  homeTeam      Team     @relation("HomeTeam", fields: [homeTeamId], references: [id])
  
  awayTeamId    String
  awayTeam      Team     @relation("AwayTeam", fields: [awayTeamId], references: [id])
  
  venueId       String?
  venue         Venue?   @relation(fields: [venueId], references: [id])
  
  scheduledAt   DateTime
  status        GameStatus @default(SCHEDULED)
  
  // Scoring
  homeScore     Int?
  awayScore     Int?
  
  // Relationships
  events        GameEvent[]
  stats         PlayerStat[]
  scorekeepers  UserRole[]
  
  finalizedAt   DateTime?
  
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  @@index([leagueId])
  @@index([homeTeamId])
  @@index([awayTeamId])
  @@index([scheduledAt])
  @@index([status])
}

enum GameStatus {
  SCHEDULED
  LIVE
  COMPLETED
  CANCELLED
  POSTPONED
}

model GameEvent {
  id            String   @id @default(uuid())
  gameId        String
  game          Game     @relation(fields: [gameId], references: [id], onDelete: Cascade)
  
  eventType     GameEventType
  teamId        String   // Team that scored/fouled
  playerId      String?  // Player involved
  
  points        Int?     // For SCORE events
  quarter       Int?     // 1-4
  timestamp     DateTime @default(now())
  
  metadata      Json?    // Additional event data
  
  @@index([gameId])
  @@index([teamId])
  @@index([playerId])
}

enum GameEventType {
  SCORE_2PT
  SCORE_3PT
  SCORE_FT
  REBOUND
  ASSIST
  STEAL
  BLOCK
  TURNOVER
  FOUL
  TIMEOUT
  SUBSTITUTION
}

model PlayerStat {
  id            String   @id @default(uuid())
  gameId        String
  game          Game     @relation(fields: [gameId], references: [id], onDelete: Cascade)
  
  playerId      String
  player        Player   @relation(fields: [playerId], references: [id], onDelete: Cascade)
  
  // Stats
  points        Int      @default(0)
  rebounds      Int      @default(0)
  assists       Int      @default(0)
  steals        Int      @default(0)
  blocks        Int      @default(0)
  turnovers     Int      @default(0)
  fouls         Int      @default(0)
  
  minutesPlayed Int?
  
  @@unique([gameId, playerId])
  @@index([gameId])
  @@index([playerId])
}

// ============================================
// VENUES & PRACTICES
// ============================================

model Venue {
  id            String   @id @default(uuid())
  tenantId      String
  tenant        Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  
  name          String
  address       String
  city          String
  state         String
  zipCode       String
  
  capacity      Int?
  notes         String?  @db.Text
  
  games         Game[]
  practices     Practice[]
  
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  @@index([tenantId])
}

model Practice {
  id            String   @id @default(uuid())
  tenantId      String
  tenant        Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  
  teamId        String
  team          Team     @relation(fields: [teamId], references: [id], onDelete: Cascade)
  
  venueId       String?
  venue         Venue?   @relation(fields: [venueId], references: [id])
  
  scheduledAt   DateTime
  duration      Int      // minutes
  
  notes         String?  @db.Text
  status        PracticeStatus @default(SCHEDULED)
  
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  @@index([tenantId])
  @@index([teamId])
  @@index([scheduledAt])
}

enum PracticeStatus {
  SCHEDULED
  COMPLETED
  CANCELLED
}

// ============================================
// PAYMENTS
// ============================================

model Payment {
  id            String   @id @default(uuid())
  
  // Stripe
  stripePaymentIntentId String? @unique
  stripeChargeId        String? @unique
  
  // Parties
  payerId       String
  payer         User     @relation("PayerPayments", fields: [payerId], references: [id])
  
  payeeId       String?  // Club/League owner
  payee         User?    @relation("PayeePayments", fields: [payeeId], references: [id])
  
  tenantId      String?  // If club payment
  tenant        Tenant?  @relation("TenantPayments", fields: [tenantId], references: [id])
  
  // Payment Details
  amount        Decimal  @db.Decimal(10, 2)
  currency      String   @default("usd")
  platformFee   Decimal? @db.Decimal(10, 2)
  
  status        PaymentStatus @default(PENDING)
  
  // Context
  paymentType   PaymentType
  description   String?
  
  // Relationships
  tryoutSignup  TryoutSignup?
  leagueTeam    LeagueTeam?
  
  // Refund
  refundedAt    DateTime?
  refundAmount  Decimal? @db.Decimal(10, 2)
  
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  @@index([payerId])
  @@index([payeeId])
  @@index([tenantId])
  @@index([status])
  @@index([paymentType])
}

enum PaymentStatus {
  PENDING
  PROCESSING
  SUCCEEDED
  FAILED
  REFUNDED
  DISPUTED
}

enum PaymentType {
  TRYOUT_FEE
  SEASON_FEE
  LEAGUE_FEE
  TOURNAMENT_FEE
  REFEREE_FEE
  OTHER
}

// ============================================
// COMMUNICATIONS
// ============================================

model Announcement {
  id            String   @id @default(uuid())
  tenantId      String?
  tenant        Tenant?  @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  
  teamId        String?
  team          Team?    @relation(fields: [teamId], references: [id], onDelete: Cascade)
  
  authorId      String
  author        User     @relation(fields: [authorId], references: [id])
  
  title         String
  content       String   @db.Text
  
  isPinned      Boolean  @default(false)
  
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  @@index([tenantId])
  @@index([teamId])
  @@index([createdAt])
}

// ============================================
// REVIEWS & RATINGS (v1+)
// ============================================

model Review {
  id            String   @id @default(uuid())
  
  reviewerId    String
  reviewer      User     @relation(fields: [reviewerId], references: [id])
  
  // Target (one of these)
  tenantId      String?  // Review of club
  tenant        Tenant?  @relation(fields: [tenantId], references: [id])
  
  leagueId      String?  // Review of league
  league        League?  @relation(fields: [leagueId], references: [id])
  
  // Content
  rating        Int      // 1-5
  title         String?
  content       String?  @db.Text
  
  status        ReviewStatus @default(PUBLISHED)
  
  // Moderation
  flaggedAt     DateTime?
  moderatedAt   DateTime?
  moderatorNotes String? @db.Text
  
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  @@index([tenantId])
  @@index([leagueId])
  @@index([reviewerId])
  @@index([status])
}

enum ReviewStatus {
  PUBLISHED
  FLAGGED
  REMOVED
}

// ============================================
// AUDIT & LOGGING
// ============================================

model AuditLog {
  id            String   @id @default(uuid())
  
  userId        String
  user          User     @relation(fields: [userId], references: [id])
  userRole      Role
  
  action        String   // CREATE, UPDATE, DELETE, etc.
  resource      String   // Team, Payment, etc.
  resourceId    String
  
  tenantId      String?
  ipAddress     String
  userAgent     String
  
  changes       Json?
  metadata      Json?
  
  createdAt     DateTime @default(now())
  
  @@index([userId, createdAt])
  @@index([tenantId, createdAt])
  @@index([resource, resourceId])
}
```

---

### 5.3 Key Indexes & Constraints

#### Performance Indexes

| Table | Index | Purpose |
|-------|-------|---------|
| `User` | `email`, `clerkId` | Fast auth lookups |
| `UserRole` | `userId`, `tenantId`, `teamId` | Permission checks |
| `Tenant` | `slug`, `customDomain` | Domain routing |
| `Team` | `tenantId`, `ageGroup` | Tenant isolation, filtering |
| `Game` | `scheduledAt`, `status`, `leagueId` | Schedule queries |
| `Payment` | `payerId`, `status`, `paymentType` | Payment history |
| `AuditLog` | `userId + createdAt`, `tenantId + createdAt` | Audit queries |

#### Unique Constraints

- `User.email`, `User.clerkId`
- `Tenant.slug`, `Tenant.customDomain`
- `UserRole.[userId, role, tenantId, teamId, leagueId, gameId]` (composite)
- `TeamPlayer.[teamId, playerId]`
- `LeagueTeam.[leagueId, teamId]`
- `PlayerStat.[gameId, playerId]`

---

### 5.4 Data Retention & Archival

| Data Type | Retention | Strategy |
|-----------|-----------|----------|
| **Financial** (Payments, Audit) | 7 years | Keep in hot DB, archive to S3 Glacier after 2 years |
| **Games & Stats** | Indefinite | Keep all (core product value) |
| **User Accounts** | Until deletion request | Soft delete (mark inactive), hard delete after 90 days |
| **Tryout Signups** | 2 years | Archive old seasons |
| **Announcements** | 1 year | Auto-archive, allow manual deletion |

---


## 6. API Design

### 6.1 API Architecture Decision: **REST**

**Choice**: REST over GraphQL for MVP

**Rationale**:
- ✅ Simpler for mobile (Capacitor) integration
- ✅ Better caching with HTTP (Vercel Edge)
- ✅ Easier to secure with RBAC
- ✅ Standard tooling (OpenAPI, Postman)
- ❌ GraphQL considered for v2+ if complex nested queries become common

---

### 6.2 API Structure

```
/api/v1
├── /auth (Clerk webhooks)
├── /tenants (clubs)
├── /teams
├── /players
├── /tryouts
├── /offers
├── /leagues
├── /games
├── /payments
├── /webhooks (Stripe)
└── /admin
```

---

### 6.3 Critical Endpoints (with Examples)

#### 6.3.1 Club Management

**POST /api/v1/tenants**
```typescript
// Create/Claim Club
Request:
{
  "name": "Warriors Basketball Club",
  "slug": "warriors", // auto-generated if not provided
  "description": "Elite youth basketball program"
}

Response: 201
{
  "id": "uuid",
  "slug": "warriors",
  "name": "Warriors Basketball Club",
  "subdomain": "warriors.youthbasketballhub.com",
  "stripeAccountStatus": "pending",
  "createdAt": "2026-02-14T..."
}
```

---

#### 6.3.2 Tryout Flow

**POST /api/v1/tryouts**
```typescript
// Create Tryout
Request:
{
  "title": "U12 Boys Tryouts - Spring 2026",
  "ageGroup": "U12",
  "gender": "MALE",
  "location": "Main Gym, 123 Main St",
  "scheduledAt": "2026-03-15T10:00:00Z",
  "duration": 120,
  "fee": 50.00,
  "maxParticipants": 30,
  "isPublic": true
}

Response: 201
{
  "id": "uuid",
  "tenantId": "uuid",
  "title": "U12 Boys Tryouts - Spring 2026",
  "isPublished": false, // Must explicitly publish
  "signupUrl": "https://warriors.youthbasketballhub.com/tryouts/uuid"
}
```

**POST /api/v1/tryouts/:id/publish**
```typescript
// Publish to Marketplace
Response: 200
{
  "id": "uuid",
  "isPublished": true,
  "marketplaceUrl": "https://app.youthbasketballhub.com/tryouts/uuid"
}
```

**POST /api/v1/tryouts/:id/signups**
```typescript
// Parent Signs Up
Request:
{
  "playerName": "John Doe",
  "playerAge": 11,
  "playerGender": "MALE",
  "notes": "First time trying out"
}

Response: 201
{
  "id": "uuid",
  "status": "PENDING",
  "paymentIntent": {
    "clientSecret": "pi_xxx_secret_yyy",
    "amount": 5000, // cents
    "currency": "usd"
  }
}
```

---

#### 6.3.3 Offer Flow

**POST /api/v1/offers**
```typescript
// Coach Makes Offer
Request:
{
  "teamId": "uuid",
  "playerId": "uuid",
  "seasonFee": 800.00,
  "installments": 4,
  "message": "We'd love to have John on the team!",
  "expiresAt": "2026-03-22T23:59:59Z"
}

Response: 201
{
  "id": "uuid",
  "status": "PENDING",
  "expiresAt": "2026-03-22T23:59:59Z"
}
// Triggers email to parent
```

**PUT /api/v1/offers/:id/accept**
```typescript
// Parent Accepts
Response: 200
{
  "id": "uuid",
  "status": "ACCEPTED",
  "respondedAt": "2026-03-16T...",
  "paymentSchedule": [
    { "amount": 200.00, "dueDate": "2026-04-01" },
    { "amount": 200.00, "dueDate": "2026-05-01" },
    { "amount": 200.00, "dueDate": "2026-06-01" },
    { "amount": 200.00, "dueDate": "2026-07-01" }
  ]
}
// Creates TeamPlayer record
```

---

#### 6.3.4 League Registration

**POST /api/v1/leagues/:leagueId/teams**
```typescript
// Club Submits Team to League
Request:
{
  "teamId": "uuid",
  "divisionId": "uuid" // optional
}

Response: 201
{
  "id": "uuid",
  "status": "PENDING",
  "registrationFee": 500.00,
  "paymentIntent": {
    "clientSecret": "pi_xxx_secret_yyy"
  }
}
```

**PUT /api/v1/leagues/:leagueId/teams/:id/approve**
```typescript
// League Approves Team
Response: 200
{
  "id": "uuid",
  "status": "APPROVED",
  "approvedAt": "2026-03-20T..."
}
```

---

#### 6.3.5 Schedule Management

**POST /api/v1/leagues/:leagueId/schedule**
```typescript
// Create Schedule (Manual for MVP)
Request:
{
  "games": [
    {
      "homeTeamId": "uuid",
      "awayTeamId": "uuid",
      "venueId": "uuid",
      "scheduledAt": "2026-04-05T14:00:00Z"
    },
    // ... more games
  ]
}

Response: 201
{
  "gamesCreated": 24,
  "conflicts": [] // Empty if no conflicts
}
```

**GET /api/v1/games/conflicts?venueId=uuid&start=...&end=...**
```typescript
// Check for Conflicts
Response: 200
{
  "conflicts": [
    {
      "venueId": "uuid",
      "scheduledAt": "2026-04-05T14:00:00Z",
      "existingGame": {
        "id": "uuid",
        "homeTeam": "Team A",
        "awayTeam": "Team B"
      }
    }
  ]
}
```

---

#### 6.3.6 Live Scorekeeping

**POST /api/v1/games/:id/events**
```typescript
// Scorekeeper Logs Event
Request:
{
  "eventType": "SCORE_2PT",
  "teamId": "uuid",
  "playerId": "uuid",
  "quarter": 2,
  "timestamp": "2026-04-05T14:23:15Z"
}

Response: 201
{
  "id": "uuid",
  "eventType": "SCORE_2PT",
  "points": 2,
  "currentScore": {
    "home": 24,
    "away": 18
  }
}
// Broadcasts via WebSocket to game_id room
```

**WebSocket: /ws/games/:id**
```typescript
// Real-time Updates
Client subscribes:
{
  "action": "subscribe",
  "gameId": "uuid"
}

Server broadcasts on event:
{
  "type": "SCORE_UPDATE",
  "gameId": "uuid",
  "homeScore": 24,
  "awayScore": 18,
  "lastEvent": {
    "eventType": "SCORE_2PT",
    "playerName": "John Doe",
    "teamName": "Warriors U12"
  }
}
```

**POST /api/v1/games/:id/finalize**
```typescript
// Finalize Game (locks score, calculates stats)
Response: 200
{
  "id": "uuid",
  "status": "COMPLETED",
  "finalScore": { "home": 52, "away": 48 },
  "finalizedAt": "2026-04-05T16:00:00Z",
  "statsGenerated": true
}
```

---

#### 6.3.7 Payments

**POST /api/v1/payments/intents**
```typescript
// Create Payment Intent
Request:
{
  "amount": 50.00,
  "paymentType": "TRYOUT_FEE",
  "tryoutSignupId": "uuid"
}

Response: 201
{
  "id": "uuid",
  "clientSecret": "pi_xxx_secret_yyy",
  "amount": 5000,
  "currency": "usd",
  "status": "PENDING"
}
```

**POST /api/webhooks/stripe**
```typescript
// Stripe Webhook Handler
Event: payment_intent.succeeded
{
  "id": "evt_xxx",
  "type": "payment_intent.succeeded",
  "data": {
    "object": {
      "id": "pi_xxx",
      "amount": 5000,
      "metadata": {
        "paymentId": "uuid",
        "tryoutSignupId": "uuid"
      }
    }
  }
}

Action:
- Update Payment status to SUCCEEDED
- Update TryoutSignup status to PAID
- Send confirmation email
```

---

### 6.4 API Security

#### Authentication
- **Clerk JWT** in `Authorization: Bearer <token>` header
- Validate on every request
- Extract `userId` and `tenantId` from token

#### Rate Limiting
```typescript
// Per-user limits
const limits = {
  authenticated: '100 req/min',
  unauthenticated: '20 req/min',
  payment: '10 req/min' // Stricter for sensitive ops
};
```

#### Tenant Isolation
```typescript
// Middleware enforces tenant context
export async function withTenant(handler) {
  return async (req, res) => {
    const tenantId = getTenantIdFromRequest(req);
    return runWithTenant(tenantId, () => handler(req, res));
  };
}
```

---

## 7. Payments, Fees, Payouts (Stripe + Connect)

### 7.1 Payment Architecture

**Platform as Merchant of Record** for all transactions

```
Parent → Stripe → Platform Account
                      ↓
                 Destination Charge
                      ↓
              Club/League Connect Account
```

---

### 7.2 Payment Flows

#### Flow 1: Tryout Fee

1. **Parent signs up** for tryout
2. **Platform creates** Payment Intent ($50)
3. **Parent pays** via Stripe Checkout
4. **Platform receives** $50 - Stripe fee (2.9% + $0.30) = ~$48.55
5. **Platform transfers** $48.55 - platform fee (5%) = ~$46.12 to Club Connect account
6. **Club receives** $46.12 in 2 business days

**Code**:
```typescript
const paymentIntent = await stripe.paymentIntents.create({
  amount: 5000, // $50
  currency: 'usd',
  application_fee_amount: 244, // 5% platform fee
  transfer_data: {
    destination: clubStripeAccountId,
  },
  metadata: {
    tryoutSignupId: signup.id,
    tenantId: club.id,
  }
});
```

---

#### Flow 2: Season Fee (Installments)

1. **Parent accepts** offer ($800, 4 installments)
2. **Platform creates** 4 Payment Intents ($200 each)
3. **Platform schedules** charges for 1st of each month
4. **Each charge** follows same flow as tryout fee
5. **If payment fails**: Retry 3 times, notify parent + club

**Code**:
```typescript
// Create subscription-like installments
for (let i = 0; i < installments; i++) {
  await prisma.payment.create({
    data: {
      amount: seasonFee / installments,
      paymentType: 'SEASON_FEE',
      status: 'PENDING',
      dueDate: addMonths(startDate, i),
      payerId: parent.id,
      tenantId: club.id,
    }
  });
}

// Background job processes due payments daily
```

---

#### Flow 3: League Fee

1. **Club submits** team to league
2. **Platform creates** Payment Intent ($500)
3. **Club pays** (ClubOwner's saved payment method)
4. **Platform transfers** to League Connect account
5. **League receives** payout

---

#### Flow 4: Referee Fee

1. **Referee completes** game
2. **League/Club approves** payout ($50)
3. **Platform creates** Transfer to Referee Connect account
4. **Referee receives** payout in 2 business days

**Code**:
```typescript
const transfer = await stripe.transfers.create({
  amount: 5000,
  currency: 'usd',
  destination: refereeStripeAccountId,
  metadata: {
    gameId: game.id,
    refereeId: referee.id,
  }
});
```

---

### 7.3 Stripe Connect Onboarding

**Express Accounts** for Clubs, Leagues, Referees

```typescript
// Create Connect account
const account = await stripe.accounts.create({
  type: 'express',
  country: 'US',
  email: clubOwner.email,
  capabilities: {
    card_payments: { requested: true },
    transfers: { requested: true },
  },
  business_type: 'individual', // or 'company'
  metadata: {
    tenantId: club.id,
  }
});

// Create onboarding link
const accountLink = await stripe.accountLinks.create({
  account: account.id,
  refresh_url: 'https://warriors.youthbasketballhub.com/settings/payments',
  return_url: 'https://warriors.youthbasketballhub.com/settings/payments/success',
  type: 'account_onboarding',
});

// Redirect club owner to accountLink.url
```

**Webhook**: `account.updated`
```typescript
if (event.type === 'account.updated') {
  const account = event.data.object;
  await prisma.tenant.update({
    where: { stripeAccountId: account.id },
    data: {
      stripeAccountStatus: account.charges_enabled ? 'active' : 'pending',
    }
  });
}
```

---

### 7.4 Refunds & Disputes

#### Refund Flow
1. **Club initiates** refund (e.g., tryout cancelled)
2. **Platform creates** Refund via Stripe API
3. **Stripe reverses** charge to parent
4. **Platform reverses** transfer from club (if already paid out)

```typescript
const refund = await stripe.refunds.create({
  payment_intent: paymentIntentId,
  reverse_transfer: true, // Deduct from club's balance
});
```

#### Dispute Flow
1. **Parent disputes** charge with bank
2. **Stripe webhook** `charge.dispute.created`
3. **Platform notifies** club owner
4. **Club uploads** evidence via dashboard
5. **Platform submits** evidence to Stripe
6. **Stripe resolves** dispute (won/lost)

---

### 7.5 Ledger & Reconciliation

**Daily Reconciliation Job**:
```typescript
// Sync Stripe balance with DB
const balance = await stripe.balance.retrieve();
const dbBalance = await calculatePlatformBalance();

if (balance.available[0].amount !== dbBalance) {
  await logDiscrepancy({ stripe: balance, db: dbBalance });
  await notifyAdmin();
}
```

**Audit Trail**: All payment events logged in `AuditLog` table

---

## 8. UX / Screens (Mobile-first)

### 8.1 Screen Inventory

#### Club Owner Screens
1. **Dashboard** - Overview, quick actions
2. **Teams** - List, create, manage
3. **Tryouts** - Create, publish, view signups
4. **Staff** - Invite coaches, managers
5. **Schedule** - Practices, games calendar
6. **Payments** - Revenue, payouts, history
7. **Settings** - Branding, domain, Stripe
8. **Analytics** (v1+) - Signups, retention, revenue

#### Parent Screens
1. **Home** - Upcoming games, announcements
2. **Marketplace** - Browse tryouts
3. **Tryout Detail** - Info, signup, pay
4. **My Kids** - Manage players
5. **Team** - Roster, schedule, stats
6. **Payments** - History, upcoming
7. **Notifications** - Offers, announcements

#### League Owner Screens
1. **Dashboard** - League overview
2. **Teams** - Approve registrations
3. **Schedule** - Create, manage games
4. **Standings** - Live standings, stats
5. **Referees** - Assign, manage
6. **Payments** - Fees, payouts

#### Scorekeeper Screens
1. **Game Detail** - Live scorekeeping
2. **Event Log** - Add/edit events
3. **Stats Preview** - Real-time stats
4. **Finalize** - Lock score

---

### 8.2 Key User Flows

#### Flow 1: Club Onboarding

**Screens**:
1. **Landing** → "Start Your Club" CTA
2. **Sign Up** (Clerk) → Email/password
3. **Create Club** → Name, slug, description
4. **Stripe Onboarding** → Redirect to Stripe Express
5. **Branding** → Upload logo, pick colors (optional)
6. **Dashboard** → "Create Your First Tryout" CTA

**Notifications**:
- Email: "Welcome to Youth Basketball Hub"
- Email: "Complete your Stripe setup" (if skipped)

---

#### Flow 2: Parent Discovers Tryout → Joins Team

**Screens**:
1. **Marketplace** → Search "U10 tryouts near me"
2. **Tryout List** → Filter by age, location, date
3. **Tryout Detail** → Club profile, reviews, details
4. **Sign Up** → Create account (Clerk)
5. **Add Player** → Name, DOB, gender
6. **Payment** → Stripe Checkout ($50)
7. **Confirmation** → "You're signed up!"
8. **Tryout Day** → Reminder notification
9. **Offer Received** → Push notification
10. **Offer Detail** → Team info, season fee
11. **Accept Offer** → Payment schedule
12. **Payment** → First installment
13. **Team Dashboard** → Schedule, roster, announcements

**Notifications**:
- Email: "Tryout signup confirmed"
- Push: "1 day until tryout"
- Push: "You have an offer from Warriors U10!"
- Email: "Welcome to Warriors U10"
- Push: "Payment due in 3 days"

---

#### Flow 3: League Creates Season

**Screens**:
1. **Create League** → Name, season, divisions
2. **Set Fees** → Registration fee per team
3. **Publish** → Open for registrations
4. **Review Teams** → Approve/reject
5. **Create Schedule** → Manual game creation (MVP)
   - Select teams, venues, dates
   - Conflict detection
6. **Assign Referees** → Request referees
7. **Publish Schedule** → Notify teams
8. **Live Season** → Monitor games, standings
9. **Playoffs** → Auto-generate bracket
10. **Season End** → Publish final stats

---

#### Flow 4: Live Scorekeeping

**Screens**:
1. **Game Detail** → Pre-game (SCHEDULED)
2. **Start Game** → Status → LIVE
3. **Scorekeeping UI**:
   - Team scores (large, prominent)
   - Quick actions: +2, +3, +1 (FT)
   - Player selector (dropdown)
   - Event log (scrollable)
4. **Real-time Updates** → Parents see live score
5. **Finalize Game** → Lock score, generate stats
6. **Game Summary** → Final score, top performers

**UI Components**:
```
┌─────────────────────────────┐
│  Warriors U12  vs  Eagles   │
│      52           48         │ ← Large scores
├─────────────────────────────┤
│  Q4  2:15                   │ ← Quarter, time
├─────────────────────────────┤
│  [+2] [+3] [+1] [Rebound]   │ ← Quick actions
│  Player: [John Doe ▼]       │
├─────────────────────────────┤
│  Event Log:                 │
│  • 2:15 - John Doe +2       │
│  • 2:45 - Jane Smith +3     │
│  • 3:10 - Timeout           │
└─────────────────────────────┘
```

---

### 8.3 Notification Strategy

| Event | Channel | Timing | Recipient |
|-------|---------|--------|-----------|
| Tryout signup confirmed | Email | Immediate | Parent |
| Tryout reminder | Push + Email | 1 day before | Parent |
| Offer received | Push + Email | Immediate | Parent |
| Offer expiring | Push | 1 day before expiry | Parent |
| Payment due | Email | 3 days before | Parent |
| Payment failed | Push + Email | Immediate | Parent + Club |
| Game reminder | Push | 1 hour before | Parent, Coach |
| Score update | Push (optional) | Live | Parent (if subscribed) |
| Announcement | Push + Email | Immediate | Team members |
| Schedule published | Email | Immediate | All teams |

---

## 9. Scheduling Engine

### 9.1 MVP Approach: Manual + Conflict Detection

**Philosophy**: Manual scheduling with smart conflict detection (not auto-generation)

---

### 9.2 Data Model

```typescript
model Game {
  id            String   @id
  leagueId      String?
  homeTeamId    String
  awayTeamId    String
  venueId       String?
  scheduledAt   DateTime
  duration      Int      @default(90) // minutes
  status        GameStatus
}

model Venue {
  id            String   @id
  tenantId      String
  name          String
  capacity      Int?
  // No availability model in MVP (manual check)
}
```

---

### 9.3 Conflict Detection

**Conflicts to Check**:
1. **Venue double-booking**: Same venue, overlapping time
2. **Team double-booking**: Team playing 2 games at same time
3. **Referee double-booking** (v1+): Referee assigned to 2 games
4. **Minimum rest**: Team playing < 24 hours apart (warning)

**Algorithm**:
```typescript
async function detectConflicts(game: GameInput): Promise<Conflict[]> {
  const conflicts: Conflict[] = [];
  const { homeTeamId, awayTeamId, venueId, scheduledAt, duration } = game;
  
  const start = scheduledAt;
  const end = addMinutes(scheduledAt, duration);

  // 1. Venue conflict
  if (venueId) {
    const venueGames = await prisma.game.findMany({
      where: {
        venueId,
        scheduledAt: { gte: subMinutes(start, 90), lte: addMinutes(end, 90) },
        status: { in: ['SCHEDULED', 'LIVE'] }
      }
    });
    if (venueGames.length > 0) {
      conflicts.push({ type: 'VENUE', games: venueGames });
    }
  }

  // 2. Team conflict
  const teamGames = await prisma.game.findMany({
    where: {
      OR: [
        { homeTeamId: { in: [homeTeamId, awayTeamId] } },
        { awayTeamId: { in: [homeTeamId, awayTeamId] } }
      ],
      scheduledAt: { gte: start, lte: end },
      status: { in: ['SCHEDULED', 'LIVE'] }
    }
  });
  if (teamGames.length > 0) {
    conflicts.push({ type: 'TEAM', games: teamGames });
  }

  // 3. Minimum rest (warning)
  const recentGames = await prisma.game.findMany({
    where: {
      OR: [
        { homeTeamId: { in: [homeTeamId, awayTeamId] } },
        { awayTeamId: { in: [homeTeamId, awayTeamId] } }
      ],
      scheduledAt: { gte: subHours(start, 24), lt: start },
      status: 'COMPLETED'
    }
  });
  if (recentGames.length > 0) {
    conflicts.push({ type: 'MIN_REST_WARNING', games: recentGames });
  }

  return conflicts;
}
```

---

### 9.4 Schedule Creation UI

**Bulk Create Flow**:
1. **Upload CSV** (optional):
   ```csv
   home_team,away_team,venue,date,time
   Warriors U12,Eagles U12,Main Gym,2026-04-05,14:00
   ```
2. **Or Manual Entry**: Form with team/venue/date pickers
3. **Conflict Check**: Run on each game
4. **Review**: Show conflicts, allow override
5. **Publish**: Create all games, notify teams

---

### 9.5 Reschedule Workflow

1. **League Owner** selects game
2. **Edit** date/time/venue
3. **Conflict Check** runs
4. **Save** → Updates game
5. **Notify** both teams + referees (if assigned)
6. **Audit Log** records change

---

### 9.6 v1+ Auto-Scheduling (Future)

**Constraints**:
- Each team plays N games (e.g., 8)
- Home/away balance
- Venue availability
- No back-to-back games
- Minimize travel (if geo data available)

**Algorithm**: Constraint satisfaction problem (CSP) or genetic algorithm

**Libraries**: Consider `optaplanner` (Java) or custom Python script

---

## 10. Implementation Plan (Next.js)

### 10.1 Project Structure

```
youth-basketball-hub/
├── apps/
│   └── web/                    # Next.js app
│       ├── app/
│       │   ├── (auth)/         # Auth pages
│       │   ├── (platform)/     # Global marketplace
│       │   ├── (tenant)/       # Tenant-scoped pages
│       │   ├── api/            # API routes
│       │   └── layout.tsx
│       ├── middleware.ts       # Tenant routing
│       └── package.json
├── packages/
│   ├── db/                     # Prisma schema, client
│   ├── ui/                     # Shared components (shadcn/ui)
│   ├── auth/                   # Clerk utilities
│   ├── payments/               # Stripe utilities
│   └── config/                 # Shared config
├── prisma/
│   └── schema.prisma
└── package.json                # Monorepo root
```

---

### 10.2 Tech Stack

| Layer | Technology | Justification |
|-------|------------|---------------|
| **Framework** | Next.js 14 (App Router) | SSR, RSC, API routes, Vercel integration |
| **Language** | TypeScript | Type safety, DX |
| **Database** | PostgreSQL (Supabase) | Relational, RLS, Realtime |
| **ORM** | Prisma | Type-safe queries, migrations |
| **Auth** | Clerk | Multi-tenant, RBAC, COPPA-compliant |
| **Payments** | Stripe + Connect | Industry standard, Express accounts |
| **UI** | shadcn/ui + Tailwind CSS | Accessible, customizable, modern |
| **State** | React Query (TanStack Query) | Server state, caching, optimistic updates |
| **Forms** | React Hook Form + Zod | Validation, type safety |
| **Real-time** | Supabase Realtime (or Socket.io) | Live scoring, notifications |
| **Background Jobs** | Inngest | Type-safe, retries, observability |
| **File Storage** | Vercel Blob | Integrated, simple API |
| **Monitoring** | Sentry + Vercel Analytics | Error tracking, performance |
| **Email** | Resend | Developer-friendly, templates |

---

### 10.3 Key Libraries

```json
{
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.2.0",
    "typescript": "^5.3.0",
    "@prisma/client": "^5.7.0",
    "@clerk/nextjs": "^4.27.0",
    "stripe": "^14.9.0",
    "@tanstack/react-query": "^5.14.0",
    "react-hook-form": "^7.49.0",
    "zod": "^3.22.0",
    "@radix-ui/react-*": "^1.0.0", // shadcn/ui primitives
    "tailwindcss": "^3.4.0",
    "inngest": "^3.8.0",
    "resend": "^2.1.0",
    "@supabase/supabase-js": "^2.38.0",
    "date-fns": "^3.0.0",
    "recharts": "^2.10.0" // Analytics charts
  },
  "devDependencies": {
    "prisma": "^5.7.0",
    "@types/node": "^20.10.0",
    "eslint": "^8.56.0",
    "prettier": "^3.1.0"
  }
}
```

---

### 10.4 CI/CD Pipeline

**GitHub Actions**:
```yaml
name: CI/CD
on: [push, pull_request]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run lint
      - run: npm run type-check

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run test

  deploy-preview:
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}

  deploy-production:
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
```

---

### 10.5 Security Checklist

- [ ] **Environment Variables**: Never commit secrets, use Vercel env vars
- [ ] **HTTPS Only**: Enforce HTTPS (Vercel default)
- [ ] **CORS**: Restrict to known origins
- [ ] **CSRF Protection**: Use Next.js built-in (SameSite cookies)
- [ ] **SQL Injection**: Prisma parameterized queries (safe by default)
- [ ] **XSS**: React escapes by default, avoid `dangerouslySetInnerHTML`
- [ ] **Rate Limiting**: Implement per-user/IP limits
- [ ] **Input Validation**: Zod schemas on all API routes
- [ ] **Tenant Isolation**: RLS + middleware enforcement
- [ ] **Audit Logging**: Log all sensitive operations
- [ ] **Stripe Webhooks**: Verify signatures
- [ ] **Clerk Webhooks**: Verify signatures
- [ ] **File Uploads**: Validate file types, size limits
- [ ] **Password Policy**: Enforced by Clerk (min 8 chars, complexity)
- [ ] **MFA**: Optional for users, required for admins

---

## 11. MVP Delivery Plan

### 11.1 Epics & Acceptance Criteria

#### Epic 1: Foundation (Week 1-2)
**Goal**: Project setup, auth, multi-tenancy

**Stories**:
1. **Setup Next.js monorepo** with Turborepo
   - AC: `npm run dev` starts app, `npm run lint` passes
2. **Integrate Clerk** for auth
   - AC: User can sign up, log in, log out
3. **Setup Prisma** with Postgres
   - AC: Migrations run, seed data loads
4. **Implement tenant routing** (middleware)
   - AC: Subdomain resolves to correct tenant, custom domain works (manual test)
5. **Tenant isolation** (RLS + middleware)
   - AC: User from Club A cannot query Club B's data (unit test)

---

#### Epic 2: Club Management (Week 3-4)
**Goal**: Club owners can create clubs, teams, staff

**Stories**:
1. **Create club** flow
   - AC: User can create club, gets subdomain
2. **Stripe Connect onboarding**
   - AC: Club owner completes onboarding, account status updates
3. **Branding setup**
   - AC: Upload logo, pick colors, see live preview
4. **Create team**
   - AC: Club owner creates team (name, age group, gender)
5. **Invite staff**
   - AC: Send invite, coach receives email, accepts, gets role

---

#### Epic 3: Tryouts & Offers (Week 5-6)
**Goal**: Clubs can run tryouts, parents can sign up, coaches make offers

**Stories**:
1. **Create tryout**
   - AC: Club owner creates tryout, sets fee, publishes to marketplace
2. **Tryout marketplace**
   - AC: Parent browses tryouts, filters by age/location
3. **Tryout signup + payment**
   - AC: Parent signs up, pays via Stripe, receives confirmation
4. **Make offer**
   - AC: Coach makes offer, parent receives notification
5. **Accept offer + payment schedule**
   - AC: Parent accepts, sees installment schedule, pays first installment

---

#### Epic 4: Leagues & Games (Week 7-8)
**Goal**: Leagues can accept teams, create schedules

**Stories**:
1. **Create league**
   - AC: League owner creates league, sets divisions, fees
2. **Submit team to league**
   - AC: Club owner submits team, pays fee
3. **Approve team**
   - AC: League owner approves team
4. **Create schedule (manual)**
   - AC: League owner creates games, conflict detection works
5. **Publish schedule**
   - AC: Teams receive notifications

---

#### Epic 5: Live Scoring & Stats (Week 9-10)
**Goal**: Scorekeepers can log events, parents see live scores

**Stories**:
1. **Assign scorekeeper**
   - AC: League owner assigns scorekeeper to game
2. **Live scorekeeping UI**
   - AC: Scorekeeper logs events (+2, +3, etc.), score updates
3. **Real-time updates** (WebSocket or Supabase Realtime)
   - AC: Parents see live score within 1 second
4. **Finalize game**
   - AC: Scorekeeper finalizes, stats generated, standings update
5. **View stats**
   - AC: Parent views player stats (points, rebounds, etc.)

---

#### Epic 6: Payments & Payouts (Week 11)
**Goal**: End-to-end payment flows work

**Stories**:
1. **Stripe webhook handling**
   - AC: Webhooks update payment status, idempotent
2. **Payment history**
   - AC: Parent views payment history
3. **Refund flow**
   - AC: Club owner refunds payment, parent receives refund
4. **Payout dashboard**
   - AC: Club owner views revenue, upcoming payouts

---

#### Epic 7: Mobile Optimization (Week 12)
**Goal**: Mobile-first UI, Capacitor packaging

**Stories**:
1. **Responsive design**
   - AC: All screens work on mobile (375px width)
2. **Capacitor setup**
   - AC: iOS/Android builds work
3. **Push notifications**
   - AC: Parent receives push for offer, game reminder
4. **PWA**
   - AC: Web app installable, works offline (basic)

---

#### Epic 8: Testing & Polish (Week 13-14)
**Goal**: Bug fixes, performance, security audit

**Stories**:
1. **End-to-end tests** (Playwright)
   - AC: Critical flows tested (signup, tryout, payment)
2. **Performance audit**
   - AC: Lighthouse score > 90
3. **Security audit**
   - AC: Checklist complete, no critical vulnerabilities
4. **User acceptance testing**
   - AC: 3 beta clubs test platform, feedback incorporated

---

### 11.2 Sprint Plan (2-week sprints)

| Sprint | Epics | Deliverable |
|--------|-------|-------------|
| **Sprint 1** (Week 1-2) | Epic 1 | Auth + multi-tenancy working |
| **Sprint 2** (Week 3-4) | Epic 2 | Clubs can onboard, create teams |
| **Sprint 3** (Week 5-6) | Epic 3 | Tryouts + offers working |
| **Sprint 4** (Week 7-8) | Epic 4 | Leagues + scheduling working |
| **Sprint 5** (Week 9-10) | Epic 5 | Live scoring + stats working |
| **Sprint 6** (Week 11-12) | Epic 6 + 7 | Payments + mobile ready |
| **Sprint 7** (Week 13-14) | Epic 8 | MVP launch-ready |

---

### 11.3 Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| **Stripe Connect delays** | High | Medium | Start onboarding early, have test accounts ready |
| **Real-time performance** | Medium | Medium | Load test with 1000 concurrent users, optimize queries |
| **Tenant isolation bugs** | Critical | Low | Extensive testing, code review, RLS enforcement |
| **Scope creep** | High | High | Strict MVP definition, defer v1 features |
| **Mobile performance** | Medium | Medium | Test on real devices, optimize bundle size |
| **Payment failures** | High | Low | Retry logic, monitoring, alerts |
| **User adoption** | High | Medium | Beta program, referral incentives, white-glove onboarding |

---

### 11.4 Launch Checklist

**Pre-Launch (1 week before)**:
- [ ] All MVP features complete
- [ ] End-to-end tests passing
- [ ] Security audit complete
- [ ] Performance benchmarks met (< 2s page load)
- [ ] Stripe production keys configured
- [ ] Clerk production instance configured
- [ ] Custom domain DNS configured
- [ ] Email templates finalized (Resend)
- [ ] Terms of Service + Privacy Policy published
- [ ] Support email setup (support@youthbasketballhub.com)
- [ ] Monitoring dashboards configured (Sentry, Vercel)
- [ ] Beta testers onboarded (3 clubs)

**Launch Day**:
- [ ] Deploy to production
- [ ] Smoke test critical flows
- [ ] Monitor error rates (Sentry)
- [ ] Monitor performance (Vercel Analytics)
- [ ] Announce to beta clubs
- [ ] Social media announcement
- [ ] Monitor support inbox

**Post-Launch (Week 1)**:
- [ ] Daily standups to triage bugs
- [ ] User feedback collection
- [ ] Performance optimization
- [ ] Plan v1 features based on feedback

---

### 11.5 Success Metrics (First 3 Months)

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Clubs Onboarded** | 20 | Tenant count |
| **Teams Created** | 100 | Team count |
| **Tryout Signups** | 500 | TryoutSignup count |
| **Offers Accepted** | 200 | Offer acceptance rate (40%) |
| **GMV** | $50K | Sum of all payments |
| **Platform Revenue** | $2.5K | 5% of GMV |
| **Active Users (MAU)** | 1,000 | Unique users per month |
| **Payment Success Rate** | 95% | Succeeded / Total |
| **Uptime** | 99.5% | Vercel metrics |
| **NPS** | 50+ | User survey |

---

## Conclusion

This specification provides a **build-ready blueprint** for the Youth Basketball Hub platform. All 11 sections are complete, covering:

1. ✅ Technical decisions (Postgres, Stripe Connect, Clerk, Capacitor, etc.)
2. ✅ Product requirements (MVP vs v1 vs v2, personas, user journeys)
3. ✅ Multi-tenant architecture (domain routing, data isolation, cross-tenant patterns)
4. ✅ RBAC (11 roles, permission matrix, implementation)
5. ✅ Complete data model (Prisma schema, 20+ tables, indexes)
6. ✅ API design (REST endpoints, request/response examples, WebSocket)
7. ✅ Payments (Stripe Connect flows, refunds, disputes, ledger)
8. ✅ UX flows (40+ screens, notifications, mobile-first)
9. ✅ Scheduling (conflict detection, manual + future auto-scheduling)
10. ✅ Implementation plan (Next.js structure, tech stack, CI/CD, security)
11. ✅ MVP delivery (8 epics, 7 sprints, 14 weeks, launch checklist)

**Next Steps**:
1. Review this specification
2. Approve or request changes
3. Begin Sprint 1 (Foundation)
4. Ship MVP in 14 weeks

---

**Document Status**: ✅ Complete  
**Ready for**: Development kickoff
