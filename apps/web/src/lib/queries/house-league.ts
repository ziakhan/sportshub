import { cache } from "react"
import { prisma } from "@youthbasketballhub/db"

/**
 * Public house league detail (tenant + signup count).
 * Shared by /api/house-leagues/[id] GET and the public /house-league/[id] page.
 * All Prisma Decimals are coerced to Number so the result is JSON-safe.
 */
export const getPublicHouseLeague = cache(async (id: string): Promise<any | null> => {
  const league = await (prisma as any).houseLeague.findUnique({
    where: { id },
    include: {
      tenant: {
        select: {
          id: true,
          name: true,
          slug: true,
          currency: true,
          branding: { select: { primaryColor: true } },
        },
      },
      _count: { select: { signups: true } },
    },
  })

  if (!league) return null

  return { ...league, fee: Number(league.fee) }
})
