import { prisma } from "@youthbasketballhub/db"

export interface DashboardData {
  roles: string[]
  admin?: {
    totalUsers: number
    totalClubs: number
    totalTeams: number
    totalPlayers: number
    totalLeagues: number
    totalTryouts: number
    totalGames: number
    pendingInvitations: number
    recentClubs: Array<{
      id: string
      name: string
      slug: string
      plan: string
      _count: { teams: number; tryouts: number }
    }>
    recentUsers: Array<{
      id: string
      firstName: string | null
      lastName: string | null
      email: string
      createdAt: Date
      roles: Array<{ role: string }>
    }>
  }
  parent?: {
    players: Array<{
      id: string
      firstName: string
      lastName: string
      dateOfBirth: Date
      gender: string
      teams: Array<{ team: { id: string; name: string; ageGroup: string } }>
    }>
    tryoutSignups: Array<{
      id: string
      playerName: string
      status: string
      tryout: { id: string; title: string; scheduledAt: Date; location: string }
    }>
    recentPayments: Array<{
      id: string
      amount: any
      status: string
      paymentType: string
      createdAt: Date
    }>
  }
  clubOwner?: {
    tenants: Array<{
      id: string
      name: string
      slug: string
      plan: string
      _count: { teams: number; tryouts: number }
    }>
    teams: Array<{
      id: string
      name: string
      ageGroup: string
      season: string | null
      tenant: { id: string; name: string }
      _count: { players: number }
      staff: Array<{
        designation: string | null
        user: { firstName: string | null; lastName: string | null }
      }>
      players: Array<{
        player: { firstName: string; lastName: string }
      }>
    }>
  }
  staff?: {
    teams: Array<{
      id: string
      name: string
      ageGroup: string
      season: string | null
      tenant: { id: string; name: string }
      _count: { players: number }
    }>
  }
  referee?: {
    profile: {
      certificationLevel: string | null
      gamesRefereed: number
      averageRating: any
      standardFee: any
    } | null
  }
  leagueOwner?: {
    leagues: Array<{
      id: string
      name: string
      season: string
      _count: { teams: number; games: number }
    }>
  }
  player?: {
    teams: Array<{
      id: string
      name: string
      ageGroup: string
      club: string
    }>
    upcomingGames: Array<{
      id: string
      homeTeam: string
      awayTeam: string
      scheduledAt: Date
      location: string | null
    }>
    stats: Array<{
      id: string
      points: number
      rebounds: number
      assists: number
    }>
  }
}

interface UserWithRoles {
  id: string
  roles: Array<{
    role: string
    tenantId: string | null
    teamId: string | null
    leagueId: string | null
  }>
}

