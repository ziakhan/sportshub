/**
 * Youth Basketball Hub — Local Dev Seed Script
 *
 * Creates test accounts in the database with all roles,
 * a demo club, teams, players, and a league.
 *
 * Run: npm run db:seed
 *
 * All accounts use password: TestPass123!
 */

import { PrismaClient, Role } from "@prisma/client"
import bcrypt from "bcryptjs"
import * as path from "path"

// Load env vars from the monorepo root .env.local
// eslint-disable-next-line @typescript-eslint/no-var-requires
require("dotenv").config({ path: path.resolve(__dirname, "../../../../.env.local") })
// eslint-disable-next-line @typescript-eslint/no-var-requires
require("dotenv").config({ path: path.resolve(__dirname, "../../../../.env") })

const prisma = new PrismaClient()

const TEST_PASSWORD = "TestPass123!"

const TEST_USERS = [
  {
    key: "platformAdmin",
    email: "admin@sportshub.test",
    firstName: "Alex",
    lastName: "Admin",
    role: "PlatformAdmin" as const,
  },
  {
    key: "clubOwner",
    email: "owner@sportshub.test",
    firstName: "Sarah",
    lastName: "Owner",
    role: "ClubOwner" as const,
  },
  {
    key: "clubManager",
    email: "manager@sportshub.test",
    firstName: "Mike",
    lastName: "Manager",
    role: "ClubManager" as const,
  },
  {
    key: "staff",
    email: "staff@sportshub.test",
    firstName: "Marcus",
    lastName: "Staff",
    role: "Staff" as const,
  },
  {
    key: "teamManager",
    email: "teammanager@sportshub.test",
    firstName: "Tom",
    lastName: "TeamMgr",
    role: "TeamManager" as const,
  },
  {
    key: "parent",
    email: "parent@sportshub.test",
    firstName: "David",
    lastName: "Parent",
    role: "Parent" as const,
  },
  {
    key: "parent2",
    email: "parent2@sportshub.test",
    firstName: "Lisa",
    lastName: "Parent2",
    role: "Parent" as const,
  },
  {
    key: "referee",
    email: "referee@sportshub.test",
    firstName: "James",
    lastName: "Referee",
    role: "Referee" as const,
  },
  {
    key: "leagueOwner",
    email: "league@sportshub.test",
    firstName: "Jennifer",
    lastName: "Director",
    role: "LeagueOwner" as const,
  },
  {
    key: "scorekeeper",
    email: "scorekeeper@sportshub.test",
    firstName: "Sam",
    lastName: "Scorekeeper",
    role: "Scorekeeper" as const,
  },
]

// ─── Main Seed ───────────────────────────────────────────────────────────────

