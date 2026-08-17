import Link from "next/link"
import { getServerSession } from "next-auth"
import { prisma } from "@youthbasketballhub/db"
import { authOptions } from "@/lib/auth"
import type { ClubRating } from "@/lib/queries/club-ratings"
import {
  getClubsDirectory,
  PUBLIC_CLUB_WHERE,
  type DirectoryClub,
} from "@/lib/queries/directory-clubs"
import { PUBLIC_REVIEWS } from "@/lib/public-flags"
import { Crest, PageBand, StarRating } from "@/components/ui"
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
      <Crest name={club.name} size="md" className="h-11 w-11 text-sm" />
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
        {PUBLIC_REVIEWS && rating && (
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

const PROVINCE_NAMES: Record<string, string> = {
  ON: "Ontario",
  BC: "British Columbia",
  AB: "Alberta",
  QC: "Quebec",
  MB: "Manitoba",
  SK: "Saskatchewan",
  NS: "Nova Scotia",
  NB: "New Brunswick",
  NL: "Newfoundland and Labrador",
  PE: "Prince Edward Island",
  YT: "Yukon",
  NT: "Northwest Territories",
  NU: "Nunavut",
}

/** The GTA pin list (owner 2026-08-17: "Ontario, especially the GTA, should
 *  be the highest priority and easiest to find"). Matched case-insensitively
 *  against census city names. */
const GTA_CITIES = new Set([
  "toronto",
  "mississauga",
  "brampton",
  "vaughan",
  "markham",
  "richmond hill",
  "oakville",
  "burlington",
  "milton",
  "ajax",
  "pickering",
  "whitby",
  "oshawa",
  "scarborough",
  "north york",
  "etobicoke",
  "newmarket",
  "aurora",
])

function chipClass(active: boolean): string {
  return `rounded-full px-3 py-1.5 text-xs font-semibold transition ${
    active ? "bg-play-600 text-white" : "bg-white text-ink-700 ring-1 ring-ink-200 hover:bg-ink-50"
  }`
}

export default async function ClubDirectoryPage({
  searchParams,
}: {
  searchParams: { city?: string; prov?: string }
}) {
  const city = searchParams.city?.trim() || undefined
  const prov = searchParams.prov?.trim().toUpperCase() || undefined
  const { featured: featuredClubs, clubs: regularClubs } = await getClubsDirectory({
    city,
    province: prov,
  })

  // Chip data: every (province, city) pair with counts, on the same public
  // gating as the directory itself. Display-shaping for this page; folds into
  // directory-clubs.ts when the lifecycle round lands there.
  const cityGroups = (
    (await (prisma as any).tenant.groupBy({
      by: ["state", "city"],
      where: { ...PUBLIC_CLUB_WHERE, city: { not: null }, state: { not: null } },
      _count: true,
    })) as Array<{ state: string; city: string; _count: number }>
  ).map((g) => ({ state: g.state.toUpperCase(), city: g.city, count: g._count }))
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

  // Province row: Ontario pinned first, the rest by club count.
  const provinceCounts = new Map<string, number>()
  for (const g of cityGroups) {
    provinceCounts.set(g.state, (provinceCounts.get(g.state) ?? 0) + g.count)
  }
  const provinces = [...provinceCounts.entries()].sort((a, b) =>
    a[0] === "ON" ? -1 : b[0] === "ON" ? 1 : b[1] - a[1]
  )

  // City rows follow the scoped province: the selected one, the selected
  // city's own, or Ontario by default (the priority market).
  const scope =
    prov ??
    (city
      ? (cityGroups.find((g) => g.city.toLowerCase() === city.toLowerCase())?.state ?? "ON")
      : "ON")
  // Census litter guard: rows where the "city" is really a province name or
  // carries a trailing province code ("Toronto ON") stay out of the chip rows
  // until the import normalizes them. Cards still show what the club says.
  const badCity = (name: string) => {
    const n = name.trim().toLowerCase()
    return (
      Object.values(PROVINCE_NAMES).some((p) => p.toLowerCase() === n) ||
      /\s(on|bc|ab|qc|mb|sk|ns|nb|nl|pe|yt|nt|nu)$/.test(n)
    )
  }
  const scopedCities = cityGroups
    .filter((g) => g.state === scope && !badCity(g.city))
    .sort((a, b) => b.count - a.count)
  const gtaCities =
    scope === "ON" ? scopedCities.filter((g) => GTA_CITIES.has(g.city.toLowerCase())).slice(0, 10) : []
  const gtaNames = new Set(gtaCities.map((g) => g.city))
  const restCities = scopedCities.filter((g) => !gtaNames.has(g.city)).slice(0, 8)

  return (
    <>
      <PageBand
        align="center"
        eyebrow="Clubs"
        title="Find a Basketball Club"
        description="Clubs near you. Search by name or city, or browse below."
      >
        <ClubSearch />

        {/* Browse chips, two labelled levels (owner 2026-08-17): provinces on
            one row with Ontario pinned first, then the cities of the scoped
            province with the GTA pinned on its own row. Never mixed. */}
        <div className="mt-6 space-y-3">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="text-ink-500 text-[12px] font-bold uppercase tracking-[0.14em]">
              Province
            </span>
            <Link href="/club" className={chipClass(!prov && !city)}>
              All Canada
            </Link>
            {provinces.map(([code, count]) => (
              <Link
                key={code}
                href={prov === code ? "/club" : `/club?prov=${encodeURIComponent(code)}`}
                className={chipClass(prov === code)}
              >
                {PROVINCE_NAMES[code] ?? code}
                <span className={prov === code ? "ml-1.5 text-white/70" : "text-ink-400 ml-1.5"}>
                  {count}
                </span>
              </Link>
            ))}
          </div>

          {gtaCities.length > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-2">
              <span className="text-ink-500 text-[12px] font-bold uppercase tracking-[0.14em]">
                Greater Toronto
              </span>
              {gtaCities.map((g) => {
                const active = city?.toLowerCase() === g.city.toLowerCase()
                return (
                  <Link
                    key={`${g.state}-${g.city}`}
                    href={active ? "/club" : `/club?city=${encodeURIComponent(g.city)}`}
                    className={chipClass(active)}
                  >
                    {g.city}
                  </Link>
                )
              })}
            </div>
          )}

          {restCities.length > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-2">
              <span className="text-ink-500 text-[12px] font-bold uppercase tracking-[0.14em]">
                {scope === "ON" ? "More Ontario" : (PROVINCE_NAMES[scope] ?? scope)}
              </span>
              {restCities.map((g) => {
                const active = city?.toLowerCase() === g.city.toLowerCase()
                return (
                  <Link
                    key={`${g.state}-${g.city}`}
                    href={active ? "/club" : `/club?city=${encodeURIComponent(g.city)}`}
                    className={chipClass(active)}
                  >
                    {g.city}
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </PageBand>

      <div className="container mx-auto px-4 pb-12 pt-2">
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
            {city
              ? `Clubs in ${city}`
              : prov
                ? `Clubs in ${PROVINCE_NAMES[prov] ?? prov}`
                : "Top clubs"}
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
              No clubs listed
              {city ? ` in ${city}` : prov ? ` in ${PROVINCE_NAMES[prov] ?? prov}` : ""} yet.
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
    </>
  )
}