export async function getDashboardData(user: UserWithRoles): Promise<DashboardData> {
  const roleNames = user.roles.map((r) => r.role)
  const data: DashboardData = { roles: roleNames }

  // PlatformAdmin data
  if (roleNames.includes("PlatformAdmin")) {
    const [
      totalUsers,
      totalClubs,
      totalTeams,
      totalPlayers,
      totalLeagues,
      totalTryouts,
      totalGames,
      pendingInvitations,
      recentClubs,
      recentUsers,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.tenant.count(),
      prisma.team.count(),
      prisma.player.count(),
      prisma.league.count(),
      prisma.tryout.count(),
      prisma.game.count(),
      prisma.staffInvitation.count({ where: { status: "PENDING" } }),
      prisma.tenant.findMany({
        include: { _count: { select: { teams: true, tryouts: true } } },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      prisma.user.findMany({
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          createdAt: true,
          roles: { select: { role: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
    ])

    data.admin = {
      totalUsers,
      totalClubs,
      totalTeams,
      totalPlayers,
      totalLeagues,
      totalTryouts,
      totalGames,
      pendingInvitations,
      recentClubs,
      recentUsers,
    }
  }

  // Parent data
  if (roleNames.includes("Parent")) {
    const [players, tryoutSignups, recentPayments] = await Promise.all([
      prisma.player.findMany({
        where: { parentId: user.id },
        include: {
          teams: {
            include: { team: { select: { id: true, name: true, ageGroup: true } } },
          },
        },
      }),
      prisma.tryoutSignup.findMany({
        where: { userId: user.id },
        include: {
          tryout: {
            select: { id: true, title: true, scheduledAt: true, location: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      prisma.payment.findMany({
        where: { payerId: user.id },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ])

    data.parent = {
      players,
      tryoutSignups,
      recentPayments: recentPayments.map((p: any) => ({
        ...p,
        amount: Number(p.amount),
        platformFee: p.platformFee ? Number(p.platformFee) : null,
        refundAmount: p.refundAmount ? Number(p.refundAmount) : null,
      })),
    }
  }

  // ClubOwner / ClubManager data
  if (roleNames.includes("ClubOwner") || roleNames.includes("ClubManager")) {
    const tenantIds = user.roles
      .filter((r) => (r.role === "ClubOwner" || r.role === "ClubManager") && r.tenantId)
      .map((r) => r.tenantId!)

    if (tenantIds.length > 0) {
      const [tenants, teams] = await Promise.all([
        prisma.tenant.findMany({
          where: { id: { in: tenantIds } },
          include: {
            _count: { select: { teams: true, tryouts: true } },
          },
        }),
        prisma.team.findMany({
          where: { tenantId: { in: tenantIds } },
          include: {
            tenant: { select: { id: true, name: true } },
            _count: { select: { players: true } },
            staff: {
              where: { role: { in: ["Staff", "TeamManager"] } },
              select: {
                designation: true,
                user: { select: { firstName: true, lastName: true } },
              },
            },
            players: {
              take: 3,
              orderBy: { joinedAt: "asc" },
              select: {
                player: { select: { firstName: true, lastName: true } },
              },
            },
          },
          orderBy: [{ createdAt: "desc" }],
        }),
      ])
      data.clubOwner = { tenants, teams }
    } else {
      data.clubOwner = { tenants: [], teams: [] }
    }
  }

  // Staff data (includes TeamManager)
  if (roleNames.includes("Staff") || roleNames.includes("TeamManager")) {
    const teamIds = user.roles
      .filter((r) => (r.role === "Staff" || r.role === "TeamManager") && r.teamId)
      .map((r) => r.teamId!)

    if (teamIds.length > 0) {
      const teams = await prisma.team.findMany({
        where: { id: { in: teamIds } },
        include: {
          tenant: { select: { id: true, name: true } },
          _count: { select: { players: true } },
        },
      })
      data.staff = { teams }
    } else {
      data.staff = { teams: [] }
    }
  }

  // Referee data
  if (roleNames.includes("Referee")) {
    const profile = await prisma.refereeProfile.findUnique({
      where: { userId: user.id },
      select: {
        certificationLevel: true,
        gamesRefereed: true,
        averageRating: true,
        standardFee: true,
      },
    })
    data.referee = {
      profile: profile
        ? {
            ...profile,
            standardFee: Number(profile.standardFee),
            averageRating: profile.averageRating ? Number(profile.averageRating) : null,
          }
        : null,
    }
  }

  // LeagueOwner / LeagueManager data
  if (roleNames.includes("LeagueOwner") || roleNames.includes("LeagueManager")) {
    const leagueIds = user.roles
      .filter((r) => (r.role === "LeagueOwner" || r.role === "LeagueManager") && r.leagueId)
      .map((r) => r.leagueId!)

    if (leagueIds.length > 0) {
      const leagues = await prisma.league.findMany({
        where: { id: { in: leagueIds } },
        include: {
          _count: { select: { teams: true, games: true } },
        },
      })
      data.leagueOwner = { leagues }
    } else {
      data.leagueOwner = { leagues: [] }
    }
  }

  // Player data
  if (roleNames.includes("Player")) {
    // Find players linked to this user (via parentId — self-registered 13+ players)
    const players = await prisma.player.findMany({
      where: { parentId: user.id },
      include: {
        teams: {
          where: { status: "ACTIVE" },
          include: {
            team: {
              select: {
                id: true,
                name: true,
                ageGroup: true,
                tenant: { select: { name: true } },
              },
            },
          },
        },
        stats: {
          orderBy: { game: { scheduledAt: "desc" } },
          take: 3,
        },
      },
    })

    const teamIds = players.flatMap((p: any) => p.teams.map((t: any) => t.team.id))

    const upcomingGames =
      teamIds.length > 0
        ? await prisma.game.findMany({
            where: {
              OR: [{ homeTeamId: { in: teamIds } }, { awayTeamId: { in: teamIds } }],
              scheduledAt: { gte: new Date() },
              status: "SCHEDULED",
            },
            include: {
              homeTeam: { select: { name: true } },
              awayTeam: { select: { name: true } },
              venue: { select: { name: true } },
            },
            orderBy: { scheduledAt: "asc" },
            take: 5,
          })
        : []

    data.player = {
      teams: players.flatMap((p: any) =>
        p.teams.map((t: any) => ({
          id: t.team.id,
          name: t.team.name,
          ageGroup: t.team.ageGroup,
          club: t.team.tenant.name,
        }))
      ),
      upcomingGames: upcomingGames.map((g: any) => ({
        id: g.id,
        homeTeam: g.homeTeam.name,
        awayTeam: g.awayTeam.name,
        scheduledAt: g.scheduledAt,
        location: g.venue?.name || null,
      })),
      stats: players.flatMap((p: any) =>
        p.stats.map((s: any) => ({
          id: s.id,
          points: s.points,
          rebounds: s.rebounds,
          assists: s.assists,
        }))
      ),
    }
  }

  return data
}
