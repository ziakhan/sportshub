import { prisma } from "@youthbasketballhub/db"
import { notFound } from "next/navigation"
import Link from "next/link"
import { format } from "date-fns"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import type { Metadata } from "next"
import { FollowButton } from "@/components/follow-button"
import { SmartBack } from "@/components/ui"
import { resolveLayout, zoneBlocks } from "@/lib/club-page/blocks"
import { brandStyle } from "@/lib/club-page/brand"
import { ClubBlock, hasBlockContent, type ClubPageData } from "./club-blocks"
import { ClubSubNav } from "./club-subnav"
import { JsonLd, clubJsonLd } from "@/lib/seo/jsonld"
import { trackPublicView } from "@/lib/seo/track"
import { getClubProfile } from "@/lib/queries/club-profile"

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: params.slug },
    select: {
      name: true,
      description: true,
      city: true,
      state: true,
      status: true,
      branding: { select: { tagline: true } },
      _count: { select: { teams: true } },
    },
  })
  if (!tenant) return { title: "Club Not Found" }
  const place = [tenant.city, tenant.state].filter(Boolean).join(", ")
  // Min-content bar (seo-strategy §1.4, owner-decided 2026-07-12): imported
  // UNCLAIMED shells are indexable only once they carry something substantive
  // (a description or teams). Truly-empty shells stay crawlable but noindex.
  const isThinShell =
    tenant.status === "UNCLAIMED" && !tenant.description && tenant._count.teams === 0
  return {
    ...(isThinShell ? { robots: { index: false, follow: true } } : {}),
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
  const primary = branding?.primaryColor || "#1a73e8"
  const data: ClubPageData = {
    club,
    currency: club.currency,
    accent: primary,
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
      value: nextGame ? format(new Date(nextGame.scheduledAt), "MMM d") : "—",
      label: "Next game",
    },
    rating.average !== null
      ? { value: rating.average.toFixed(1), label: "Rating" }
      : { value: String(staffCount), label: "Staff" },
  ]

  return (
    <div className="font-barlow [scroll-behavior:smooth]" style={brandStyle(primary)}>
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
        {/* Richer diagonal scrim + a soft geometric accent (block-based vibe). */}
        <div className="absolute inset-0 bg-gradient-to-br from-black/25 via-black/45 to-black/80" />
        <div
          aria-hidden
          className="absolute -right-16 -top-20 h-72 w-72 rounded-full bg-white/10 blur-2xl"
        />

        <div className="container relative mx-auto px-4 pb-0 pt-10 sm:pt-14">
          <SmartBack fallback="/" fallbackLabel="Home" tone="brand" className="-ml-1 mb-2" />
          {canManage && (
            <Link
              href={`/clubs/${club.id}/customize`}
              className="brand-focus absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-lg border border-white/40 bg-white/15 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur transition hover:bg-white/25"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
                <path d="M4 20h4L18 10l-4-4L4 16v4z" strokeLinejoin="round" />
                <path d="M13.5 6.5l4 4" strokeLinecap="round" />
              </svg>
              Edit page
            </Link>
          )}

          <div className="flex flex-wrap items-end gap-5">
            {branding?.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={branding.logoUrl}
                alt={`${club.name} logo`}
                className="h-20 w-20 flex-shrink-0 rounded-2xl border-2 border-white/50 bg-white object-cover shadow-lg sm:h-28 sm:w-28"
              />
            )}
            <div className="min-w-0 flex-1">
              <h1 className="font-condensed text-4xl font-bold uppercase leading-[0.95] tracking-tight drop-shadow sm:text-6xl">
                {club.name}
              </h1>
              {branding?.tagline && (
                <p className="mt-2 max-w-2xl text-base font-medium text-white/90 drop-shadow sm:text-lg">
                  {branding.tagline}
                </p>
              )}
              {subtitle && (
                <p className="mt-1.5 inline-flex items-center gap-1.5 text-sm text-white/80">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
                    <path d="M12 21s7-5.686 7-11a7 7 0 10-14 0c0 5.314 7 11 7 11z" strokeLinejoin="round" />
                    <circle cx="12" cy="10" r="2.5" />
                  </svg>
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          {club.description && (
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/85 line-clamp-3">
              {club.description}
            </p>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            {hasBlockContent("programs", data) && (
              <a
                href="#programs"
                className="brand-focus bg-gold-400 hover:bg-gold-500 text-ink-950 cursor-pointer rounded-xl px-5 py-2.5 text-sm font-bold uppercase tracking-wide shadow-sm transition-colors"
              >
                View programs
              </a>
            )}
            <a
              href="#contact"
              className="brand-focus cursor-pointer rounded-xl border border-white/50 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur transition-colors hover:bg-white/20"
            >
              Contact
            </a>
            {club.status === "UNCLAIMED" ? (
              <Link
                href={`/claim/${club.id}`}
                className="brand-focus shadow-soft cursor-pointer rounded-xl bg-white px-5 py-2.5 text-sm font-semibold transition hover:bg-white/90"
                style={{ color: "var(--brand-ink)" }}
              >
                Claim this club
              </Link>
            ) : (
              <FollowButton
                tenantId={club.id}
                initialFollowing={initialFollowing}
                isAuthenticated={!!userId}
                variant="banner"
              />
            )}
          </div>

          {/* Quick-stats strip — bridges hero and content. */}
          <div className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-t-2xl border-x border-t border-white/15 bg-white/10 sm:grid-cols-4">
            {heroStats.map((s) => (
              <div key={s.label} className="bg-black/10 px-4 py-3 backdrop-blur">
                <div className="font-condensed text-3xl font-bold leading-none">{s.value}</div>
                <div className="mt-1 text-[11px] font-medium uppercase tracking-wide text-white/75">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
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
