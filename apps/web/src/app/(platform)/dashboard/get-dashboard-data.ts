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
    offerPipeline: {
      pending: number
      accepted: number
      declined: number
      expired: number
      recent: Array<{
        id: string
        status: string
        player: { firstName: string; lastName: string }
        team: { id: string; name: string; tenantId: string }
      }>
    }
    offerCount: number
    activity: Array<{
      id: string
      type: "offer_accepted" | "offer_declined" | "signup" | "invite_sent" | "tryout_published"
      message: string
      highlight: string
      createdAt: Date
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
      leagueId: string
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
      const [tenants, teams, offerCountsByStatus, recentOffers, recentSignups, recentPublishedTryouts, recentInvites] =
        await Promise.all([
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
          prisma.offer.groupBy({
            by: ["status"],
            where: { team: { tenantId: { in: tenantIds } } },
            _count: { _all: true },
          }),
          prisma.offer.findMany({
            where: { team: { tenantId: { in: tenantIds } } },
            include: {
              player: { select: { firstName: true, lastName: true } },
              team: { select: { id: true, name: true, tenantId: true } },
            },
            orderBy: { updatedAt: "desc" },
            take: 5,
          }),
          prisma.tryoutSignup.findMany({
            where: { tryout: { tenantId: { in: tenantIds } } },
            include: {
              tryout: { select: { id: true, title: true } },
            },
            orderBy: { createdAt: "desc" },
            take: 5,
          }),
          prisma.tryout.findMany({
            where: { tenantId: { in: tenantIds }, isPublished: true },
            select: { id: true, title: true, updatedAt: true },
            orderBy: { updatedAt: "desc" },
            take: 5,
          }),
          prisma.staffInvitation.findMany({
            where: { tenantId: { in: tenantIds } },
            select: { id: true, invitedEmail: true, createdAt: true },
            orderBy: { createdAt: "desc" },
            take: 5,
          }),
        ])

      const pipelineCounts = offerCountsByStatus.reduce(
        (acc: Record<string, number>, row: any) => {
          acc[row.status] = row._count._all
          return acc
        },
        {} as Record<string, number>
      )

      const offerCount =
        (pipelineCounts.PENDING || 0) +
        (pipelineCounts.ACCEPTED || 0) +
        (pipelineCounts.DECLINED || 0) +
        (pipelineCounts.EXPIRED || 0)

      const activity = buildActivityFeed({
        offers: recentOffers as any[],
        signups: recentSignups as any[],
        tryouts: recentPublishedTryouts as any[],
        invites: recentInvites as any[],
      })

      data.clubOwner = {
        tenants,
        teams,
        offerPipeline: {
          pending: pipelineCounts.PENDING || 0,
          accepted: pipelineCounts.ACCEPTED || 0,
          declined: pipelineCounts.DECLINED || 0,
          expired: pipelineCounts.EXPIRED || 0,
          recent: (recentOffers as any[]).slice(0, 3).map((offer) => ({
            id: offer.id,
            status: offer.status,
            player: offer.player,
            team: offer.team,
          })),
        },
        offerCount,
        activity,
      }
    } else {
      data.clubOwner = {
        tenants: [],
        teams: [],
        offerPipeline: { pending: 0, accepted: 0, declined: 0, expired: 0, recent: [] },
        offerCount: 0,
        activity: [],
      }
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

  // LeagueOwner / LeagueManager data — one card per Season under the user's leagues.
  if (roleNames.includes("LeagueOwner") || roleNames.includes("LeagueManager")) {
    const leagueIds = user.roles
      .filter((r) => (r.role === "LeagueOwner" || r.role === "LeagueManager") && r.leagueId)
      .map((r) => r.leagueId!)

    if (leagueIds.length > 0) {
      const seasons = await prisma.season.findMany({
        where: { leagueId: { in: leagueIds } },
        include: {
          league: { select: { name: true } },
          _count: { select: { teamSubmissions: true, games: true } },
        },
        orderBy: { createdAt: "desc" },
      })
      data.leagueOwner = {
        leagues: seasons.map((s: any) => ({
          id: s.id,
          leagueId: s.leagueId,
          name: s.league.name,
          season: s.label,
          _count: { teams: s._count.teamSubmissions, games: s._count.games },
        })),
      }
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

type ActivityEntry = NonNullable<DashboardData["clubOwner"]>["activity"][number]

function buildActivityFeed(input: {
  offers: Array<{
    id: string
    status: string
    updatedAt: Date
    respondedAt: Date | null
    player: { firstName: string; lastName: string }
    team: { id: string; name: string }
  }>
  signups: Array<{
    id: string
    playerName: string
    createdAt: Date
    tryout: { id: string; title: string }
  }>
  tryouts: Array<{ id: string; title: string; updatedAt: Date }>
  invites: Array<{ id: string; invitedEmail: string; createdAt: Date }>
}): ActivityEntry[] {
  const entries: ActivityEntry[] = []

  for (const offer of input.offers) {
    if (offer.status === "ACCEPTED" || offer.status === "DECLINED") {
      const playerName = `${offer.player.firstName} ${offer.player.lastName}`.trim()
      entries.push({
        id: `offer-${offer.id}`,
        type: offer.status === "ACCEPTED" ? "offer_accepted" : "offer_declined",
        message: `${offer.status === "ACCEPTED" ? "accepted" : "declined"} offer for ${offer.team.name}`,
        highlight: playerName,
        createdAt: offer.respondedAt || offer.updatedAt,
      })
    }
  }

  for (const signup of input.signups) {
    entries.push({
      id: `signup-${signup.id}`,
      type: "signup",
      message: `signed up for ${signup.tryout.title}`,
      highlight: signup.playerName,
      createdAt: signup.createdAt,
    })
  }

  for (const tryout of input.tryouts) {
    entries.push({
      id: `tryout-${tryout.id}`,
      type: "tryout_published",
      message: "published",
      highlight: tryout.title,
      createdAt: tryout.updatedAt,
    })
  }

  for (const invite of input.invites) {
    entries.push({
      id: `invite-${invite.id}`,
      type: "invite_sent",
      message: "Staff invite sent to",
      highlight: invite.invitedEmail,
      createdAt: invite.createdAt,
    })
  }

  return entries
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 6)
}
