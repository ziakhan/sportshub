import { prisma } from "@youthbasketballhub/db"
import { todayUtcDateFloor } from "@/lib/calendar/timezone"
import { formatTrainingSchedule } from "@/lib/training"

/**
 * Public club profile — ONE source for the web /club/[slug] page's data
 * assembly and the native club screen (GET /api/mobile/browse/clubs/[slug],
 * 2026-07-24 drift fix, same class as the directory-clubs/directory-leagues
 * consolidations). Owns everything anonymous-safe about a club's public
 * page: identity/branding, teams, open programs (tryouts/house
 * leagues/camps/tournaments/training/1-on-1), published-review rating +
 * recent reviews, staff count, announcements, recent/upcoming games and
 * news. Viewer-specific bits (signed-in state, "can manage this page",
 * follow status) stay in the callers — they need a session, this module
 * never does.
 *
 * Review visibility here matches the web page's policy ("gate + moderate":
 * FLAGGED stays publicly visible until an admin moderates; only REMOVED is
 * hidden) — the mobile route used to count PUBLISHED only, undercounting.
 */

export interface ClubProfileTeam {
  id: string
  name: string
  ageGroup: string
  gender: string | null
  season?: string | null
}

export interface ClubProfileReview {
  id: string
  rating: number
  title: string | null
  content: string | null
  status: string
  createdAt: Date
  reviewer: { firstName: string | null; lastName: string | null }
}

export interface ClubProfileData {
  club: {
    id: string
    slug: string
    name: string
    description: string | null
    city: string | null
    state: string | null
    country: string | null
    address: string | null
    zipCode: string | null
    phoneNumber: string | null
    contactEmail: string | null
    website: string | null
    status: string
    currency: string
    branding: {
      primaryColor: string | null
      logoUrl: string | null
      bannerUrl: string | null
      tagline: string | null
      socials: unknown
      pageLayout: unknown
    } | null
  }
  teams: ClubProfileTeam[]
  tryouts: any[]
  houseLeagues: any[]
  camps: any[]
  tournaments: any[]
  trainingSessions: any[]
  /** Trainer 1-on-1 booking (TRAINER tenants with booking on) — null = hidden. */
  oneOnOne: { title: string; fee: number | null; slotMinutes: number; players: any[] } | null
  staffCount: number
  announcements: any[]
  recentGames: any[]
  upcomingGames: any[]
  news: any[]
  rating: { average: number | null; count: number }
  reviews: ClubProfileReview[]
  /** The viewer's own review of this club (any status) — only populated
   *  when `opts.userId` is passed (the web page's signed-in viewer). */
  ownReview: { id: string; rating: number; title: string | null; content: string | null; status: string } | null
}

async function getHouseLeagues(tenantId: string) {
  const raw = await (prisma as any).houseLeague.findMany({
    where: { tenantId, isPublished: true, endDate: { gte: todayUtcDateFloor() } },
    select: {
      id: true, name: true, ageGroups: true, gender: true, season: true,
      startDate: true, endDate: true, location: true, fee: true, maxParticipants: true,
      _count: { select: { signups: true } },
    },
    orderBy: { startDate: "asc" },
  })
  return (raw || []).map((l: any) => ({ ...l, fee: Number(l.fee) }))
}

async function getCamps(tenantId: string) {
  const raw = await (prisma as any).camp.findMany({
    where: { tenantId, isPublished: true, endDate: { gte: todayUtcDateFloor() } },
    select: {
      id: true, name: true, campType: true, ageGroup: true, gender: true,
      numberOfWeeks: true, weeklyFee: true, fullCampFee: true, location: true,
    },
    orderBy: { startDate: "asc" },
  })
  return (raw || []).map((c: any) => ({
    ...c,
    weeklyFee: Number(c.weeklyFee),
    fullCampFee: c.fullCampFee ? Number(c.fullCampFee) : null,
  }))
}

