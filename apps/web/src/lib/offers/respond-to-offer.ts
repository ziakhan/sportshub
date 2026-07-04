import { prisma } from "@youthbasketballhub/db"
import { notify } from "@/lib/notifications"
import { ensureObligation } from "@/lib/payments/obligations"

/**
 * Offer response domain service — accept/decline with roster formation.
 *
 * Extracted from the offers/[id] route handler: this is core business logic
 * (gear validation conditioned on what the offer includes, roster upsert,
 * club notification, all atomic). The route stays a thin HTTP adapter.
 */

export interface OfferForResponse {
  id: string
  teamId: string
  playerId: string
  seasonFee: unknown // Prisma Decimal
  installments: number
  includesUniform: boolean
  includesShoes: boolean
  includesTracksuit: boolean
  player: { id: string; parentId: string; firstName: string; lastName: string }
  team: { id: string; name: string; tenantId: string; tenant: { name: string; currency: string } }
}

export interface AcceptOfferInput {
  uniformSize?: string
  shoeSize?: string
  tracksuitSize?: string
  jerseyPref1?: number
  jerseyPref2?: number
  jerseyPref3?: number
}

export class OfferResponseError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message)
  }
}

/** Validate gear fields required by what this offer includes. Throws OfferResponseError. */
export function validateAcceptInput(offer: OfferForResponse, data: AcceptOfferInput): void {
  if (offer.includesUniform && !data.uniformSize) {
    throw new OfferResponseError("Uniform size is required for this offer", "UNIFORM_SIZE_REQUIRED")
  }
  if (offer.includesShoes && !data.shoeSize) {
    throw new OfferResponseError("Shoe size is required for this offer", "SHOE_SIZE_REQUIRED")
  }
  if (offer.includesTracksuit && !data.tracksuitSize) {
    throw new OfferResponseError(
      "Tracksuit size is required for this offer",
      "TRACKSUIT_SIZE_REQUIRED"
    )
  }
  if (data.jerseyPref1 === undefined) {
    throw new OfferResponseError(
      "At least one jersey number preference is required",
      "JERSEY_PREF_REQUIRED"
    )
  }
}

async function notifyClubOfResponse(
  tx: any,
  offer: OfferForResponse,
  offerId: string,
  accepted: boolean
): Promise<void> {
  const clubOwner = await tx.userRole.findFirst({
    where: {
      tenantId: offer.team.tenantId,
      role: { in: ["ClubOwner", "ClubManager"] },
    },
    select: { userId: true },
  })
  if (!clubOwner) return
  const playerName = `${offer.player.firstName} ${offer.player.lastName}`
  await notify(tx, {
    userId: clubOwner.userId,
    type: accepted ? "offer_accepted" : "offer_declined",
    title: accepted ? "Offer Accepted" : "Offer Declined",
    message: accepted
      ? `${playerName} has accepted the offer to join ${offer.team.name}.`
      : `${playerName} has declined the offer to join ${offer.team.name}.`,
    link: `/clubs/${offer.team.tenantId}/offers`,
    referenceId: offerId,
    referenceType: "Offer",
  })
}

/**
 * Accept: offer -> ACCEPTED, roster TeamPlayer upserted with gear sizes,
 * club notified — one transaction.
 */
export async function acceptOffer(offer: OfferForResponse, data: AcceptOfferInput) {
  validateAcceptInput(offer, data)

  return prisma.$transaction(async (tx: any) => {
    const updated = await tx.offer.update({
      where: { id: offer.id },
      data: {
        status: "ACCEPTED",
        uniformSize: data.uniformSize || null,
        shoeSize: data.shoeSize || null,
        tracksuitSize: data.tracksuitSize || null,
        jerseyPref1: data.jerseyPref1,
        jerseyPref2: data.jerseyPref2 ?? null,
        jerseyPref3: data.jerseyPref3 ?? null,
        respondedAt: new Date(),
      },
    })

    await tx.teamPlayer.upsert({
      where: {
        teamId_playerId: {
          teamId: offer.teamId,
          playerId: offer.playerId,
        },
      },
      create: {
        teamId: offer.teamId,
        playerId: offer.playerId,
        uniformSize: data.uniformSize || null,
        shoeSize: data.shoeSize || null,
        tracksuitSize: data.tracksuitSize || null,
        status: "ACTIVE",
      },
      update: {
        status: "ACTIVE",
        uniformSize: data.uniformSize || null,
        shoeSize: data.shoeSize || null,
        tracksuitSize: data.tracksuitSize || null,
      },
    })

    // Accepting the offer is what creates the season-fee debt (the flagship
    // family→club flow, docs/payments-design.md A2). Installments are the
    // payment schedule against ONE obligation, not separate debts.
    const playerName = `${offer.player.firstName} ${offer.player.lastName}`
    await ensureObligation(tx, {
      payerUserId: offer.player.parentId,
      payeeTenantId: offer.team.tenantId,
      referenceType: "Offer",
      referenceId: offer.id,
      description:
        `Season fee — ${offer.team.name} (${playerName})` +
        (offer.installments > 1 ? `, ${offer.installments} installments` : ""),
      amount: Number(offer.seasonFee),
      currency: offer.team.tenant.currency,
    })

    await notifyClubOfResponse(tx, offer, updated.id, true)
    return updated
  })
}

/** Decline: offer -> DECLINED, club notified — one transaction. */
export async function declineOffer(offer: OfferForResponse) {
  return prisma.$transaction(async (tx: any) => {
    const updated = await tx.offer.update({
      where: { id: offer.id },
      data: {
        status: "DECLINED",
        respondedAt: new Date(),
      },
    })
    await notifyClubOfResponse(tx, offer, updated.id, false)
    return updated
  })
}
