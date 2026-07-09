import { prisma } from "@youthbasketballhub/db"
import { notFound } from "next/navigation"
import Link from "next/link"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import type { Metadata } from "next"
import { FollowButton } from "@/components/follow-button"
import { resolveLayout, zoneBlocks } from "@/lib/club-page/blocks"
import { ClubBlock, hasBlockContent, type ClubPageData } from "./club-blocks"

async function getClubBySlug(slug: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    include: { branding: true },
  })
  if (!tenant || (tenant.status !== "ACTIVE" && tenant.status !== "UNCLAIMED")) return null
  return tenant
}

async function getHouseLeagues(tenantId: string) {
  const raw = await (prisma as any).houseLeague.findMany({
    where: { tenantId, isPublished: true, endDate: { gte: new Date() } },
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
    where: { tenantId, isPublished: true, endDate: { gte: new Date() } },
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

async function getClubData(tenantId: string) {
  const [teams, tryouts, staffCount] = await Promise.all([
    prisma.team.findMany({
      where: { tenantId },
      select: { id: true, name: true, ageGroup: true, gender: true, season: true },
      orderBy: { name: "asc" },
    }),
    prisma.tryout.findMany({
      where: { tenantId, isPublished: true, isPublic: true, scheduledAt: { gte: new Date() } },
      select: { id: true, title: true, ageGroup: true, gender: true, location: true, scheduledAt: true, fee: true },
      orderBy: { scheduledAt: "asc" },
    }),
    prisma.userRole.count({
      where: { tenantId, role: { in: ["ClubOwner", "ClubManager", "Staff"] } },
    }),
  ])
  return { teams, tryouts: tryouts.map((t: any) => ({ ...t, fee: Number(t.fee) })), staffCount }
}

async function getReviewsData(tenantId: string) {
  const session = await getServerSession(authOptions).catch(() => null)
  const userId = session?.user?.id ?? null
  const [reviews, aggregate, ownReview] = await Promise.all([
    prisma.review.findMany({
      where: { tenantId, status: "PUBLISHED" },
      select: {
        id: true, rating: true, title: true, content: true, createdAt: true,
        reviewer: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.review.aggregate({
      where: { tenantId, status: "PUBLISHED" },
      _avg: { rating: true },
      _count: { rating: true },
    }),
    userId ? prisma.review.findFirst({ where: { tenantId, reviewerId: userId }, select: { id: true } }) : null,
  ])
  return {
    reviews,
    averageRating: aggregate._avg.rating ? Number(aggregate._avg.rating.toFixed(1)) : null,
    totalReviews: aggregate._count.rating,
    signedIn: !!userId,
    alreadyReviewed: !!ownReview,
    userId,
  }
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
        id: true, scheduledAt: true,
        homeTeam: { select: { name: true } }, awayTeam: { select: { name: true } },
      },
      orderBy: { scheduledAt: "asc" },
      take: 4,
    }),
  ])
  return { recentGames, upcomingGames }
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: params.slug },
    select: { name: true, description: true, city: true, state: true, branding: { select: { tagline: true } } },
  })
  if (!tenant) return { title: "Club Not Found" }
  return {
    title: `${tenant.name} - Youth Basketball Club`,
    description:
      (tenant.branding as any)?.tagline ||
      tenant.description ||
      `${tenant.name} youth basketball club in ${tenant.city || ""}, ${tenant.state || ""}`,
  }
}

const NAV = [
  ["about", "About"],
  ["teams", "Teams"],
  ["programs", "Programs"],
  ["schedule", "Schedule"],
  ["contact", "Contact"],
] as const

