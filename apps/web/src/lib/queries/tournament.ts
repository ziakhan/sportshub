import { cache } from "react"
import { prisma } from "@youthbasketballhub/db"

/**
 * Public tournament detail (divisions, registered teams, counts).
 * Shared by /api/tournaments/[id] GET and the public /tournament/[id] page.
 * All Prisma Decimals are coerced to Number so the result is JSON-safe.
 */
export const getPublicTournament = cache(async (id: string): Promise<any | null> => {
  const tournament = await (prisma as any).tournament.findUnique({
    where: { id },
    include: {
      divisions: { orderBy: { ageGroup: "asc" } },
      teams: {
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
      _count: { select: { teams: true } },
    },
  })

  if (!tournament) return null

  return {
    ...tournament,
    teamFee: tournament.teamFee ? Number(tournament.teamFee) : null,
    teams: tournament.teams.map((t: any) => ({
      ...t,
      registrationFee: t.registrationFee ? Number(t.registrationFee) : null,
    })),
  }
})
