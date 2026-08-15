import { prisma } from "@youthbasketballhub/db"
import { notFound } from "next/navigation"
import Link from "next/link"
import { format } from "date-fns"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import type { Metadata } from "next"
import { FollowButton } from "@/components/follow-button"
import { CourtBackdropLayer, SmartBack } from "@/components/ui"
import { resolveLayout, zoneBlocks } from "@/lib/club-page/blocks"
import { brandStyle, chosenBrandColor, NEUTRAL_BRAND } from "@/lib/club-page/brand"
import { ClubBlock, hasBlockContent, type ClubPageData } from "./club-blocks"
import { ClubSubNav } from "./club-subnav"
import { JsonLd, clubJsonLd } from "@/lib/seo/jsonld"
import { trackPublicView } from "@/lib/seo/track"
import { getClubProfile } from "@/lib/queries/club-profile"
import { DemoBadge } from "@/components/demo-badge"

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: params.slug },
    select: {
      name: true,
      description: true,
      city: true,
      state: true,
      status: true,
      isDemo: true,
      branding: { select: { tagline: true } },
      _count: { select: { teams: true } },
    },
  })
  if (!tenant) return { title: "Club Not Found" }
  const place = [tenant.city, tenant.state].filter(Boolean).join(", ")
  // Min-content bar (seo-strategy §1.4, owner-decided 2026-07-12): imported
  // UNCLAIMED shells are indexable only once they carry something substantive
  // (a description or teams). Truly-empty shells stay crawlable but noindex.
  // Demo-world clubs (limited launch) never enter the index at all.
  const isThinShell =
    tenant.status === "UNCLAIMED" && !tenant.description && tenant._count.teams === 0
  return {
    ...(tenant.isDemo
      ? { robots: { index: false, follow: false } }
      : isThinShell
        ? { robots: { index: false, follow: true } }
        : {}),
    title: place
      ? `${tenant.name} — Youth Basketball Club in ${place}`
      : `${tenant.name} — Youth Basketball Club`,
    description:
      (tenant.branding as any)?.tagline ||
      tenant.description ||
      `${tenant.name} youth basketball club${place ? ` in ${place}` : ""} — teams, tryouts, camps, schedules and reviews.`,
    alternates: { canonical: `/club/${params.slug}` },
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
  const session = await getServerSession(authOptions).catch(() => null)
  const userId = (session?.user as any)?.id ?? null

  // Single shared source for the public data — the same getClubProfile() the
  // native club screen calls (GET /api/mobile/browse/clubs/[slug]).
  const profile = await getClubProfile(params.slug, { userId })
  if (!profile) notFound()
  const {
    club,
    teams,
    tryouts,
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
    rating,
    reviews,
    ownReview,
  } = profile

  await trackPublicView({
    path: `/club/${params.slug}`,
    entityType: "CLUB",
    entityId: club.id,
    tenantId: club.id,
  })

  const initialFollowing = userId
    ? !!(await (prisma as any).follow.findFirst({ where: { userId, tenantId: club.id }, select: { id: true } }))
    : false

  // Owners/managers of this club (or platform admins) get an inline "Edit page"
  // affordance on the public hero.
  const canManage = userId
    ? (await prisma.userRole.count({
        where: {
          userId,
          OR: [
            { role: "PlatformAdmin" },
            { tenantId: club.id, role: { in: ["ClubOwner", "ClubManager"] } },
          ],
        },
      })) > 0
    : false

  const branding = club.branding
  // Neutral by default, brand by choice (owner ruling 2026-08-14). A club's own
  // page is the one place its colour is allowed to run, and only when the club
  // claimed its page and picked something other than the imported default.
  // Everyone else's page wears the same navy, which is what a thousand
  // unclaimed listings should have looked like from the start.
  const primary = chosenBrandColor({ status: club.status, primaryColor: branding?.primaryColor })
  const accent = primary ?? NEUTRAL_BRAND
  const data: ClubPageData = {
    club,
    currency: club.currency,
    accent,
    teams,
    tryouts,
    houseLeagues,
    camps,
    tournaments,
    trainingSessions,
    oneOnOne,
    reviews,
    averageRating: rating.average,
    totalReviews: rating.count,
    signedIn: !!userId,
    ownReview,
    canManage,
    staffCount,
    announcements,
    recentGames,
    upcomingGames,
    news,
  }

  const layout = resolveLayout(branding?.pageLayout)
  const mainCfg = zoneBlocks(layout, "main")
  const railCfg = zoneBlocks(layout, "rail")
  // Menus are STATIC (owner rule 2026-07-11): a tab only disappears when the
  // club hides that block in the customize editor — never because it's empty.
  // Empty sections render an empty state instead (club-blocks.tsx).
  const navSections = NAV.filter(([k]) => layout.find((b) => b.key === k)?.visible).map(
    ([anchor, label]) => ({ anchor, label })
  )
  const pinnedRail = railCfg.filter((b) => b.pinMobile && hasBlockContent(b.key, data))

  const subtitle = [club.city, club.state, club.country].filter(Boolean).join(", ")
  const nextGame = upcomingGames[0]
  const programCount =
    tryouts.length + houseLeagues.length + camps.length + tournaments.length + trainingSessions.length

  // Quick-stats strip under the hero.
  const heroStats: Array<{ value: string; label: string }> = [
    { value: String(teams.length), label: teams.length === 1 ? "Team" : "Teams" },
    { value: String(programCount), label: "Open programs" },
    {
      value: nextGame ? format(new Date(nextGame.scheduledAt), "MMM d") : "TBD",
      label: "Next game",
    },
    rating.average !== null
      ? { value: rating.average.toFixed(1), label: "Rating" }
      : { value: String(staffCount), label: "Staff" },
  ]

  const clubIsDemo = !!(await prisma.tenant.findUnique({
    where: { id: club.id },
    select: { isDemo: true },
  }))?.isDemo

  return (
    <div className="font-barlow [scroll-behavior:smooth]" style={brandStyle(accent)}>
      {clubIsDemo && (
        <div className="flex flex-wrap items-center gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2.5 sm:px-6">
          <DemoBadge long />
          <p className="text-sm text-amber-900">
            A preview club with demo data. Real clubs run pages just like this one.
          </p>
        </div>
      )}
      <JsonLd
        data={clubJsonLd({
          slug: params.slug,
          name: club.name,
          description: club.description,
          address: club.address,
          city: club.city,
          state: club.state,
          country: club.country,
          phoneNumber: club.phoneNumber,
          website: club.website,
          logoUrl: club.branding?.logoUrl ?? null,
          averageRating: rating.average,
          totalReviews: rating.count,
        })}
      />
      {/* HERO — court system v2, the daylight band (matches EntityHeader on the
          team / player / org hubs): maple planks under a warm wash with the
          court cropping in from the top-right, the club's own colour on the
          crest and the 4px baseline stripe, everything else white-on-ring so it
          reads on the wood. */}
      <header className="relative">
        {/* A club that uploaded cover art keeps it: it becomes the strip above
            the identity band instead of a wash under white text. */}
        {branding?.bannerUrl && (
          <div className="h-24 w-full overflow-hidden sm:h-36">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={branding.bannerUrl} alt="" className="h-full w-full object-cover" />
          </div>
        )}
        <div className="relative isolate overflow-hidden">
          <CourtBackdropLayer variant="daylight" intensity="band" />
          <div className="container relative z-10 mx-auto px-4 pb-9 pt-8 sm:pt-10">
            <SmartBack fallback="/" fallbackLabel="Home" className="-ml-1 mb-2" />
            {canManage && (
              <Link
                href={`/clubs/${club.id}/customize`}
                className="brand-focus border-ink-200 text-ink-700 absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-lg border bg-white/90 px-3 py-1.5 text-xs font-semibold shadow-sm transition hover:bg-white"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
                  <path d="M4 20h4L18 10l-4-4L4 16v4z" strokeLinejoin="round" />
                  <path d="M13.5 6.5l4 4" strokeLinecap="round" />
                </svg>
                Edit page
              </Link>
            )}

            <div className="flex flex-wrap items-end gap-5">
              {/* Crest: the logo when there is one, otherwise the club colour
                  carrying its initial (same rule as EntityHeader). */}
              <span
                className={`flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl text-3xl font-black shadow-lg sm:h-28 sm:w-28 sm:text-4xl ${
                  branding?.logoUrl || primary ? "text-white" : "bg-ink-100 text-ink-700"
                }`}
                style={{
                  backgroundColor: branding?.logoUrl ? "#ffffff" : primary ?? undefined,
                }}
              >
                {branding?.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={branding.logoUrl}
                    alt={`${club.name} logo`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  club.name.slice(0, 1).toUpperCase()
                )}
              </span>
              {/* min-w keeps the name column readable: on a phone the crest
                  takes its own line instead of squeezing the title into two
                  words (same rule as EntityHeader). */}
              <div className="min-w-[17rem] flex-1">
                <h1 className="font-display text-ink-950 text-[32px] font-black leading-[1.02] tracking-[-0.02em] break-words sm:text-[46px]">
                  {club.name}
                </h1>
                {branding?.tagline && (
                  <p className="text-ink-600 mt-1.5 max-w-2xl text-base font-medium sm:text-lg">
                    {branding.tagline}
                  </p>
                )}
                {subtitle && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="border-ink-200 text-ink-700 inline-flex items-center gap-1.5 rounded-full border bg-white/90 px-3 py-1 text-xs font-semibold shadow-sm">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
                        <path d="M12 21s7-5.686 7-11a7 7 0 10-14 0c0 5.314 7 11 7 11z" strokeLinejoin="round" />
                        <circle cx="12" cy="10" r="2.5" />
                      </svg>
                      {subtitle}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {club.description && (
              <p className="text-ink-600 mt-4 max-w-2xl text-sm leading-relaxed line-clamp-3">
                {club.description}
              </p>
            )}

            <div className="mt-6 flex flex-wrap items-center gap-3">
              {hasBlockContent("programs", data) && (
                <a
                  href="#programs"
                  className="brand-focus cursor-pointer rounded-xl bg-[var(--brand)] px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-[color:var(--brand-on)] shadow-sm transition-opacity hover:opacity-90"
                >
                  View programs
                </a>
              )}
              <a
                href="#contact"
                className="brand-focus border-ink-200 text-ink-800 hover:bg-ink-50 cursor-pointer rounded-xl border bg-white px-5 py-2.5 text-sm font-semibold shadow-sm transition-colors"
              >
                Contact
              </a>
              {club.status === "UNCLAIMED" ? (
                <Link
                  href={`/claim/${club.id}`}
                  className="brand-focus bg-ink-950 hover:bg-ink-800 cursor-pointer rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors"
                >
                  Claim this club
                </Link>
              ) : (
                <FollowButton
                  tenantId={club.id}
                  initialFollowing={initialFollowing}
                  isAuthenticated={!!userId}
                  /* The band is daylight now: the dark-banner styling would
                     disappear on the maple. */
                  variant="light"
                />
              )}
            </div>

            {/* Quick-stats strip — bridges hero and content. */}
            <div className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-[#e7dbc4] bg-[#e7dbc4] sm:grid-cols-4">
              {heroStats.map((s) => (
                <div key={s.label} className="bg-white/85 px-4 py-3 backdrop-blur">
                  <div className="font-display text-ink-950 text-3xl font-black leading-none">
                    {s.value}
                  </div>
                  <div className="text-ink-500 mt-1 text-[11px] font-semibold uppercase tracking-wide">
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
          {/* The baseline, 4px along the bottom edge: the club's own colour
              when it picked one, navy otherwise. */}
          <span
            aria-hidden="true"
            className={`absolute inset-x-0 bottom-0 z-10 h-1 ${primary ? "" : "bg-navy-900"}`}
            style={primary ? { backgroundColor: primary } : undefined}
          />
        </div>
      </header>

      {/* STICKY SUB-NAV (scroll-spy, brand active state) */}
      {navSections.length > 0 && <ClubSubNav sections={navSections} />}

      <div className="container mx-auto px-4 py-10">
        {/* Mobile: pinned rail widgets promoted to the top */}
        {pinnedRail.length > 0 && (
          <div className="mb-6 space-y-4 lg:hidden">
            {pinnedRail.map((b) => (
              <ClubBlock key={`pin-${b.key}`} blockKey={b.key} variant="rail" data={data} />
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3 lg:gap-10">
          {/* Main zone */}
          <div className="space-y-10 lg:col-span-2 lg:space-y-12">
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
