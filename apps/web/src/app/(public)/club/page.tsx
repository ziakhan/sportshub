import Link from "next/link"
import { getServerSession } from "next-auth"
import { prisma } from "@youthbasketballhub/db"
import { authOptions } from "@/lib/auth"
import type { ClubRating } from "@/lib/queries/club-ratings"
import { getClubsDirectory, type DirectoryClub } from "@/lib/queries/directory-clubs"
import { StarRating } from "@/components/ui"
import { FollowButton } from "@/components/follow-button"
import { ClubSearch } from "../club-search"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Find a Youth Basketball Club Near You",
  alternates: { canonical: "/club" },
  description: "Discover youth basketball clubs near you, rated by real families.",
}

function ClubCard({
  club,
  rating,
  featured = false,
  following = false,
  isAuthenticated = false,
}: {
  club: DirectoryClub
  rating?: ClubRating
  featured?: boolean
  following?: boolean
  isAuthenticated?: boolean
}) {
  return (
    <div className="relative">
      <div className="absolute right-3 top-3 z-10">
        <FollowButton tenantId={club.id} initialFollowing={following} isAuthenticated={isAuthenticated} compact />
      </div>
    <Link
      href={`/club/${club.slug}`}
      className={`card-lift shadow-soft group flex items-center gap-4 rounded-2xl border bg-white p-4 pr-12 ${
        featured ? "border-gold-400 ring-gold-100 ring-2" : "border-ink-100"
      }`}
    >
      <span
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
        style={{ backgroundColor: club.branding?.primaryColor || "#4f46e5" }}
      >
        {club.name.slice(0, 1)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="text-ink-950 group-hover:text-play-600 truncate font-semibold transition-colors">
            {club.name}
          </span>
          {featured && (
            <span className="bg-gold-100 text-gold-600 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
              Featured
            </span>
          )}
        </span>
        {rating && (
          <span className="block">
            <StarRating rating={rating.average} count={rating.count} />
          </span>
        )}
        <span className="text-ink-500 block truncate text-xs">
          {[club.city, club.state].filter(Boolean).join(", ") || "Ontario"}
          {club._count.teams > 0 && ` · ${club._count.teams} teams`}
          {club._count.tryouts > 0 && ` · ${club._count.tryouts} tryouts`}
        </span>
      </span>
      {club.status === "UNCLAIMED" && (
        <span className="bg-ink-50 text-ink-500 ring-ink-200 shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ring-1">
          Open profile
        </span>
      )}
    </Link>
    </div>
  )
}

export default async function ClubDirectoryPage({
  searchParams,
}: {
  searchParams: { city?: string }
}) {
  const city = searchParams.city?.trim() || undefined
  const { featured: featuredClubs, clubs: regularClubs, cities } = await getClubsDirectory({ city })
  const ratings = new Map<string, ClubRating>(
    [...featuredClubs, ...regularClubs].flatMap((c) => (c.rating ? [[c.id, c.rating] as const] : []))
  )

  // Follow (favorite) state per club for the signed-in viewer
  const session = await getServerSession(authOptions).catch(() => null)
  const viewerId = (session?.user as any)?.id ?? null
  const followedClubs = new Set<string>(
    viewerId
      ? (
          await (prisma as any).follow.findMany({
            where: { userId: viewerId, tenantId: { not: null } },
            select: { tenantId: true },
          })
        ).map((f: any) => f.tenantId)
      : []
  )

  // Rated clubs first within the grid — "ranked by rating" without hiding
  // unrated clubs below a fold of empty stars.
  const sortedRegular = [...regularClubs].sort((a, b) => {
    const ra = ratings.get(a.id)
    const rb = ratings.get(b.id)
    if (!!ra !== !!rb) return ra ? -1 : 1
    if (ra && rb && rb.average !== ra.average) return rb.average - ra.average
    return 0 // keep most-active order within ties
  })

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-ink-950 mb-2">
          Find a Basketball Club
        </h1>
        <p className="text-ink-600 max-w-xl mx-auto">
          Clubs near you, rated by real families. Search by name or city — or
          browse below.
        </p>
      </div>
      <ClubSearch />

      {/* Near me: city pills */}
      {cities.length > 1 && (
        <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
          <Link
            href="/club"
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              !city ? "bg-play-600 text-white" : "bg-ink-100 text-ink-700 hover:bg-ink-200"
            }`}
          >
            All cities
          </Link>
          {cities.map((c) => {
            const active = city?.toLowerCase() === c.city.toLowerCase()
            return (
              <Link
                key={c.city}
                href={active ? "/club" : `/club?city=${encodeURIComponent(c.city)}`}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  active ? "bg-play-600 text-white" : "bg-ink-100 text-ink-700 hover:bg-ink-200"
                }`}
              >
                {c.city}
              </Link>
            )
          })}
        </div>
      )}

      {featuredClubs.length > 0 && (
        <div className="mt-10">
          <h2 className="text-gold-600 mb-4 text-xs font-bold uppercase tracking-[0.16em]">
            Featured clubs
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featuredClubs.map((club) => (
              <ClubCard key={club.id} club={club} rating={ratings.get(club.id)} featured following={followedClubs.has(club.id)} isAuthenticated={!!viewerId} />
            ))}
          </div>
        </div>
      )}

      {sortedRegular.length > 0 ? (
        <div className="mt-10">
          <h2 className="text-ink-400 mb-4 text-xs font-bold uppercase tracking-[0.16em]">
            {city ? `Clubs in ${city}` : "Top clubs"}
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sortedRegular.map((club) => (
              <ClubCard key={club.id} club={club} rating={ratings.get(club.id)} following={followedClubs.has(club.id)} isAuthenticated={!!viewerId} />
            ))}
          </div>
        </div>
      ) : (
        featuredClubs.length === 0 && (
          <div className="border-ink-200 mt-10 rounded-2xl border border-dashed bg-white p-10 text-center">
            <p className="text-ink-600">
              No clubs listed{city ? ` in ${city}` : ""} yet.
              {city && (
                <>
                  {" "}
                  <Link href="/club" className="text-play-600 font-semibold hover:underline">
                    Browse all cities
                  </Link>
                </>
              )}
            </p>
          </div>
        )
      )}
    </div>
  )
}
