# Youth Basketball Hub 🏀

The complete platform for youth basketball clubs, leagues, and families.

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18.17.0 or higher
- **npm** 9.0.0 or higher
- **Docker** (for local database)
- **Git**

### Installation

1. **Clone the repository**

```bash
git clone https://github.com/your-org/youth-basketball-hub.git
cd youth-basketball-hub
```

2. **Install dependencies**

```bash
npm install
```

3. **Set up environment variables**

```bash
cp .env.example .env.local
```

Edit `.env.local` with your actual credentials. For local development, you'll need:
- Clerk account (free tier: https://clerk.com)
- Stripe account in test mode (https://stripe.com)
- Supabase project (free tier: https://supabase.com)

4. **Start the database**

```bash
docker-compose up -d
```

This starts PostgreSQL on `localhost:5432` and pgAdmin on `localhost:5050`.

5. **Set up the database**

```bash
# Generate Prisma client
npm run db:generate

# Push schema to database (for development)
npm run db:push

# Or run migrations (for production-like workflow)
npm run db:migrate
```

6. **Start the development server**

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📁 Project Structure

```
youth-basketball-hub/
├── apps/
│   └── web/                    # Next.js 14 app (App Router)
│       ├── src/
│       │   ├── app/           # App Router pages
│       │   │   ├── (auth)/    # Auth pages (sign-in, sign-up)
│       │   │   ├── (platform)/ # Global marketplace
│       │   │   ├── (tenant)/  # Tenant-scoped pages
│       │   │   └── api/       # API routes
│       │   ├── components/    # React components
│       │   └── lib/           # Utilities
│       └── middleware.ts      # Tenant routing middleware
│
├── packages/
│   ├── db/                    # Prisma schema & client
│   ├── ui/                    # Shared UI components (shadcn/ui)
│   ├── auth/                  # Clerk utilities
│   ├── payments/              # Stripe utilities
│   └── config/                # Shared config
│
├── prisma/
│   └── schema.prisma          # Complete database schema
│
├── docs/                      # Documentation
│   └── platform-specification.md  # Full technical spec
│
├── docker-compose.yml         # Local PostgreSQL + pgAdmin
├── turbo.json                 # Turborepo configuration
└── package.json               # Monorepo root
```

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Framework** | Next.js 14 (App Router) | SSR, RSC, API routes |
| **Language** | TypeScript | Type safety |
| **Database** | PostgreSQL 15 | Relational data |
| **ORM** | Prisma | Type-safe queries |
| **Auth** | Clerk | Multi-tenant, RBAC, COPPA-compliant |
| **Payments** | Stripe Connect | Multi-party payments |
| **UI** | shadcn/ui + Tailwind CSS | Accessible components |
| **State** | React Query (TanStack Query) | Server state management |
| **Forms** | React Hook Form + Zod | Validation |
| **Real-time** | Supabase Realtime | Live scoring |
| **Jobs** | Inngest | Background tasks |
| **Email** | Resend | Transactional emails |
| **Hosting** | Vercel | Deployment |

---

## 📜 Available Scripts

### Root (Monorepo)

```bash
npm run dev          # Start all apps in development
npm run build        # Build all apps for production
npm run lint         # Lint all packages
npm run format       # Format code with Prettier
npm run clean        # Clean all build artifacts
```

### Database

```bash
npm run db:generate  # Generate Prisma client
npm run db:push      # Push schema changes (development)
npm run db:migrate   # Run migrations (production)
npm run db:studio    # Open Prisma Studio (GUI)
npm run db:seed      # Seed database with test data
```

### Development

```bash
# Start database
docker-compose up -d

# Stop database
docker-compose down

# View database logs
docker-compose logs -f postgres

# Access pgAdmin
# URL: http://localhost:5050
# Email: admin@youthbasketballhub.com
# Password: admin
```

---

## 🏗️ Multi-Tenant Architecture

### Domain Routing

- **Platform**: `app.youthbasketballhub.com` → Global marketplace
- **Subdomain**: `warriors.youthbasketballhub.com` → Warriors Basketball Club
- **Custom Domain**: `warriorsbasketball.com` → Warriors Basketball Club (Pro/Enterprise)

### Tenant Isolation

- **Row-level tenancy**: Each club is a tenant with `tenant_id`
- **Row-Level Security (RLS)**: Database-level enforcement
- **Middleware**: Automatic tenant context injection
- **Cross-tenant entities**: Leagues, Games (spanning multiple clubs)

---

## 🔐 Authentication & Authorization

### Roles

| Role | Scope | Example |
|------|-------|---------|
| **ClubOwner** | Tenant-wide | Club founder |
| **ClubManager** | Tenant-wide | Operations manager |
| **Coach** | Team-scoped | Head coach |
| **TeamManager** | Team-scoped | Team parent volunteer |
| **LeagueOwner** | League-wide | League founder |
| **Parent** | Family-scoped | Parent/guardian |
| **Player** | Self-scoped | Youth player |
| **Referee** | Game-scoped | Certified referee |
| **PlatformAdmin** | Global | Platform operator |

### COPPA Compliance

- Players under 13 require parental consent
- `Player.isMinor` flag tracks age status
- `Player.parentalConsentGiven` + `consentGivenAt` for audit trail
- Players under 13 cannot log in independently (`canLogin = false`)

---

## 💳 Payment Flows

### Stripe Connect Architecture

**Platform as Merchant of Record** → Destination Charges to Club/League/Referee Connect Accounts

1. **Tryout Fee**: Parent → Platform (5% fee) → Club
2. **Season Fee**: Parent → Platform (5% fee) → Club (4 installments)
3. **League Fee**: Club → Platform (5% fee) → League
4. **Referee Fee**: Platform → Referee (after game completion)

### Platform Fee

- **Default**: 5% on all transactions
- **Configurable**: Can be adjusted per payment type

---

## 🎯 MVP Scope (Sprint 1-7, 14 weeks)

### Included Features

✅ Club onboarding with Stripe Connect
✅ Team & staff management
✅ Tryout creation & marketplace
✅ Parent signup & payment
✅ Offer system (coach → player)
✅ League creation & team registration
✅ Manual scheduling with conflict detection
✅ Live scorekeeping (WebSocket/Supabase Realtime)
✅ Basic stats (points, rebounds, assists, etc.)
✅ Standings & W/L records
✅ Email notifications
✅ Mobile-responsive web app

### Excluded from MVP (v1+)

❌ Custom domains (subdomain only for MVP)
❌ Advanced stats (just basic counting stats)
❌ Referee marketplace (manual assignment)
❌ In-app chat (use announcements)
❌ Native mobile apps (Capacitor in v1)
❌ Tournaments (leagues only)
❌ Exhibition games

---

## 🧪 Testing

### Running Tests

```bash
# Unit tests (coming in Sprint 1)
npm run test

# E2E tests with Playwright (Sprint 8)
npm run test:e2e

# Type checking
npm run type-check
```

### Test Coverage Goals

- **Unit**: 80%+ coverage for business logic
- **Integration**: API routes, database operations
- **E2E**: Critical flows (signup, tryout, payment, scoring)

---

## 🚢 Deployment

### Vercel (Recommended)

1. **Connect repository** to Vercel
2. **Set environment variables** in Vercel dashboard
3. **Deploy**: Automatic on push to `main` branch

### Environment Variables Checklist

- [ ] `DATABASE_URL` (production Supabase or managed PostgreSQL)
- [ ] `CLERK_SECRET_KEY` (production)
- [ ] `STRIPE_SECRET_KEY` (live mode)
- [ ] `STRIPE_WEBHOOK_SECRET` (live webhook endpoint)
- [ ] `NEXT_PUBLIC_APP_URL` (production URL)
- [ ] All other keys from `.env.example`

---

## 📚 Documentation

- [Platform Specification](docs/platform-specification.md) - Complete technical spec
- [API Documentation](docs/api.md) - API reference (coming soon)
- [Database Schema](prisma/schema.prisma) - Complete Prisma schema

---

## 🤝 Contributing

### Development Workflow

1. Create a feature branch: `git checkout -b feature/my-feature`
2. Make changes and commit: `git commit -m "Add my feature"`
3. Push to branch: `git push origin feature/my-feature`
4. Open a Pull Request

### Code Style

- **TypeScript**: Strict mode enabled
- **Formatting**: Prettier (automatic on save)
- **Linting**: ESLint + Next.js rules

---

## 📝 License

Proprietary - All Rights Reserved

---

## 🆘 Support

- **Issues**: [GitHub Issues](https://github.com/your-org/youth-basketball-hub/issues)
- **Email**: support@youthbasketballhub.com
- **Docs**: [Documentation](docs/)

---

## 🎉 Acknowledgments

Built with:
- [Next.js](https://nextjs.org)
- [Prisma](https://prisma.io)
- [Clerk](https://clerk.com)
- [Stripe](https://stripe.com)
- [shadcn/ui](https://ui.shadcn.com)
- [Tailwind CSS](https://tailwindcss.com)

---

**Ready to ship!** 🚀
