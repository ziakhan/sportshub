import { addAcceptedPlayerToTeam } from "@/lib/teams/roster-entry"

/**
 * Age-group pool domain helpers (docs/roadmap/club-tryouts-and-age-pools).
 *
 * The pool is keyed on (club, season, age group). Offer state and team
 * assignment are ORTHOGONAL (owner ruling 2026-08-20): a member can be placed
 * on a team before, after, or without an offer, so nothing here derives one
 * from the other. Offer state is read from the Offer table rather than stored
 * on the member, which is why every read goes through `poolOfferIndex`.
 */

export type PoolOfferState = "none" | "PENDING" | "ACCEPTED" | "DECLINED" | "EXPIRED"

export interface PoolOffer {
  id: string
  status: PoolOfferState
  seasonFee: number
  expiresAt: Date
  respondedAt: Date | null
  templateId: string | null
  uniformSize: string | null
  shoeSize: string | null
  tracksuitSize: string | null
}

export function offerKey(ageGroup: string, playerId: string): string {
  return `${ageGroup}::${playerId}`
}

/** A PENDING offer past its expiry reads as EXPIRED without a write. */
function readStatus(offer: { status: string; expiresAt: Date }): PoolOfferState {
  if (offer.status === "PENDING" && offer.expiresAt.getTime() < Date.now()) return "EXPIRED"
  return offer.status as PoolOfferState
}

/**
 * The club's teamless age-group offers for these players, most recent per
 * (age group, player). Team offers are deliberately excluded: a pool offer is
 * the age-group program, and a team offer is a different commitment.
 */
export async function poolOfferIndex(
  db: any,
  input: { tenantId: string; playerIds: string[]; ageGroups?: string[] }
): Promise<Map<string, PoolOffer>> {
  if (input.playerIds.length === 0) return new Map()
  const offers = await db.offer.findMany({
    where: {
      teamId: null,
      tenantId: input.tenantId,
      playerId: { in: input.playerIds },
      ...(input.ageGroups?.length ? { ageGroup: { in: input.ageGroups } } : {}),
    },
    select: {
      id: true,
      playerId: true,
      ageGroup: true,
      status: true,
      seasonFee: true,
      expiresAt: true,
      respondedAt: true,
      templateId: true,
      uniformSize: true,
      shoeSize: true,
      tracksuitSize: true,
    },
    orderBy: { createdAt: "desc" },
  })
  const index = new Map<string, PoolOffer>()
  for (const offer of offers) {
    if (!offer.ageGroup) continue
    const key = offerKey(offer.ageGroup, offer.playerId)
    if (index.has(key)) continue // findMany is newest-first, so the first wins
    index.set(key, {
      id: offer.id,
      status: readStatus(offer),
      seasonFee: Number(offer.seasonFee),
      expiresAt: offer.expiresAt,
      respondedAt: offer.respondedAt,
      templateId: offer.templateId,
      uniformSize: offer.uniformSize,
      shoeSize: offer.shoeSize,
      tracksuitSize: offer.tracksuitSize,
    })
  }
  return index
}

export interface PoolSyncResult {
  created: number
  skipped: number
  ageGroups: string[]
}

/**
 * Fill the pool from an event's sessions: every non-cancelled signup that
 * carries a real player becomes a member of the pool for (event.seasonLabel,
 * session.ageGroup). Idempotent — the unique key absorbs re-runs, and a signup
 * with no linked player profile is counted as skipped rather than guessed at.
 */
export async function syncPoolFromEvent(
  db: any,
  event: { id: string; tenantId: string; seasonLabel: string }
): Promise<PoolSyncResult> {
  const signups = await db.tryoutSignup.findMany({
    where: {
      tryout: { eventId: event.id },
      status: { not: "CANCELLED" },
    },
    select: { id: true, playerId: true, tryout: { select: { ageGroup: true } } },
  })

  const candidates: Array<{ ageGroup: string; playerId: string; signupId: string }> = []
  const seen = new Set<string>()
  let skipped = 0
  for (const signup of signups) {
    if (!signup.playerId) {
      skipped += 1
      continue
    }
    const key = offerKey(signup.tryout.ageGroup, signup.playerId)
    if (seen.has(key)) {
      skipped += 1
      continue
    }
    seen.add(key)
    candidates.push({
      ageGroup: signup.tryout.ageGroup,
      playerId: signup.playerId,
      signupId: signup.id,
    })
  }

  if (candidates.length === 0) {
    return { created: 0, skipped, ageGroups: [] }
  }

  const result = await db.tryoutPoolMember.createMany({
    data: candidates.map((c) => ({
      tenantId: event.tenantId,
      seasonLabel: event.seasonLabel,
      ageGroup: c.ageGroup,
      playerId: c.playerId,
      signupId: c.signupId,
    })),
    skipDuplicates: true,
  })

  return {
    created: result.count,
    skipped: skipped + (candidates.length - result.count),
    ageGroups: [...new Set(candidates.map((c) => c.ageGroup))].sort(),
  }
}

/**
 * Put an assigned member on the team roster when their age-group offer is
 * already accepted. Assignment without an accepted offer stays a pool-only
 * placement: the roster spot follows the money, never the intention.
 */
export async function rosterOnAssignment(
  tx: any,
  input: { teamId: string; playerId: string; offer: PoolOffer | undefined }
): Promise<boolean> {
  if (!input.offer || input.offer.status !== "ACCEPTED") return false
  await addAcceptedPlayerToTeam(tx, {
    teamId: input.teamId,
    playerId: input.playerId,
    uniformSize: input.offer.uniformSize,
    shoeSize: input.offer.shoeSize,
    tracksuitSize: input.offer.tracksuitSize,
  })
  return true
}