async function main() {
  console.log("\nStarting Youth Basketball Hub seed...\n")

  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 12)

  // ── 1. Create DB Users ───────────────────────────────────────────────────
  console.log("Creating users...")
  const dbUsers: Record<string, string> = {} // key → db userId

  for (const user of TEST_USERS) {
    const dbUser = await prisma.user.upsert({
      where: { email: user.email },
      create: {
        email: user.email,
        passwordHash,
        firstName: user.firstName,
        lastName: user.lastName,
        status: "ACTIVE",
        onboardedAt: new Date(),
      },
      update: {
        firstName: user.firstName,
        lastName: user.lastName,
      },
    })
    dbUsers[user.key] = dbUser.id
    console.log(`  OK  DB user: ${user.email} (${dbUser.id})`)
  }

  // ── 2. Create Demo Tenant (Club) ──────────────────────────────────────────
  console.log("\nCreating demo club...")
  const tenant = await prisma.tenant.upsert({
    where: { slug: "warriors-demo" },
    create: {
      slug: "warriors-demo",
      name: "Warriors Basketball Club",
      description: "Demo club for local testing",
      plan: "PRO",
      timezone: "America/New_York",
      branding: {
        create: {
          primaryColor: "#1a237e",
          secondaryColor: "#ffd600",
          accentColor: "#ef5350",
          fontFamily: "Inter",
        },
      },
      features: {
        create: {
          enableTournaments: true,
          enableReviews: true,
          enableChat: true,
          enableAnalytics: true,
          maxTeams: 20,
          maxStaff: 15,
          maxVenues: 5,
        },
      },
    },
    update: {
      name: "Warriors Basketball Club",
    },
  })
  console.log(`  OK  Tenant: ${tenant.name} (slug: ${tenant.slug})`)

  // ── 3. Create Venue ────────────────────────────────────────────────────────
  console.log("\nCreating venue...")
  const venue = await prisma.venue.upsert({
    where: {
      id: "seed-venue-001",
    },
    create: {
      id: "seed-venue-001",
      tenantId: tenant.id,
      name: "Warriors Training Facility",
      address: "123 Hoop Street",
      city: "Springfield",
      state: "NY",
      zipCode: "10001",
      capacity: 200,
      notes: "Main practice gym - 2 full courts",
    },
    update: {
      name: "Warriors Training Facility",
    },
  })
  console.log(`  OK  Venue: ${venue.name}`)

  // ── 4. Create Teams ────────────────────────────────────────────────────────
  console.log("\nCreating teams...")
  const teamU12 = await prisma.team.upsert({
    where: { id: "seed-team-u12" },
    create: {
      id: "seed-team-u12",
      tenantId: tenant.id,
      name: "Warriors U12 Boys",
      ageGroup: "U12",
      gender: "MALE",
      season: "Spring 2026",
      description: "Under-12 competitive boys team",
    },
    update: { name: "Warriors U12 Boys" },
  })

  const teamU14 = await prisma.team.upsert({
    where: { id: "seed-team-u14" },
    create: {
      id: "seed-team-u14",
      tenantId: tenant.id,
      name: "Warriors U14 Girls",
      ageGroup: "U14",
      gender: "FEMALE",
      season: "Spring 2026",
      description: "Under-14 competitive girls team",
    },
    update: { name: "Warriors U14 Girls" },
  })
  console.log(`  OK  Teams: ${teamU12.name}, ${teamU14.name}`)

  // ── 5. Assign Roles ────────────────────────────────────────────────────────
  console.log("\nAssigning roles...")

  type RoleAssignment = {
    userId: string
    role: Role
    tenantId?: string
    teamId?: string
    leagueId?: string
    designation?: string
  }

  const roleAssignments: RoleAssignment[] = [
    { userId: dbUsers.platformAdmin, role: "PlatformAdmin" },
    { userId: dbUsers.clubOwner, role: "ClubOwner", tenantId: tenant.id },
    { userId: dbUsers.clubManager, role: "ClubManager", tenantId: tenant.id },
    // Tenant-level Staff role (required before team-scoped assignment)
    { userId: dbUsers.staff, role: "Staff", tenantId: tenant.id },
    // Team-scoped Staff role with HeadCoach designation
    { userId: dbUsers.staff, role: "Staff", tenantId: tenant.id, teamId: teamU12.id, designation: "HeadCoach" },
    // Tenant-level TeamManager role
    { userId: dbUsers.teamManager, role: "TeamManager", tenantId: tenant.id },
    // Team-scoped TeamManager role
    { userId: dbUsers.teamManager, role: "TeamManager", tenantId: tenant.id, teamId: teamU14.id },
    { userId: dbUsers.parent, role: "Parent" },
    { userId: dbUsers.parent2, role: "Parent" },
    { userId: dbUsers.referee, role: "Referee" },
    { userId: dbUsers.scorekeeper, role: "Scorekeeper", tenantId: tenant.id },
  ]

  for (const assignment of roleAssignments) {
    const existing = await prisma.userRole.findFirst({
      where: {
        userId: assignment.userId,
        role: assignment.role,
        tenantId: assignment.tenantId ?? null,
        teamId: assignment.teamId ?? null,
        leagueId: null,
        gameId: null,
      },
    })
    if (!existing) {
      await prisma.userRole.create({ data: assignment })
    }
    console.log(`  OK  Role: ${assignment.role} -> ${assignment.userId.slice(0, 8)}...`)
  }

  // ── 6. Referee Profile ─────────────────────────────────────────────────────
  console.log("\nCreating referee profile...")
  await prisma.refereeProfile.upsert({
    where: { userId: dbUsers.referee },
    create: {
      userId: dbUsers.referee,
      certificationLevel: "Level 2",
      certificationExpiry: new Date("2027-06-30"),
      availableRegions: ["New York", "New Jersey", "Connecticut"],
      standardFee: 55.0,
      gamesRefereed: 47,
      averageRating: 4.7,
    },
    update: {},
  })
  console.log("  OK  Referee profile created")

  // ── 7. Create Players (linked to parents) ─────────────────────────────────
  console.log("\nCreating players...")
  const player1 = await prisma.player.upsert({
    where: { id: "seed-player-001" },
    create: {
      id: "seed-player-001",
      firstName: "Jordan",
      lastName: "Parent",
      dateOfBirth: new Date("2013-05-15"),
      gender: "MALE",
      jerseyNumber: "23",
      isMinor: true,
      parentalConsentGiven: true,
      consentGivenAt: new Date(),
      canLogin: false,
      parentId: dbUsers.parent,
    },
    update: {},
  })

  const player2 = await prisma.player.upsert({
    where: { id: "seed-player-002" },
    create: {
      id: "seed-player-002",
      firstName: "Riley",
      lastName: "Parent2",
      dateOfBirth: new Date("2011-09-20"),
      gender: "FEMALE",
      jerseyNumber: "10",
      isMinor: true,
      parentalConsentGiven: true,
      consentGivenAt: new Date(),
      canLogin: false,
      parentId: dbUsers.parent2,
    },
    update: {},
  })

  await prisma.teamPlayer.upsert({
    where: { teamId_playerId: { teamId: teamU12.id, playerId: player1.id } },
    create: { teamId: teamU12.id, playerId: player1.id, status: "ACTIVE" },
    update: {},
  })

  await prisma.teamPlayer.upsert({
    where: { teamId_playerId: { teamId: teamU14.id, playerId: player2.id } },
    create: { teamId: teamU14.id, playerId: player2.id, status: "ACTIVE" },
    update: {},
  })
  console.log(`  OK  Players: ${player1.firstName}, ${player2.firstName}`)

  // ── 8. Create a Tryout ─────────────────────────────────────────────────────
  console.log("\nCreating sample tryout...")
  const tryoutDate = new Date()
  tryoutDate.setDate(tryoutDate.getDate() + 14)

  const tryout = await prisma.tryout.upsert({
    where: { id: "seed-tryout-001" },
    create: {
      id: "seed-tryout-001",
      tenantId: tenant.id,
      title: "U12 Boys Spring 2026 Tryout",
      description: "Open tryout for our U12 Boys competitive team. Bring water and wear basketball shoes.",
      ageGroup: "U12",
      gender: "MALE",
      location: "Warriors Training Facility, 123 Hoop Street, Springfield NY",
      scheduledAt: tryoutDate,
      duration: 120,
      fee: 50.0,
      maxParticipants: 30,
      isPublished: true,
      isPublic: true,
    },
    update: {
      title: "U12 Boys Spring 2026 Tryout",
    },
  })
  console.log(`  OK  Tryout: ${tryout.title}`)

  // ── 9. Create a League + Season ───────────────────────────────────────────
  console.log("\nCreating demo league + season...")
  const league = await prisma.league.upsert({
    where: { id: "seed-league-001" },
    create: {
      id: "seed-league-001",
      name: "Metro Youth Basketball League",
      description: "Regional competitive league spanning multiple seasons",
      ownerId: dbUsers.leagueOwner,
    },
    update: {
      name: "Metro Youth Basketball League",
    },
  })

  const season = await prisma.season.upsert({
    where: { id: "seed-season-001" },
    create: {
      id: "seed-season-001",
      leagueId: league.id,
      label: "Spring 2026",
      type: "FALL_WINTER",
      status: "DRAFT",
      ageGroupCutoffDate: new Date("2026-08-31"),
    },
    update: {
      label: "Spring 2026",
    },
  })

  const existingLeagueOwnerRole = await prisma.userRole.findFirst({
    where: {
      userId: dbUsers.leagueOwner,
      role: "LeagueOwner",
      leagueId: league.id,
    },
  })
  if (!existingLeagueOwnerRole) {
    await prisma.userRole.create({
      data: {
        userId: dbUsers.leagueOwner,
        role: "LeagueOwner",
        leagueId: league.id,
      },
    })
  }

  await prisma.division.upsert({
    where: { id: "seed-division-u12" },
    create: {
      id: "seed-division-u12",
      seasonId: season.id,
      name: "U12 Boys Division A",
      ageGroup: "U12",
      gender: "MALE",
    },
    update: {},
  })

  await prisma.division.upsert({
    where: { id: "seed-division-u14" },
    create: {
      id: "seed-division-u14",
      seasonId: season.id,
      name: "U14 Girls Division A",
      ageGroup: "U14",
      gender: "FEMALE",
    },
    update: {},
  })

  console.log(`  OK  League: ${league.name} (season ${season.label})`)

  // ── Print summary ──────────────────────────────────────────────────────────
  console.log("\n" + "=".repeat(60))
  console.log("SEED COMPLETE - Test Accounts")
  console.log("=".repeat(60))
  console.log("")
  console.log("All accounts use password: TestPass123!")
  console.log("")
  console.log(
    "Role            | Email"
  )
  console.log("-".repeat(60))
  for (const user of TEST_USERS) {
    const roleLabel = user.role.padEnd(16)
    console.log(`${roleLabel}| ${user.email}`)
  }
  console.log("")
  console.log(`Demo Club URL:  http://warriors-demo.localhost:3000`)
  console.log(`Prisma Studio:  npm run db:studio`)
  console.log("=".repeat(60))
  console.log("")
}

main()
  .catch((e) => {
    console.error("Seed failed:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