async function getTrainingSessions(tenantId: string) {
  const raw = await (prisma as any).trainingSession.findMany({
    where: {
      tenantId,
      isPublished: true,
      OR: [
        { scheduleType: "ONE_TIME", startAt: { gte: new Date() } },
        { scheduleType: "RECURRING", endDate: { gte: todayUtcDateFloor() } },
      ],
    },
    select: {
      id: true, title: true, sessionType: true, scheduleType: true, startAt: true,
      dayOfWeek: true, startTime: true, startDate: true, endDate: true,
      durationMinutes: true, capacity: true, fee: true, location: true,
    },
  })
  return (raw || []).map((s: any) => ({
    ...s,
    fee: Number(s.fee),
    scheduleText: formatTrainingSchedule(s),
  }))
}

async function getOneOnOne(tenantId: string, userId: string | null) {
  const profile = await (prisma as any).trainerProfile.findUnique({
    where: { tenantId },
    select: { oneOnOneEnabled: true, oneOnOneTitle: true, oneOnOneFee: true, slotMinutes: true },
  })
  if (!profile?.oneOnOneEnabled) return null
  const players = userId
    ? await prisma.player.findMany({
        where: { parentId: userId, deletedAt: null },
        select: { id: true, firstName: true, lastName: true },
        orderBy: { firstName: "asc" },
      })
    : []
  return {
    title: profile.oneOnOneTitle,
    fee: profile.oneOnOneFee != null ? Number(profile.oneOnOneFee) : null,
    slotMinutes: profile.slotMinutes,
    players,
  }
}

async function getHostedTournaments(tenantId: string) {
  const raw = await (prisma as any).tournament.findMany({
    where: {
      tenantId,
      status: { in: ["REGISTRATION", "IN_PROGRESS"] },
      startDate: { gte: todayUtcDateFloor() },
    },
    select: {
      id: true, name: true, city: true, state: true, status: true,
      startDate: true, endDate: true, teamFee: true, currency: true,
      gamesGuaranteed: true,
      _count: { select: { teams: true } },
    },
    orderBy: { startDate: "asc" },
  })
  return (raw || []).map((t: any) => ({ ...t, teamFee: Number(t.teamFee) }))
}

async function getAnnouncements(tenantId: string) {
  return (prisma as any).announcement.findMany({
    where: { tenantId, teamId: null, isPublic: true },
    orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
    take: 6,
  })
}

async function getGames(teamIds: string[]) {
  if (teamIds.length === 0) return { recentGames: [], upcomingGames: [] }
  const now = new Date()
  const [recentGames, upcomingGames] = await Promise.all([
    prisma.game.findMany({
      where: {
        status: "COMPLETED",
        OR: [{ homeTeamId: { in: teamIds } }, { awayTeamId: { in: teamIds } }],
      },
      select: {
        id: true, scheduledAt: true, homeScore: true, awayScore: true,
        homeTeam: { select: { name: true } }, awayTeam: { select: { name: true } },
      },
      orderBy: { scheduledAt: "desc" },
      take: 4,
    }),
    prisma.game.findMany({
      where: {
        status: { in: ["SCHEDULED", "LIVE"] },
        scheduledAt: { gte: now },
        OR: [{ homeTeamId: { in: teamIds } }, { awayTeamId: { in: teamIds } }],
      },
      select: {
        id: true, scheduledAt: true, status: true,
        homeTeam: { select: { name: true } }, awayTeam: { select: { name: true } },
      },
      orderBy: { scheduledAt: "asc" },
      take: 4,
    }),
  ])
  return { recentGames, upcomingGames }
}

async function getClubNews(tenantId: string, teamIds: string[]) {
  const orTags: any[] = [{ tenantId }]
  if (teamIds.length) orTags.push({ teamId: { in: teamIds } })
  return (prisma as any).post.findMany({
    where: { status: "PUBLISHED", tags: { some: { OR: orTags } } },
    select: {
      id: true, title: true, slug: true, publishedAt: true,
      media: { select: { type: true, url: true, posterUrl: true }, orderBy: { sortOrder: "asc" as const }, take: 1 },
    },
    orderBy: { publishedAt: "desc" },
    take: 4,
  })
}

