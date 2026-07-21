// In-flow waiver signing (owner ruling 2026-07-20): club waivers are signed at
// the transaction moment — accepting a team offer, or registering for a camp /
// house league / tryout. No separate signing moment. The flow's API returns
// 409 WAIVERS_REQUIRED with the outstanding documents; the client shows the
// signing gate, posts to /api/waivers/sign-inline, then retries.

import { prisma } from "@youthbasketballhub/db"

export interface OutstandingWaiver {
  id: string
  title: string
  body: string
  type: string
  version: number
  annualRenewal: boolean
}

/**
 * The club's active REQUIRED waivers that this player has no valid
 * current-version signature for. Empty array = nothing blocks.
 */
export async function getOutstandingRequiredWaivers({
  tenantId,
  playerId,
}: {
  tenantId: string
  playerId: string
}): Promise<OutstandingWaiver[]> {
  const waivers = await (prisma as any).waiverDocument.findMany({
    where: { tenantId, active: true, required: true },
    select: {
      id: true,
      title: true,
      body: true,
      type: true,
      version: true,
      annualRenewal: true,
    },
    orderBy: { createdAt: "asc" },
  })
  if (waivers.length === 0) return []

  const signatures = await (prisma as any).waiverSignature.findMany({
    where: {
      playerId,
      waiverId: { in: waivers.map((w: any) => w.id) },
      OR: [{ validUntil: null }, { validUntil: { gt: new Date() } }],
    },
    select: { waiverId: true, waiverVersion: true },
  })
  const signed = new Set(
    signatures
      .filter((s: any) => {
        const w = waivers.find((w: any) => w.id === s.waiverId)
        return w && s.waiverVersion === w.version
      })
      .map((s: any) => s.waiverId)
  )
  return waivers.filter((w: any) => !signed.has(w.id))
}

/**
 * Standard 409 payload for flows blocked on unsigned waivers. The client
 * recognizes `code` and opens the signing gate with `waivers`.
 */
export function waiversRequiredResponse(waivers: OutstandingWaiver[]) {
  return {
    error: "A parent or guardian needs to sign the club's participation documents first.",
    code: "WAIVERS_REQUIRED",
    waivers,
  }
}
