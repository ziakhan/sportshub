import Link from "next/link"
import { prisma } from "@youthbasketballhub/db"
import { isTestWorldSlug } from "@/lib/demo-data"
import { getClubRatings, type ClubRating } from "@/lib/queries/club-ratings"
import { StarRating } from "@/components/ui"
import { ClubSearch } from "../club-search"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Find a Basketball Club - Youth Basketball Hub",
  description: "Discover youth basketball clubs near you, rated by real families.",
}

interface DirectoryClub {
  id: string
  slug: string
  name: string
  city: string | null
  state: string | null
  status: string
  isFeatured: boolean
  branding: { primaryColor: string | null } | null
  _count: { teams: number; tryouts: number }
}

const CLUB_SELECT = {
  id: true,
  slug: true,
  name: true,
  city: true,
  state: true,
  status: true,
  isFeatured: true,
  branding: { select: { primaryColor: true } },
  _count: { select: { teams: true, tryouts: true } },
} as const

/** Browseable directory (audit GAP-024): search on top, but never a blank
 *  page — the most active clubs render immediately, filterable by city. */
async function getDirectoryClubs(city?: string): Promise<DirectoryClub[]> {
  const clubs = await (prisma as any).tenant.findMany({
    where: {
      status: { in: ["ACTIVE", "UNCLAIMED"] },
      ...(city ? { city: { equals: city, mode: "insensitive" } } : {}),
    },
    select: CLUB_SELECT,
    orderBy: [{ teams: { _count: "desc" } }, { name: "asc" }],
    take: 140,
  })
  return clubs.filter((c: DirectoryClub) => !isTestWorldSlug(c.slug)).slice(0, 36)
}

async function getFeaturedClubs(city?: string): Promise<DirectoryClub[]> {
  const clubs = await (prisma as any).tenant.findMany({
    where: {
      isFeatured: true,
      status: { in: ["ACTIVE", "UNCLAIMED"] },
      ...(city ? { city: { equals: city, mode: "insensitive" } } : {}),
    },
    select: CLUB_SELECT,
    orderBy: { name: "asc" },
    take: 6,
  })
  return clubs.filter((c: DirectoryClub) => !isTestWorldSlug(c.slug))
}

/** Top cities by club count — the "near me" entry point. */
async function getTopCities(): Promise<{ city: string; count: number }[]> {
  const grouped = await prisma.tenant.groupBy({
    by: ["city"],
    where: { status: { in: ["ACTIVE", "UNCLAIMED"] }, city: { not: null } },
    _count: { city: true },
    orderBy: { _count: { city: "desc" } },
    take: 10,
  })
  return grouped
    .filter((g: (typeof grouped)[number]) => g.city)
    .map((g: (typeof grouped)[number]) => ({ city: g.city as string, count: g._count.city }))
}

function ClubCard({
  club,
  rating,
  featured = false,
}: {
  club: DirectoryClub
  rating?: ClubRating
  featured?: boolean
}) {
  return (
    <Link
      href={`/club/${club.slug}`}
      className={`card-lift shadow-soft group flex items-center gap-4 rounded-2xl border bg-white p-4 ${
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
  )
}

export default async function ClubDirectoryPage({
  searchParams,
}: {
  searchParams: { city?: string }
}) {
  const city = searchParams.city?.trim() || undefined
  const [clubs, featuredClubs, cities] = await Promise.all([
    getDirectoryClubs(city),
    getFeaturedClubs(city),
    getTopCities(),
  ])

  const featuredIds = new Set(featuredClubs.map((c) => c.id))
  const regularClubs = clubs.filter((c) => !featuredIds.has(c.id))
  const ratings = await getClubRatings([...featuredClubs, ...regularClubs].map((c) => c.id))

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
              <ClubCard key={club.id} club={club} rating={ratings.get(club.id)} featured />
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
              <ClubCard key={club.id} club={club} rating={ratings.get(club.id)} />
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
