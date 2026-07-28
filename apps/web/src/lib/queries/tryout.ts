import { cache } from "./request-cache"
import { prisma } from "@youthbasketballhub/db"
import { ACTIVE_SIGNUPS } from "@/lib/registration/capacity"

/**
 * Public tryout detail (tenant + branding + team + venue + active signup
 * count). Shared by the public /tryout/[id] page and the native app's
 * Browse → Program detail endpoint (GET /api/mobile/browse/programs/tryout/[id])
 * — one-source doctrine sweep (2026-07-24): both used to hand-roll their own
 * near-identical `prisma.tryout.findUnique`, so a field one added (e.g. the
 * venue relation) could silently drift from the other.
 *
 * Does NOT gate on isPublished/isPublic — callers apply their own visibility
 * rule (the public page 404s on !isPublished; the mobile detail route also
 * requires isPublic; a management surface may want to read a draft). All
 * Prisma Decimals are coerced to Number so the result is JSON-safe.
 */
export const getPublicTryout = cache(async (id: string): Promise<any | null> => {
  const tryout = await prisma.tryout.findUnique({
    where: { id },
    include: {
      tenant: { include: { branding: true } },
      team: { select: { id: true, name: true, ageGroup: true, gender: true } },
      venue: { select: { id: true, name: true } },
      _count: { select: { signups: { where: ACTIVE_SIGNUPS } } },
    },
  })
  if (!tryout) return null
  return { ...tryout, fee: Number(tryout.fee) }
})
