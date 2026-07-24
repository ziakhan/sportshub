import { prisma } from "@youthbasketballhub/db"
import { isTestWorldSlug } from "@/lib/demo-data"

/**
 * Public clubs directory — ONE source for the web /club page and the native
 * Browse → Clubs screen (2026-07-24 drift fix, same class as the leagues
 * directory bug: two independent queries for what should be one browse
 * surface). Owns: status ACTIVE/UNCLAIMED, test-world exclusion, featured
 * carve-out, city filter, name search, and the "top cities" chip list.
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
}

export interface DirectoryCity {
  city: string
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
} as const

export async function getClubsDirectory(opts: { q?: string; city?: string } = {}): Promise<ClubsDirectoryResult> {
  const q = opts.q?.trim() || undefined
  const city = opts.city?.trim() || undefined
  const hasSearch = !!q && q.length >= 2

  const baseWhere: any = {
    status: { in: ["ACTIVE", "UNCLAIMED"] },
    ...(city ? { city: { equals: city, mode: "insensitive" } } : {}),
    ...(hasSearch ? { name: { contains: q, mode: "insensitive" } } : {}),
  }

  const [allClubsRaw, featuredRaw, citiesRaw] = await Promise.all([
    (prisma as any).tenant.findMany({
      where: baseWhere,
      select: CLUB_SELECT,
      orderBy: [{ teams: { _count: "desc" } }, { name: "asc" }],
    }),
    hasSearch
      ? Promise.resolve([])
      : (prisma as any).tenant.findMany({
          where: { ...baseWhere, isFeatured: true },
          select: CLUB_SELECT,
          orderBy: { name: "asc" },
          take: 6,
        }),
    prisma.tenant.groupBy({
      by: ["city"],
      where: { status: { in: ["ACTIVE", "UNCLAIMED"] }, city: { not: null } },
      _count: { city: true },
      orderBy: { _count: { city: "desc" } },
      take: 10,
    }),
  ])

  const allClubs = (allClubsRaw as DirectoryClub[]).filter((c) => !isTestWorldSlug(c.slug))
  const featured = (featuredRaw as DirectoryClub[]).filter((c) => !isTestWorldSlug(c.slug))
  const featuredIds = new Set(featured.map((c) => c.id))
  const clubs = allClubs.filter((c) => !featuredIds.has(c.id))
  const cities = (citiesRaw as Array<{ city: string | null; _count: { city: number } }>)
    .filter((g) => g.city)
    .map((g) => ({ city: g.city as string, count: g._count.city }))

  return { featured, clubs, cities }
}
