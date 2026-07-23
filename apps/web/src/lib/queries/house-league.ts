import { cache } from "./request-cache"
import { prisma } from "@youthbasketballhub/db"
import { ACTIVE_SIGNUPS } from "@/lib/registration/capacity"

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
      venue: {
        select: { id: true, name: true },
      },
      _count: { select: { signups: { where: ACTIVE_SIGNUPS } } },
    },
  })

  if (!league) return null

  return { ...league, fee: Number(league.fee) }
})
