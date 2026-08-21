import { prisma } from "@youthbasketballhub/db"
import { todayUtcDateFloor } from "@/lib/calendar/timezone"
import { formatTrainingSchedule } from "@/lib/training"
import { resolveCoverUrl } from "@/lib/queries/content"
import { PUBLISHED_GAME } from "@/lib/games/visibility"
import { listPublishedTryoutEvents, type PublicTryoutEvent } from "@/lib/queries/tryout-events"

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
      // Club Page Studio (2026-08-18). The query uses include: { branding: true },
      // so these arrive at runtime already; this only teaches the type about them.
      theme: string | null
      accentKey: string | null
      headerStyle: string | null
      intensity: string | null
      shape: string | null
      density: string | null
      bannerFocalX: number | null
      bannerFocalY: number | null
    } | null
  }
  teams: ClubProfileTeam[]
  tryouts: any[]
  /**
   * Club tryout EVENTS (docs/roadmap/club-tryouts-and-age-pools, ruling 10) —
   * additive 2026-08-20, straight from lib/queries/tryout-events. Each event's
   * sessions are also present in `tryouts` above (they are Tryout rows), so a
   * surface that renders both must skip the session ids it already showed
   * under an event. `tryouts` is left unfiltered on purpose: fielded native
   * bundles read it and have no event UI yet, and losing rows there would be a
   * subtractive change (parity law).
   */
  tryoutEvents: PublicTryoutEvent[]
  houseLeagues: any[]
  camps: any[]
  tournaments: any[]
  trainingSessions: any[]
  /** Trainer 1-on-1 booking (TRAINER tenants with booking on) — null = hidden. */
  oneOnOne: { title: string; fee: number | null; slotMinutes: number; players: any[] } | null
  staffCount: number
  /** Club Page Studio sections (2026-08-18). Auto-filled from data we already hold. */
  staff: Array<{ id: string; name: string; role: string; designation: string | null; avatarUrl: string | null }>
  venues: Array<{ id: string; name: string; address: string; city: string; latitude: number | null; longitude: number | null }>
  /** Follow.tenantId count — native club hero stat chip (2026-07-25 additive). */
  followerCount: number
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
        ...PUBLISHED_GAME,
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
  const posts = await (prisma as any).post.findMany({
    where: { status: "PUBLISHED", tags: { some: { OR: orTags } } },
    select: {
      id: true, title: true, slug: true, publishedAt: true,
      media: { select: { type: true, url: true, posterUrl: true }, orderBy: { sortOrder: "asc" as const }, take: 1 },
      // Separate, unfiltered-by-the-match tags lookup — finds THIS post's own
      // game tag (if any) so resolveCoverUrl can swap in the one-source PNG
      // cover instead of the SVG data-URI stashed in media (news card sweep
      // 2026-07-24, same pattern as getPublicFeed).
      tags: { where: { gameId: { not: null } }, select: { gameId: true }, take: 1 },
    },
    orderBy: { publishedAt: "desc" },
    take: 4,
  })
  return posts.map((p: any) => ({
    id: p.id,
    title: p.title,
    slug: p.slug,
    publishedAt: p.publishedAt,
    coverUrl: resolveCoverUrl(p.tags, p.media),
  }))
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
  // An unreviewed census import has no public page yet, and a club that was
  // merged into another must not keep its own — otherwise the duplicate stays
  // reachable by URL after an admin has resolved it.
  if (!(tenant as any).publishedAt || (tenant as any).mergedIntoId) return null

  const userId = opts.userId ?? null
  // Visibility policy ("Gate + moderate"): FLAGGED reviews stay publicly
  // visible until an admin moderates (a flag is not a takedown); only
  // REMOVED is hidden. Keep in sync with GET /api/reviews.
  const publicStatuses = ["PUBLISHED", "FLAGGED"] as any

  const [
    teams,
    tryouts,
    staffCount,
    followerCount,
    houseLeagues,
    camps,
    tournaments,
    trainingSessions,
    reviewAgg,
    reviews,
    announcements,
    ownReview,
    staffRows,
    venueRows,
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
    (prisma as any).follow.count({ where: { tenantId: tenant.id } }),
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
    // Club Page Studio sections (2026-08-18). Both fill themselves from data
    // the club already maintains, so turning the section on costs it nothing.
    prisma.userRole.findMany({
      where: {
        tenantId: tenant.id,
        role: { in: ["ClubOwner", "ClubManager", "Staff", "Trainer"] as any },
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: {
        id: true,
        role: true,
        designation: true,
        user: { select: { firstName: true, lastName: true, avatarUrl: true } },
      },
      take: 40,
    }),
    prisma.venue.findMany({
      where: { tenantId: tenant.id },
      select: { id: true, name: true, address: true, city: true, latitude: true, longitude: true },
      orderBy: { name: "asc" },
      take: 12,
    }),
  ])

  const tryoutsWithFee = tryouts.map((t: any) => ({ ...t, fee: Number(t.fee) }))
  const teamIds = teams.map((t: any) => t.id)
  const [{ recentGames, upcomingGames }, news, oneOnOne, tryoutEvents] = await Promise.all([
    getGames(teamIds),
    getClubNews(tenant.id, teamIds),
    getOneOnOne(tenant.id, userId),
    listPublishedTryoutEvents(tenant.id),
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
            // Club Page Studio (2026-08-18). Nulls are fine: resolveTheme() falls
            // back field by field, and a club that only ever set a primaryColor
            // keeps it rather than snapping to the default accent.
            theme: (branding as any).theme ?? null,
            accentKey: (branding as any).accentKey ?? null,
            headerStyle: (branding as any).headerStyle ?? null,
            intensity: (branding as any).intensity ?? null,
            shape: (branding as any).shape ?? null,
            density: (branding as any).density ?? null,
            bannerFocalX: (branding as any).bannerFocalX ?? null,
            bannerFocalY: (branding as any).bannerFocalY ?? null,
          }
        : null,
    },
    teams,
    tryouts: tryoutsWithFee,
    tryoutEvents,
    houseLeagues,
    camps,
    tournaments,
    trainingSessions,
    oneOnOne,
    staffCount,
    staff: (staffRows as any[]).map((r) => ({
      id: r.id,
      name: [r.user?.firstName, r.user?.lastName].filter(Boolean).join(" ") || "Staff",
      role: String(r.role),
      designation: r.designation ? String(r.designation) : null,
      avatarUrl: r.user?.avatarUrl ?? null,
    })),
    venues: (venueRows as any[]).map((v) => ({
      id: v.id,
      name: v.name,
      address: v.address,
      city: v.city,
      latitude: v.latitude ?? null,
      longitude: v.longitude ?? null,
    })),
    followerCount,
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