export default async function ClubProfilePage({ params }: { params: { slug: string } }) {
  const club = await getClubBySlug(params.slug)
  if (!club) notFound()

  const [clubData, houseLeagues, camps, reviewsData, announcements] = await Promise.all([
    getClubData(club.id),
    getHouseLeagues(club.id),
    getCamps(club.id),
    getReviewsData(club.id),
    getAnnouncements(club.id),
  ])
  const { teams, tryouts, staffCount } = clubData
  const { userId } = reviewsData
  const { recentGames, upcomingGames } = await getGames(teams.map((t: any) => t.id))
  const initialFollowing = userId
    ? !!(await (prisma as any).follow.findFirst({ where: { userId, tenantId: club.id }, select: { id: true } }))
    : false

  const branding: any = club.branding
  const primary = branding?.primaryColor || "#1a73e8"
  const data: ClubPageData = {
    club,
    currency: club.currency,
    accent: primary,
    teams,
    tryouts,
    houseLeagues,
    camps,
    reviews: reviewsData.reviews,
    averageRating: reviewsData.averageRating,
    totalReviews: reviewsData.totalReviews,
    signedIn: reviewsData.signedIn,
    alreadyReviewed: reviewsData.alreadyReviewed,
    staffCount,
    announcements,
    recentGames,
    upcomingGames,
  }

  const layout = resolveLayout(branding?.pageLayout)
  const mainCfg = zoneBlocks(layout, "main")
  const railCfg = zoneBlocks(layout, "rail")
  const navSections = NAV.filter(
    ([k]) => layout.find((b) => b.key === k)?.visible && hasBlockContent(k, data)
  )
  const pinnedRail = railCfg.filter((b) => b.pinMobile && hasBlockContent(b.key, data))

  const subtitle = [club.city, club.state, club.country].filter(Boolean).join(", ")

  return (
    <div className="[scroll-behavior:smooth]">
      {/* HERO */}
      <header className="relative overflow-hidden text-white" style={{ backgroundColor: primary }}>
        {branding?.bannerUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={branding.bannerUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/10" />
        <div className="container relative mx-auto px-4 py-10 sm:py-14">
          <div className="flex flex-wrap items-end gap-5">
            {branding?.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={branding.logoUrl}
                alt={`${club.name} logo`}
                className="h-20 w-20 flex-shrink-0 rounded-2xl border-2 border-white/40 bg-white object-cover shadow-lg sm:h-24 sm:w-24"
              />
            )}
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-3xl font-bold drop-shadow sm:text-4xl">{club.name}</h1>
              {branding?.tagline && (
                <p className="mt-1 max-w-2xl text-base font-medium text-white/90 drop-shadow">
                  {branding.tagline}
                </p>
              )}
              {subtitle && <p className="mt-1 text-sm text-white/80">{subtitle}</p>}
            </div>
          </div>

          {club.description && (
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/85 line-clamp-3">
              {club.description}
            </p>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-3">
            {hasBlockContent("programs", data) && (
              <a
                href="#programs"
                className="bg-hoop-500 hover:bg-hoop-600 cursor-pointer rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition"
              >
                View programs
              </a>
            )}
            <a
              href="#contact"
              className="cursor-pointer rounded-xl border border-white/50 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20"
            >
              Contact
            </a>
            {club.status === "UNCLAIMED" ? (
              <Link
                href={`/clubs/find?q=${encodeURIComponent(club.name)}`}
                className="shadow-soft cursor-pointer rounded-xl bg-white px-5 py-2.5 text-sm font-semibold transition hover:bg-white/90"
                style={{ color: primary }}
              >
                Claim this club
              </Link>
            ) : (
              <FollowButton
                tenantId={club.id}
                initialFollowing={initialFollowing}
                isAuthenticated={reviewsData.signedIn}
                variant="banner"
              />
            )}
          </div>
        </div>
      </header>

      {/* STICKY SUB-NAV */}
      {navSections.length > 0 && (
        <nav className="border-ink-100 sticky top-0 z-20 border-b bg-white/95 backdrop-blur">
          <div className="container mx-auto flex gap-1 overflow-x-auto px-4 py-2 text-sm">
            {navSections.map(([anchor, label]) => (
              <a
                key={anchor}
                href={`#${anchor}`}
                className="text-ink-600 hover:bg-ink-50 hover:text-ink-950 cursor-pointer whitespace-nowrap rounded-lg px-3 py-1.5 font-medium transition"
              >
                {label}
              </a>
            ))}
          </div>
        </nav>
      )}

      <div className="container mx-auto px-4 py-8">
        {/* Mobile: pinned rail widgets promoted to the top */}
        {pinnedRail.length > 0 && (
          <div className="mb-6 space-y-4 lg:hidden">
            {pinnedRail.map((b) => (
              <ClubBlock key={`pin-${b.key}`} blockKey={b.key} variant="rail" data={data} />
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Main zone */}
          <div className="space-y-8 lg:col-span-2">
            {mainCfg.map((b) => (
              <ClubBlock key={b.key} blockKey={b.key} variant="main" data={data} />
            ))}
          </div>
          {/* Rail zone */}
          <div className="space-y-6">
            {railCfg.map((b) => (
              <div key={b.key} className={b.pinMobile ? "hidden lg:block" : undefined}>
                <ClubBlock blockKey={b.key} variant="rail" data={data} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
