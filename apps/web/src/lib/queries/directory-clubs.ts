import { prisma } from "@youthbasketballhub/db"
import { isTestWorldSlug } from "@/lib/demo-data"
import { getClubRatings, type ClubRating } from "@/lib/queries/club-ratings"

/**
 * Public clubs directory — ONE source for the web /club page and the native
 * Browse → Clubs screen (2026-07-24 drift fix, same class as the leagues
 * directory bug: two independent queries for what should be one browse
 * surface). Owns: status ACTIVE/UNCLAIMED, test-world exclusion, featured
 * carve-out, city filter, name search, the "top cities" chip list, and
 * (additive, 2026-07-24 five-tab parity pass) each club's published-review
 * rating — the web page used to call getClubRatings separately; folding it
 * in here means the native clubs screen gets the SAME star ratings for free
 * instead of hand-rolling its own groupBy.
 */

export interface DirectoryClub {
  id: string
  slug: string
  name: string
  city: string | null
  state: string | null
  status: string
  isFeatured: boolean
  description: string | null
  branding: { primaryColor: string | null; logoUrl: string | null } | null
  _count: { teams: number; tryouts: number }
  latitude?: number | null
  longitude?: number | null
  region?: string | null
  /** Present only when the caller supplied `near`. */
  distanceKm?: number
  /** Published-review rating — undefined when the club has no reviews yet. */
  rating?: ClubRating
}

export interface DirectoryCity {
  city: string
  count: number
}

export interface DirectoryRegion {
  region: string
  count: number
}

export interface ClubsDirectoryResult {
  /** Up to 6 featured clubs (empty when a search query is active — a search
   *  result set is a flat list, not a featured/regular split). */
  featured: DirectoryClub[]
  /** Every matching club NOT already in `featured`. */
  clubs: DirectoryClub[]
  /** Top 10 cities by club count — independent of the `q`/`city` filters
   *  (it's the "near me" entry point, always showing the full map). */
  cities: DirectoryCity[]
  /** Governing-body regions ("Durham-York"), the tier above city. */
  regions: DirectoryRegion[]
}

const CLUB_SELECT = {
  id: true,
  slug: true,
  name: true,
  city: true,
  state: true,
  status: true,
  isFeatured: true,
  description: true,
  branding: { select: { primaryColor: true, logoUrl: true } },
  _count: { select: { teams: true, tryouts: true } },
  latitude: true,
  longitude: true,
  region: true,
} as const

/** Great-circle distance in km. */
function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371
  const dLat = ((bLat - aLat) * Math.PI) / 180
  const dLon = ((bLon - aLon) * Math.PI) / 180
  const la1 = (aLat * Math.PI) / 180
  const la2 = (bLat * Math.PI) / 180
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(la1) * Math.cos(la2)
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

/**
 * Latitude/longitude window that contains everything within `radiusKm`.
 *
 * Used as a cheap index-backed prefilter before the exact distance maths, so
 * the database never scans clubs on the other side of the country. The longitude
 * degree shrinks toward the poles, hence the cos(lat) term; it is clamped
 * because near the poles the window would otherwise blow up to the whole globe.
 */
function boundingBox(lat: number, lon: number, radiusKm: number) {
  const dLat = radiusKm / 111.32
  const cos = Math.cos((lat * Math.PI) / 180)
  const dLon = radiusKm / (111.32 * Math.max(0.01, Math.abs(cos)))
  return {
    minLat: lat - dLat,
    maxLat: lat + dLat,
    minLon: lon - dLon,
    maxLon: lon + dLon,
  }
}

/** Clubs the public may see: published, not merged away, not suspended. */
export const PUBLIC_CLUB_WHERE = {
  status: { in: ["ACTIVE", "UNCLAIMED"] },
  publishedAt: { not: null },
  mergedIntoId: null,
} as const