export async function getClubProfile(
  slug: string,
  opts: { userId?: string | null } = {}
): Promise<ClubProfileData | null> {
  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    include: { branding: true },
  })
  if (!tenant || (tenant.status !== "ACTIVE" && tenant.status !== "UNCLAIMED")) return null

  const userId = opts.userId ?? null
  // Visibility policy ("Gate + moderate"): FLAGGED reviews stay publicly
  // visible until an admin moderates (a flag is not a takedown); only
  // REMOVED is hidden. Keep in sync with GET /api/reviews.
  const publicStatuses = ["PUBLISHED", "FLAGGED"] as any

  const [
    teams,
    tryouts,
    staffCount,
    houseLeagues,
    camps,
    tournaments,
    trainingSessions,
    reviewAgg,
    reviews,
    announcements,
    ownReview,
  ] = await Promise.all([
    // archivedAt: null — "active lists" per the season-continuity plan;
    // archived teams keep their history but drop off the public page. The
    // web page's own query was missing this filter (only the mobile route
    // had it) — consolidating picks the correct behavior for both.
    prisma.team.findMany({
      where: { tenantId: tenant.id, archivedAt: null },
      select: { id: true, name: true, ageGroup: true, gender: true, season: true },
      orderBy: { name: "asc" },
    }),
    prisma.tryout.findMany({
      where: { tenantId: tenant.id, isPublished: true, isPublic: true, scheduledAt: { gte: new Date() } },
      select: { id: true, title: true, ageGroup: true, gender: true, location: true, scheduledAt: true, fee: true },
      orderBy: { scheduledAt: "asc" },
    }),
    prisma.userRole.count({
      where: { tenantId: tenant.id, role: { in: ["ClubOwner", "ClubManager", "Staff"] } },
    }),
    getHouseLeagues(tenant.id),
    getCamps(tenant.id),
    getHostedTournaments(tenant.id),
    getTrainingSessions(tenant.id),
    prisma.review.aggregate({
      where: { tenantId: tenant.id, status: { in: publicStatuses } },
      _avg: { rating: true },
      _count: { rating: true },
    }),
    prisma.review.findMany({
      where: { tenantId: tenant.id, status: { in: publicStatuses } },
      select: {
        id: true, rating: true, title: true, content: true, status: true, createdAt: true,
        reviewer: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    getAnnouncements(tenant.id),
    userId
      ? prisma.review.findFirst({
          where: { tenantId: tenant.id, reviewerId: userId },
          select: { id: true, rating: true, title: true, content: true, status: true },
        })
      : null,
  ])

  const tryoutsWithFee = tryouts.map((t: any) => ({ ...t, fee: Number(t.fee) }))
  const teamIds = teams.map((t: any) => t.id)
  const [{ recentGames, upcomingGames }, news, oneOnOne] = await Promise.all([
    getGames(teamIds),
    getClubNews(tenant.id, teamIds),
    getOneOnOne(tenant.id, userId),
  ])

  const branding: any = tenant.branding

  return {
    club: {
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      description: tenant.description,
      city: tenant.city,
      state: tenant.state,
      country: tenant.country,
      address: tenant.address,
      zipCode: tenant.zipCode,
      phoneNumber: tenant.phoneNumber,
      contactEmail: tenant.contactEmail,
      website: tenant.website,
      status: tenant.status,
      currency: tenant.currency,
      branding: branding
        ? {
            primaryColor: branding.primaryColor ?? null,
            logoUrl: branding.logoUrl ?? null,
            bannerUrl: branding.bannerUrl ?? null,
            tagline: branding.tagline ?? null,
            socials: branding.socials ?? null,
            pageLayout: branding.pageLayout ?? null,
          }
        : null,
    },
    teams,
    tryouts: tryoutsWithFee,
    houseLeagues,
    camps,
    tournaments,
    trainingSessions,
    oneOnOne,
    staffCount,
    announcements,
    recentGames,
    upcomingGames,
    news,
    rating: {
      average: reviewAgg._avg.rating ? Number(reviewAgg._avg.rating.toFixed(1)) : null,
      count: reviewAgg._count.rating,
    },
    reviews,
    ownReview,
  }
}
