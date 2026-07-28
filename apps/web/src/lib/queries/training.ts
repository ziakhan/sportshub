import { cache } from "./request-cache"
import { prisma } from "@youthbasketballhub/db"
import { ACTIVE_SIGNUPS } from "@/lib/registration/capacity"

/**
 * Published training-session detail (tenant + branding + venue + active
 * signup count). Shared by the public /training/[id] page and the native
 * app's Browse → Program detail endpoint
 * (GET /api/mobile/browse/programs/training/[id]) — one-source doctrine
 * sweep (2026-07-24): both used to hand-roll their own
 * `prisma.trainingSession.findFirst({ isPublished: true })`.
 *
 * Unlike getPublicTryout/getPublicCamp this DOES gate on `isPublished` —
 * that was every existing caller's behavior already, so keeping it inside
 * the module (rather than pushed to call sites) removes one more place the
 * two surfaces could disagree. All Prisma Decimals are coerced to Number.
 */
export const getPublicTraining = cache(async (id: string): Promise<any | null> => {
  const session = await (prisma as any).trainingSession.findFirst({
    where: { id, isPublished: true },
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
      venue: { select: { id: true, name: true } },
      _count: { select: { signups: { where: ACTIVE_SIGNUPS } } },
    },
  })
  if (!session) return null
  return { ...session, fee: Number(session.fee) }
})