export async function getClubsDirectory(
  opts: {
    q?: string
    city?: string
    region?: string
    province?: string
    /** Sort by distance from here and drop anything beyond radiusKm. */
    near?: { lat: number; lng: number; radiusKm?: number }
    /** Cap the returned list. Defaults to 60 — see note below. */
    limit?: number
  } = {}
): Promise<ClubsDirectoryResult> {
  const q = opts.q?.trim() || undefined
  const city = opts.city?.trim() || undefined
  const region = opts.region?.trim() || undefined
  const province = opts.province?.trim() || undefined
  const hasSearch = !!q && q.length >= 2
  const near = opts.near
  const radiusKm = near?.radiusKm ?? 50
  // The census import took the published directory from ~150 clubs to ~1,550.
  // Returning all of them would ship a multi-megabyte page, so the list is
  // capped; callers that need more pass an explicit limit.
  const limit = Math.min(Math.max(opts.limit ?? 60, 1), 500)

  const box = near ? boundingBox(near.lat, near.lng, radiusKm) : null

  const baseWhere: any = {
    ...PUBLIC_CLUB_WHERE,
    ...(city ? { city: { equals: city, mode: "insensitive" } } : {}),
    ...(region ? { region: { equals: region, mode: "insensitive" } } : {}),
    ...(province ? { state: { equals: province, mode: "insensitive" } } : {}),
    // A club is searched for by whatever name people call it. Mississauga Minor
    // Basketball answers to "Monarchs", so the alias list has to match too.
    ...(hasSearch
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { searchAliases: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(box
      ? {
          latitude: { gte: box.minLat, lte: box.maxLat },
          longitude: { gte: box.minLon, lte: box.maxLon },
        }
      : {}),
  }

  const [allClubsRaw, featuredRaw, citiesRaw, regionsRaw] = await Promise.all([
    (prisma as any).tenant.findMany({
      where: baseWhere,
      select: CLUB_SELECT,
      orderBy: [{ teams: { _count: "desc" } }, { name: "asc" }],
      // Distance sorting has to see every club inside the box before it can
      // rank them, so the cap is applied after sorting in that mode.
      take: near ? 500 : limit * 3,
    }),
    hasSearch || near
      ? Promise.resolve([])
      : (prisma as any).tenant.findMany({
          where: { ...baseWhere, isFeatured: true },
          select: CLUB_SELECT,
          orderBy: { name: "asc" },
          take: 6,
        }),
    prisma.tenant.groupBy({
      by: ["city"],
      where: { ...PUBLIC_CLUB_WHERE, city: { not: null } } as any,
      _count: { city: true },
      orderBy: { _count: { city: "desc" } },
      take: 10,
    }),
    prisma.tenant.groupBy({
      by: ["region"],
      where: { ...PUBLIC_CLUB_WHERE, region: { not: null } } as any,
      _count: { region: true },
      orderBy: { _count: { region: "desc" } },
      take: 12,
    }),
  ])

  let allClubs = (allClubsRaw as DirectoryClub[]).filter((c) => !isTestWorldSlug(c.slug))

  if (near) {
    // Exact distance on the boxed set, then drop the box's corners: a bounding
    // box is a square around a circle, so without this clubs up to ~41% beyond
    // the radius would slip through at the diagonals.
    allClubs = allClubs
      .map((c) => ({
        c,
        d:
          c.latitude != null && c.longitude != null
            ? haversineKm(near.lat, near.lng, c.latitude, c.longitude)
            : Number.POSITIVE_INFINITY,
      }))
      .filter((x) => x.d <= radiusKm)
      .sort((a, b) => a.d - b.d)
      .map((x) => {
        x.c.distanceKm = Math.round(x.d * 10) / 10
        return x.c
      })
  }

  allClubs = allClubs.slice(0, limit)

  const featured = (featuredRaw as DirectoryClub[]).filter((c) => !isTestWorldSlug(c.slug))
  const featuredIds = new Set(featured.map((c) => c.id))
  const clubs = allClubs.filter((c) => !featuredIds.has(c.id))
  const cities = (citiesRaw as Array<{ city: string | null; _count: { city: number } }>)
    .filter((g) => g.city)
    .map((g) => ({ city: g.city as string, count: g._count.city }))
  const regions = (regionsRaw as Array<{ region: string | null; _count: { region: number } }>)
    .filter((g) => g.region)
    .map((g) => ({ region: g.region as string, count: g._count.region }))

  const ratings = await getClubRatings([...featured, ...clubs].map((c) => c.id))
  for (const c of featured) c.rating = ratings.get(c.id)
  for (const c of clubs) c.rating = ratings.get(c.id)

  return { featured, clubs, cities, regions }
}
