import { cache } from "./request-cache"
import { prisma } from "@youthbasketballhub/db"

/**
 * Public season detail (league, divisions, team submissions, counts).
 * Shared by /api/seasons/[id] GET and the public /league/[id] page.
 * All Prisma Decimals are coerced to Number so the result is JSON-safe.
 */
export const getPublicSeason = cache(async (id: string): Promise<any | null> => {
  const season = await (prisma as any).season.findUnique({
    where: { id },
    include: {
      league: {
        select: {
          id: true,
          name: true,
          description: true,
          ownerId: true,
          perks: true,
          perksNote: true,
          // Additive (native league/season screen rebuild, 2026-07-25) — the
          // web page's branded hero fetches these via a second query; folding
          // them in here means the mobile route (the other caller) gets them
          // for free with no shape change for existing fields.
          logoUrl: true,
          bannerUrl: true,
          tagline: true,
          primaryColor: true,
          socials: true,
        },
      },
      divisions: { orderBy: { ageGroup: "asc" } },
      teamSubmissions: {
        include: {
          team: {
            select: {
              id: true,
              name: true,
              ageGroup: true,
              gender: true,
              tenant: { select: { id: true, name: true, slug: true } },
            },
          },
          division: { select: { id: true, name: true } },
        },
      },
      _count: { select: { teamSubmissions: true, games: true, sessions: true } },
    },
  })

  if (!season) return null

  return {
    ...season,
    teamFee: season.teamFee ? Number(season.teamFee) : null,
    teamSubmissions: season.teamSubmissions.map((t: any) => ({
      ...t,
      registrationFee: t.registrationFee ? Number(t.registrationFee) : null,
    })),
  }
})
