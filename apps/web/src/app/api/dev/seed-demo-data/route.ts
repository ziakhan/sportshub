import { NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import bcrypt from "bcryptjs"

export const dynamic = "force-dynamic"

/**
 * DEV ONLY: Seed rich demo data for the Warriors club
 * Creates extra teams, tryouts with signups, offers in various states,
 * draft tryouts, and pending invitations so the dashboard features are visible.
 *
 * Hit: GET /api/dev/seed-demo-data
 */
export async function GET() {
  try {
    // Find the demo tenant
    const tenant = await prisma.tenant.findFirst({
      where: { slug: "warriors-demo" },
    })
    if (!tenant) {
      return NextResponse.json({ error: "Warriors demo club not found. Run the main seed first." }, { status: 404 })
    }

    const clubId = tenant.id

    // Find existing users
    const parent = await prisma.user.findUnique({ where: { email: "parent@sportshub.test" } })
    const parent2 = await prisma.user.findUnique({ where: { email: "parent2@sportshub.test" } })
    const owner = await prisma.user.findUnique({ where: { email: "owner@sportshub.test" } })

    if (!parent || !parent2 || !owner) {
      return NextResponse.json({ error: "Seed users not found. Run main seed first." }, { status: 404 })
    }

    const results: string[] = []

    // ── 1. Create additional teams (some without coaches) ──────────────────
    const extraTeams = [
      { id: "seed-team-u10", name: "Warriors U10 Boys", ageGroup: "U10", gender: "MALE" as const, season: "Spring 2026" },
      { id: "seed-team-u16", name: "Warriors U16 Boys", ageGroup: "U16", gender: "MALE" as const, season: "Spring 2026" },
      { id: "seed-team-u14b", name: "Warriors U14 Boys", ageGroup: "U14", gender: "MALE" as const, season: "Spring 2026" },
      { id: "seed-team-u12g", name: "Warriors U12 Girls", ageGroup: "U12", gender: "FEMALE" as const, season: "Spring 2026" },
    ]

    for (const t of extraTeams) {
      await prisma.team.upsert({
        where: { id: t.id },
        create: { ...t, tenantId: clubId },
        update: { name: t.name },
      })
    }
    results.push(`Created ${extraTeams.length} extra teams (no coaches assigned)`)

    // ── 2. Create extra parents + players for signups ──────────────────────
    const passwordHash = await bcrypt.hash("TestPass123!", 12)
    const extraParents = [
      { email: "demo-parent3@sportshub.test", firstName: "Lisa", lastName: "Thompson" },
      { email: "demo-parent4@sportshub.test", firstName: "David", lastName: "Wilson" },
      { email: "demo-parent5@sportshub.test", firstName: "Karen", lastName: "Martinez" },
      { email: "demo-parent6@sportshub.test", firstName: "Robert", lastName: "Anderson" },
      { email: "demo-parent7@sportshub.test", firstName: "Jennifer", lastName: "Taylor" },
    ]

    const parentIds: string[] = [parent.id, parent2.id]

    for (const p of extraParents) {
      const user = await prisma.user.upsert({
        where: { email: p.email },
        create: { ...p, passwordHash, status: "ACTIVE", onboardedAt: new Date() },
        update: {},
      })
      parentIds.push(user.id)

      // Ensure they have Parent role
      const hasRole = await prisma.userRole.findFirst({
        where: { userId: user.id, role: "Parent" },
      })
      if (!hasRole) {
        await prisma.userRole.create({ data: { userId: user.id, role: "Parent" } })
      }
    }

    // Create players for each parent
    const playerNames = [
      { first: "Ethan", last: "Thompson", gender: "MALE" as const, dob: "2014-03-10" },
      { first: "Sophia", last: "Wilson", gender: "FEMALE" as const, dob: "2012-07-22" },
      { first: "Liam", last: "Martinez", gender: "MALE" as const, dob: "2013-11-05" },
      { first: "Emma", last: "Anderson", gender: "FEMALE" as const, dob: "2012-01-18" },
      { first: "Noah", last: "Taylor", gender: "MALE" as const, dob: "2014-09-30" },
      { first: "Ava", last: "Thompson", gender: "FEMALE" as const, dob: "2011-06-15" },
      { first: "Mason", last: "Wilson", gender: "MALE" as const, dob: "2013-04-20" },
    ]

    const playerRecords: { id: string; firstName: string; lastName: string; parentId: string; gender: string }[] = []

    // Add existing seed players
    const existingPlayers = await prisma.player.findMany({
      where: { id: { in: ["seed-player-001", "seed-player-002"] } },
      select: { id: true, firstName: true, lastName: true, parentId: true, gender: true },
    })
    for (const ep of existingPlayers as any[]) {
      playerRecords.push(ep)
    }

    for (let i = 0; i < playerNames.length; i++) {
      const pn = playerNames[i]
      const parentId = parentIds[i % parentIds.length]
      const playerId = `seed-demo-player-${i + 1}`
      const player = await prisma.player.upsert({
        where: { id: playerId },
        create: {
          id: playerId,
          firstName: pn.first,
          lastName: pn.last,
          dateOfBirth: new Date(pn.dob),
          gender: pn.gender,
          isMinor: true,
          parentalConsentGiven: true,
          consentGivenAt: new Date(),
          canLogin: false,
          parentId,
        },
        update: {},
      })
      playerRecords.push({ id: player.id, firstName: pn.first, lastName: pn.last, parentId, gender: pn.gender })
    }
    results.push(`Created ${playerNames.length} extra players`)

    // ── 3. Create tryouts with signups ─────────────────────────────────────
    const now = new Date()

    // Tryout for U12 Boys - published, with signups needing offers
    const tryout2Date = new Date(now); tryout2Date.setDate(now.getDate() + 7)
    const tryout2 = await prisma.tryout.upsert({
      where: { id: "seed-tryout-u12-002" },
      create: {
        id: "seed-tryout-u12-002",
        tenantId: clubId,
        teamId: "seed-team-u12",
        title: "U12 Boys Second Tryout",
        description: "Second evaluation session",
        ageGroup: "U12", gender: "MALE",
        location: "Warriors Training Facility",
        scheduledAt: tryout2Date,
        duration: 90, fee: 25.0,
        maxParticipants: 20,
        isPublished: true, isPublic: true,
      },
      update: {},
    })

    // Tryout for U14 Girls - published, with signups
    const tryout3Date = new Date(now); tryout3Date.setDate(now.getDate() + 10)
    const tryout3 = await prisma.tryout.upsert({
      where: { id: "seed-tryout-u14-001" },
      create: {
        id: "seed-tryout-u14-001",
        tenantId: clubId,
        teamId: "seed-team-u14",
        title: "U14 Girls Spring Tryout",
        description: "Open tryout for U14 Girls team",
        ageGroup: "U14", gender: "FEMALE",
        location: "Springfield Community Center",
        scheduledAt: tryout3Date,
        duration: 120, fee: 40.0,
        maxParticipants: 25,
        isPublished: true, isPublic: true,
      },
      update: {},
    })

    // Draft tryout (unpublished)
    const tryout4Date = new Date(now); tryout4Date.setDate(now.getDate() + 21)
    await prisma.tryout.upsert({
      where: { id: "seed-tryout-u10-draft" },
      create: {
        id: "seed-tryout-u10-draft",
        tenantId: clubId,
        teamId: "seed-team-u10",
        title: "U10 Boys Development Tryout",
        description: "Tryout for new U10 development program",
        ageGroup: "U10", gender: "MALE",
        location: "Warriors Training Facility",
        scheduledAt: tryout4Date,
        duration: 60, fee: 0,
        isPublished: false, isPublic: true,
      },
      update: {},
    })

    // Another draft
    const tryout5Date = new Date(now); tryout5Date.setDate(now.getDate() + 28)
    await prisma.tryout.upsert({
      where: { id: "seed-tryout-u16-draft" },
      create: {
        id: "seed-tryout-u16-draft",
        tenantId: clubId,
        teamId: "seed-team-u16",
        title: "U16 Boys Elite Tryout",
        description: "Competitive team selection",
        ageGroup: "U16", gender: "MALE",
        location: "City Sports Complex",
        scheduledAt: tryout5Date,
        duration: 120, fee: 60.0,
        maxParticipants: 15,
        isPublished: false, isPublic: true,
      },
      update: {},
    })

    results.push("Created 4 additional tryouts (2 published, 2 draft)")

    // ── 4. Create signups on the tryouts ───────────────────────────────────
    // U12 tryout signups
    const u12MalePlayers = playerRecords.filter(p => p.gender === "MALE")
    for (let i = 0; i < Math.min(u12MalePlayers.length, 5); i++) {
      const player = u12MalePlayers[i]
      const signupId = `seed-signup-u12-${i}`
      await prisma.tryoutSignup.upsert({
        where: { id: signupId },
        create: {
          id: signupId,
          tryoutId: tryout2.id,
          userId: player.parentId,
          playerName: `${player.firstName} ${player.lastName}`,
          playerAge: 11,
          playerGender: "MALE",
          status: "CONFIRMED",
        },
        update: {},
      })
    }

    // U14 tryout signups
    const u14FemalePlayers = playerRecords.filter(p => p.gender === "FEMALE")
    for (let i = 0; i < Math.min(u14FemalePlayers.length, 3); i++) {
      const player = u14FemalePlayers[i]
      const signupId = `seed-signup-u14-${i}`
      await prisma.tryoutSignup.upsert({
        where: { id: signupId },
        create: {
          id: signupId,
          tryoutId: tryout3.id,
          userId: player.parentId,
          playerName: `${player.firstName} ${player.lastName}`,
          playerAge: 13,
          playerGender: "FEMALE",
          status: "CONFIRMED",
        },
        update: {},
      })
    }

    // Also add signups to the original seed tryout
    for (let i = 0; i < Math.min(u12MalePlayers.length, 3); i++) {
      const player = u12MalePlayers[i]
      const signupId = `seed-signup-orig-${i}`
      await prisma.tryoutSignup.upsert({
        where: { id: signupId },
        create: {
          id: signupId,
          tryoutId: "seed-tryout-001",
          userId: player.parentId,
          playerName: `${player.firstName} ${player.lastName}`,
          playerAge: 11,
          playerGender: "MALE",
          status: "CONFIRMED",
        },
        update: {},
      })
    }

    results.push("Created tryout signups (5 on U12, 3 on U14, 3 on original)")

    // ── 5. Create offers in various states ─────────────────────────────────
    const expiresAt = new Date(now); expiresAt.setDate(now.getDate() + 14)
    const pastExpiry = new Date(now); pastExpiry.setDate(now.getDate() - 3)

    // Pending offers on U12 team
    if (u12MalePlayers.length >= 3) {
      // Pending offer
      await prisma.offer.upsert({
        where: { id: "seed-offer-pending-1" },
        create: {
          id: "seed-offer-pending-1",
          teamId: "seed-team-u12",
          playerId: u12MalePlayers[0].id,
          tryoutSignupId: `seed-signup-orig-0`,
          status: "PENDING",
          seasonFee: 1200.0,
          installments: 3,
          practiceSessions: 24,
          includesUniform: true,
          includesTracksuit: true,
          includesBall: true,
          message: "Welcome to the Warriors! We'd love to have you on the team.",
          expiresAt,
        },
        update: {},
      })

      await prisma.offer.upsert({
        where: { id: "seed-offer-pending-2" },
        create: {
          id: "seed-offer-pending-2",
          teamId: "seed-team-u12",
          playerId: u12MalePlayers[1].id,
          tryoutSignupId: `seed-signup-orig-1`,
          status: "PENDING",
          seasonFee: 1200.0,
          installments: 3,
          practiceSessions: 24,
          includesUniform: true,
          includesTracksuit: true,
          includesBall: true,
          expiresAt,
        },
        update: {},
      })

      // Accepted offer
      await prisma.offer.upsert({
        where: { id: "seed-offer-accepted-1" },
        create: {
          id: "seed-offer-accepted-1",
          teamId: "seed-team-u12",
          playerId: u12MalePlayers[2].id,
          tryoutSignupId: `seed-signup-orig-2`,
          status: "ACCEPTED",
          seasonFee: 1200.0,
          installments: 3,
          practiceSessions: 24,
          includesUniform: true,
          includesTracksuit: true,
          includesBall: true,
          uniformSize: "YL",
          tracksuitSize: "YL",
          jerseyPref1: 23,
          jerseyPref2: 10,
          jerseyPref3: 5,
          respondedAt: new Date(now.getTime() - 2 * 86400000),
          expiresAt,
        },
        update: {},
      })
    }

    // Offers on U14 team
    if (u14FemalePlayers.length >= 2) {
      // Declined offer
      await prisma.offer.upsert({
        where: { id: "seed-offer-declined-1" },
        create: {
          id: "seed-offer-declined-1",
          teamId: "seed-team-u14",
          playerId: u14FemalePlayers[0].id,
          tryoutSignupId: `seed-signup-u14-0`,
          status: "DECLINED",
          seasonFee: 1000.0,
          installments: 2,
          practiceSessions: 20,
          includesUniform: true,
          respondedAt: new Date(now.getTime() - 86400000),
          expiresAt,
        },
        update: {},
      })

      // Expired offer
      await prisma.offer.upsert({
        where: { id: "seed-offer-expired-1" },
        create: {
          id: "seed-offer-expired-1",
          teamId: "seed-team-u14",
          playerId: u14FemalePlayers[1].id,
          tryoutSignupId: `seed-signup-u14-1`,
          status: "EXPIRED",
          seasonFee: 1000.0,
          installments: 2,
          practiceSessions: 20,
          includesUniform: true,
          expiresAt: pastExpiry,
        },
        update: {},
      })

      // Pending offer on U14
      if (u14FemalePlayers.length >= 3) {
        await prisma.offer.upsert({
          where: { id: "seed-offer-pending-u14" },
          create: {
            id: "seed-offer-pending-u14",
            teamId: "seed-team-u14",
            playerId: u14FemalePlayers[2].id,
            tryoutSignupId: `seed-signup-u14-2`,
            status: "PENDING",
            seasonFee: 1000.0,
            installments: 2,
            practiceSessions: 20,
            includesUniform: true,
            includesShoes: true,
            message: "Great tryout! We'd love to have you join.",
            expiresAt,
          },
          update: {},
        })
      }
    }

    results.push("Created 6 offers: 3 pending, 1 accepted, 1 declined, 1 expired")

    // ── 6. Create a pending staff invitation ───────────────────────────────
    await prisma.staffInvitation.upsert({
      where: { id: "seed-invite-demo" },
      create: {
        id: "seed-invite-demo",
        tenantId: clubId,
        invitedEmail: "newcoach@example.com",
        role: "Staff",
        type: "INVITE",
        status: "PENDING",
        invitedById: owner.id,
      },
      update: {},
    })
    results.push("Created 1 pending staff invitation")

    // Update original tryout signups to OFFERED status where offers exist
    await prisma.tryoutSignup.updateMany({
      where: {
        id: { in: ["seed-signup-orig-0", "seed-signup-orig-1", "seed-signup-orig-2"] },
      },
      data: { status: "OFFERED" },
    })

    await prisma.tryoutSignup.updateMany({
      where: {
        id: { in: ["seed-signup-u14-0", "seed-signup-u14-1", "seed-signup-u14-2"] },
      },
      data: { status: "OFFERED" },
    })

    // ── 7. House Leagues (Saturday mornings) ────────────────────────────
    const houseLeagues = [
      {
        id: "seed-hl-fall-u8u10",
        name: "Saturday Fall House League",
        description: "Fun recreational basketball every Saturday morning. Focus on fundamentals, teamwork, and having a great time!",
        details: "10 weeks of games and skills development. Teams are drafted for balanced play. All players receive equal playing time.",
        ageGroups: "U8,U9,U10",
        gender: null,
        season: "Fall 2026",
        startDate: new Date("2026-09-12T00:00:00Z"),
        endDate: new Date("2026-11-14T00:00:00Z"),
        daysOfWeek: "Saturday",
        startTime: "10:00",
        endTime: "12:00",
        location: "Warriors Community Centre - Gym A",
        fee: 175,
        maxParticipants: 48,
        includesUniform: false,
        includesJersey: true,
        includesBall: false,
        includesMedal: true,
        isPublished: true,
      },
      {
        id: "seed-hl-fall-u11u13",
        name: "Saturday Fall House League (Older)",
        description: "Intermediate recreational league for older players. More competitive play with referee officiating.",
        details: "10 weeks. Full court games with scorekeeping. Skills clinics before games. End-of-season tournament.",
        ageGroups: "U11,U12,U13",
        gender: null,
        season: "Fall 2026",
        startDate: new Date("2026-09-12T00:00:00Z"),
        endDate: new Date("2026-11-14T00:00:00Z"),
        daysOfWeek: "Saturday",
        startTime: "10:00",
        endTime: "12:00",
        location: "Warriors Community Centre - Gym B",
        fee: 200,
        maxParticipants: 40,
        includesUniform: false,
        includesJersey: true,
        includesBall: false,
        includesMedal: true,
        isPublished: true,
      },
      {
        id: "seed-hl-winter-u6u7",
        name: "Winter Mini-Ballers",
        description: "Introduction to basketball for our youngest players. Fun games, basic skills, and lots of energy!",
        ageGroups: "U5,U6,U7",
        gender: null,
        season: "Winter 2027",
        startDate: new Date("2027-01-10T00:00:00Z"),
        endDate: new Date("2027-03-14T00:00:00Z"),
        daysOfWeek: "Saturday",
        startTime: "10:00",
        endTime: "11:30",
        location: "Warriors Community Centre - Gym A",
        fee: 150,
        maxParticipants: 32,
        includesUniform: false,
        includesJersey: true,
        includesBall: true,
        includesMedal: true,
        isPublished: false, // draft
      },
    ]

    for (const hl of houseLeagues) {
      const { id, ...data } = hl
      await (prisma as any).houseLeague.upsert({
        where: { id },
        create: { id, tenantId: clubId, ...data },
        update: { name: data.name },
      })
    }
    results.push(`Created ${houseLeagues.length} house leagues (Saturday 10AM-12PM)`)

    // ── 8. March Break Camps ─────────────────────────────────────────────
    const camps = [
      {
        id: "seed-camp-marchbreak-jr",
        name: "March Break Basketball Camp (Junior)",
        description: "A week of basketball fun during March Break! Skills development, games, and team activities.",
        details: "Daily schedule: 9AM warm-up, skills stations, team games, lunch break, afternoon scrimmages. Snacks provided. Bring your own lunch.",
        campType: "MARCH_BREAK",
        ageGroup: "U8,U9,U10",
        gender: null,
        startDate: new Date("2026-03-16T00:00:00Z"),
        endDate: new Date("2026-03-20T00:00:00Z"),
        dailyStartTime: "09:00",
        dailyEndTime: "16:00",
        location: "Warriors Community Centre",
        numberOfWeeks: 1,
        weeklyFee: 275,
        fullCampFee: 275,
        maxParticipants: 40,
        includesLunch: false,
        includesSnacks: true,
        includesJersey: true,
        includesBall: false,
        isPublished: true,
      },
      {
        id: "seed-camp-marchbreak-sr",
        name: "March Break Elite Skills Camp",
        description: "Intensive skills camp for competitive players. Focus on position-specific training, game IQ, and advanced techniques.",
        details: "Led by our competitive coaching staff. Video analysis sessions. 3-on-3 tournament on Friday. Each player receives a skills evaluation report.",
        campType: "MARCH_BREAK",
        ageGroup: "U12,U13,U14",
        gender: null,
        startDate: new Date("2026-03-16T00:00:00Z"),
        endDate: new Date("2026-03-20T00:00:00Z"),
        dailyStartTime: "09:00",
        dailyEndTime: "16:00",
        location: "Warriors Community Centre",
        numberOfWeeks: 1,
        weeklyFee: 325,
        fullCampFee: 325,
        maxParticipants: 32,
        includesLunch: false,
        includesSnacks: true,
        includesJersey: true,
        includesBall: true,
        isPublished: true,
      },
      {
        id: "seed-camp-summer",
        name: "Summer Basketball Academy",
        description: "Multi-week summer program with weekly sessions. Sign up for one week or all four at a discount!",
        details: "Each week has a different theme: Week 1 - Ball Handling, Week 2 - Shooting, Week 3 - Defense, Week 4 - Game Play. Guest coaches and special events.",
        campType: "SUMMER",
        ageGroup: "U10,U11,U12,U13,U14",
        gender: null,
        startDate: new Date("2026-07-06T00:00:00Z"),
        endDate: new Date("2026-07-31T00:00:00Z"),
        dailyStartTime: "09:00",
        dailyEndTime: "15:00",
        location: "Warriors Community Centre",
        numberOfWeeks: 4,
        weeklyFee: 250,
        fullCampFee: 850,
        maxParticipants: 48,
        includesLunch: true,
        includesSnacks: true,
        includesJersey: true,
        includesBall: true,
        isPublished: true,
      },
    ]

    for (const camp of camps) {
      const { id, ...data } = camp
      await (prisma as any).camp.upsert({
        where: { id },
        create: { id, tenantId: clubId, ...data },
        update: { name: data.name },
      })
    }
    results.push(`Created ${camps.length} camps (2 March Break + 1 Summer)`)

    // ── 9. Tournaments ───────────────────────────────────────────────────
    const tournaments = [
      {
        id: "seed-tournament-spring",
        name: "Warriors Spring Invitational",
        description: "Annual spring tournament hosted by Warriors Basketball. Teams from across the GTA compete over one exciting weekend.",
        city: "Toronto",
        state: "Ontario",
        country: "CA",
        startDate: new Date("2026-04-18T00:00:00Z"),
        endDate: new Date("2026-04-19T00:00:00Z"),
        registrationDeadline: new Date("2026-04-10T00:00:00Z"),
        teamFee: 450,
        currency: "CAD",
        gamesGuaranteed: 3,
        gameSlotMinutes: 60,
        gameLengthMinutes: 40,
        gamePeriods: "HALVES",
        playoffFormat: "SINGLE_ELIMINATION",
        status: "REGISTRATION",
      },
      {
        id: "seed-tournament-summer-slam",
        name: "Summer Slam Classic",
        description: "End-of-summer tournament to wrap up the season. All age groups welcome. Great competition and community.",
        city: "Mississauga",
        state: "Ontario",
        country: "CA",
        startDate: new Date("2026-08-22T00:00:00Z"),
        endDate: new Date("2026-08-23T00:00:00Z"),
        registrationDeadline: new Date("2026-08-14T00:00:00Z"),
        teamFee: 500,
        currency: "CAD",
        gamesGuaranteed: 4,
        gameSlotMinutes: 60,
        gameLengthMinutes: 40,
        gamePeriods: "HALVES",
        playoffFormat: "SINGLE_ELIMINATION",
        status: "DRAFT",
      },
    ]

    for (const t of tournaments) {
      const { id, ...data } = t
      await (prisma as any).tournament.upsert({
        where: { id },
        create: { id, ownerId: owner.id, tenantId: clubId, ...data },
        update: { name: data.name },
      })
    }
    results.push(`Created ${tournaments.length} tournaments`)

    // Add divisions to the Spring Invitational
    const springDivisions = [
      { id: "seed-tdiv-u10b", name: "U10 Boys", ageGroup: "U10", gender: "MALE", maxTeams: 8 },
      { id: "seed-tdiv-u12b", name: "U12 Boys", ageGroup: "U12", gender: "MALE", maxTeams: 8 },
      { id: "seed-tdiv-u12g", name: "U12 Girls", ageGroup: "U12", gender: "FEMALE", maxTeams: 8 },
      { id: "seed-tdiv-u14b", name: "U14 Boys", ageGroup: "U14", gender: "MALE", maxTeams: 8 },
      { id: "seed-tdiv-u14g", name: "U14 Girls", ageGroup: "U14", gender: "FEMALE", maxTeams: 6 },
    ]

    for (const d of springDivisions) {
      const { id, ...data } = d
      await (prisma as any).tournamentDivision.upsert({
        where: { id },
        create: { id, tournamentId: "seed-tournament-spring", ...data },
        update: { name: data.name },
      })
    }
    results.push(`Created ${springDivisions.length} divisions for Spring Invitational`)

    // Submit Warriors teams to the Spring Invitational
    const teamSubmissions = [
      { id: "seed-tt-u10", teamId: "seed-team-u10", divisionId: "seed-tdiv-u10b", status: "APPROVED" },
      { id: "seed-tt-u14b", teamId: "seed-team-u14b", divisionId: "seed-tdiv-u14b", status: "APPROVED" },
      { id: "seed-tt-u12g", teamId: "seed-team-u12g", divisionId: "seed-tdiv-u12g", status: "PENDING" },
    ]

    for (const ts of teamSubmissions) {
      const { id, ...data } = ts
      await (prisma as any).tournamentTeam.upsert({
        where: { id },
        create: { id, tournamentId: "seed-tournament-spring", registrationFee: 450, ...data },
        update: {},
      })
    }
    results.push("Submitted 3 Warriors teams to Spring Invitational (2 approved, 1 pending)")

    // ── 11. Migrate any existing team-scoped templates to club-scoped ──────
    const orphanedTemplates = await prisma.offerTemplate.findMany({
      where: { tenantId: null, teamId: { not: null } },
      select: { id: true, teamId: true },
    })
    for (const t of orphanedTemplates as any[]) {
      const team = await prisma.team.findUnique({
        where: { id: t.teamId },
        select: { tenantId: true },
      })
      if (team) {
        await prisma.offerTemplate.update({
          where: { id: t.id },
          data: { tenantId: team.tenantId },
        })
      }
    }
    if (orphanedTemplates.length > 0) {
      results.push(`Migrated ${orphanedTemplates.length} team-scoped templates to club-scoped`)
    }

    return NextResponse.json({
      success: true,
      message: "Demo data seeded successfully",
      details: results,
    })
  } catch (error: any) {
    console.error("Seed error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to seed demo data" },
      { status: 500 }
    )
  }
}
