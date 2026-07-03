import { cache } from "react"
import { prisma } from "@youthbasketballhub/db"

/**
 * Public camp detail (tenant + signup count).
 * Shared by /api/camps/[id] GET and the public /camp/[id] page.
 * All Prisma Decimals are coerced to Number so the result is JSON-safe.
 */
export const getPublicCamp = cache(async (id: string): Promise<any | null> => {
  const camp = await (prisma as any).camp.findUnique({
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

  if (!camp) return null

  return {
    ...camp,
    weeklyFee: Number(camp.weeklyFee),
    fullCampFee: camp.fullCampFee ? Number(camp.fullCampFee) : null,
  }
})
