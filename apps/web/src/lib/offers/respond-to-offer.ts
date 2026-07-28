import { prisma } from "@youthbasketballhub/db"
import { notify } from "@/lib/notifications"
import { ensureObligation } from "@/lib/payments/obligations"
import { scheduleInstallments } from "@/lib/payments/installments"
import { appBaseUrl, escapeHtml, formatMoney, sendEmail, transactionalFooter } from "@/lib/email"
import { upsertImpliedConsent } from "@/lib/comms/consent"
import { rosterState } from "@/lib/teams/roster-commitment"

/**
 * Offer response domain service — accept/decline with roster formation.
 *
 * Extracted from the offers/[id] route handler: this is core business logic
 * (gear validation conditioned on what the offer includes, roster upsert,
 * club notification, all atomic). The route stays a thin HTTP adapter.
 */

export interface OfferOptionTerms {
  id: string
  seasonFee: unknown
  installments: number
  includesUniform: boolean
  includesShoes: boolean
  includesTracksuit: boolean
  includesBall: boolean
  includesBag: boolean
  allowFullPay: boolean
  allowInstallments: boolean
  depositAmount: unknown | null
  installmentTerms: Array<{ sequence: number; amount: unknown; dueDate: Date; label: string | null }>
}

export interface OfferForResponse {
  id: string
  teamId: string
  playerId: string
  seasonFee: unknown // Prisma Decimal
  installments: number
  includesUniform: boolean
  includesShoes: boolean
  includesTracksuit: boolean
  includesBall?: boolean
  includesBag?: boolean
  player: { id: string; parentId: string; firstName: string; lastName: string }
  team: { id: string; name: string; tenantId: string; tenant: { name: string; currency: string } }
  options?: OfferOptionTerms[]
}

export interface AcceptOfferInput {
  uniformSize?: string
  shoeSize?: string
  tracksuitSize?: string
  jerseyPref1?: number
  jerseyPref2?: number
  jerseyPref3?: number
  // Payments v2 Stage C: chosen package + how to pay + the confirmed deposit
  optionId?: string
  paymentPlan?: "FULL" | "INSTALLMENTS"
  depositPaymentIntentId?: string
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

  // Roster commitment cap (owner 2026-07-24): offers may exceed the cap on
  // purpose, but once COMMITTED players (paid/free) fill it, accepting into
  // the team stops — the spot race is over.
  const capState = await rosterState(prisma, offer.teamId)
  if (capState?.isFull) {
    throw new OfferResponseError(
      `${capState.team.name} has filled its committed roster — contact the club about waitlist options.`,
      "TEAM_FULL"
    )
  }

  // The route already snapshots the chosen option onto the offer columns; we
  // read the chosen option only for its PLAN (deposit + installment terms).
  const chosen =
    offer.options?.find((o) => o.id === (data.optionId ?? "")) ?? offer.options?.[0] ?? null
  const plan = data.paymentPlan ?? "FULL"

  const result = await prisma.$transaction(async (tx: any) => {
    const updated = await tx.offer.update({
      where: { id: offer.id },
      data: {
        status: "ACCEPTED",
        paymentPlan: plan,
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
      where: { teamId_playerId: { teamId: offer.teamId, playerId: offer.playerId } },
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

    // Accepting creates the season-fee debt (flagship family→club flow).
    const playerName = `${offer.player.firstName} ${offer.player.lastName}`
    const obligation = await ensureObligation(tx, {
      payerUserId: offer.player.parentId,
      payeeTenantId: offer.team.tenantId,
      referenceType: "Offer",
      referenceId: offer.id,
      description: `Season fee — ${offer.team.name} (${playerName})`,
      amount: Number(offer.seasonFee),
      currency: offer.team.tenant.currency,
    })

    // The deposit/full payment the family just made on-session (Stage C).
    let onSessionPayment: { id: string } | null = null
    if (data.depositPaymentIntentId && obligation) {
      const depositAmount =
        plan === "INSTALLMENTS" && chosen
          ? Number(chosen.depositAmount ?? 0)
          : Number(offer.seasonFee)
      onSessionPayment = await tx.payment.create({
        data: {
          obligationId: obligation.id,
          payerId: offer.player.parentId,
          tenantId: offer.team.tenantId,
          amount: depositAmount,
          currency: offer.team.tenant.currency,
          status: "SUCCEEDED",
          method: "STRIPE",
          stripePaymentIntentId: data.depositPaymentIntentId,
          installmentNumber: 1,
          relatedOfferId: offer.id,
          paymentType: "SEASON_FEE",
          description:
            plan === "INSTALLMENTS"
              ? `Deposit — ${offer.team.name}`
              : `Season fee — ${offer.team.name}`,
        },
      })
    }

    await notifyClubOfResponse(tx, offer, updated.id, true)
    return {
      updated,
      obligationId: obligation?.id ?? null,
      paymentId: onSessionPayment?.id ?? null,
    }
  })

  // Installment invoices are external Stripe calls → after the DB commit.
  if (
    plan === "INSTALLMENTS" &&
    chosen?.allowInstallments &&
    (chosen.installmentTerms?.length ?? 0) > 0 &&
    result.obligationId
  ) {
    await scheduleInstallments({
      offerId: offer.id,
      payerUserId: offer.player.parentId,
      merchant: { tenantId: offer.team.tenantId },
      tenantId: offer.team.tenantId,
      obligationId: result.obligationId,
      currency: offer.team.tenant.currency,
      teamName: offer.team.name,
      terms: chosen.installmentTerms.map((t) => ({
        sequence: t.sequence,
        amount: Number(t.amount),
        dueDate: new Date(t.dueDate),
        label: t.label,
      })),
    }).catch((e) => console.error("scheduleInstallments failed:", e))
  }

  // Family comms — best-effort, strictly AFTER the commit so a consent/mail
  // hiccup can never fail (or hold open) the accept transaction.

  // Accepting an offer is a CASL engagement with the club → implied consent.
  try {
    await upsertImpliedConsent(
      offer.player.parentId,
      "TENANT",
      offer.team.tenantId,
      `offer-accept:${offer.id}`
    )
  } catch (e) {
    console.error("offer-accept consent upsert failed:", e)
  }

  // Receipt for the on-session charge (skip free offers — nothing was charged).
  const chargedAmount =
    plan === "INSTALLMENTS" && chosen ? Number(chosen.depositAmount ?? 0) : Number(offer.seasonFee)
  if (result.paymentId && chargedAmount > 0) {
    const clubName = offer.team.tenant.name
    const playerName = `${offer.player.firstName} ${offer.player.lastName}`
    const isDeposit = plan === "INSTALLMENTS"
    const money = formatMoney(chargedAmount, offer.team.tenant.currency)
    try {
      await notify(prisma, {
        userId: offer.player.parentId,
        type: "payment_receipt",
        title: "Payment received",
        message: `${isDeposit ? "Deposit" : "Season fee"} for ${playerName} — ${offer.team.name}: ${money} paid. Thank you!`,
        link: "/payments",
        referenceId: result.paymentId,
        referenceType: "Payment",
      })
    } catch (e) {
      console.error("offer-accept receipt bell failed:", e)
    }
    try {
      const parent = await prisma.user.findUnique({
        where: { id: offer.player.parentId },
        select: { email: true, firstName: true },
      })
      if (parent?.email) {
        await sendEmail({
          to: parent.email,
          subject: `Payment received — ${money}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>Payment received</h2>
              ${parent.firstName ? `<p>Hi ${escapeHtml(parent.firstName)},</p>` : ""}
              <p>We received your ${isDeposit ? "deposit" : "season fee payment"} of <strong>${money}</strong> for <strong>${escapeHtml(playerName)}</strong> on <strong>${escapeHtml(offer.team.name)}</strong> at <strong>${escapeHtml(clubName)}</strong>.</p>
              ${
                isDeposit
                  ? "<p>The remaining balance will be charged to your card per the installment schedule.</p>"
                  : "<p>Your season fee is paid in full.</p>"
              }
              <p>
                <a href="${appBaseUrl()}/payments" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 6px;">
                  View your payments
                </a>
              </p>
              ${transactionalFooter(clubName)}
            </div>`,
        })
      }
    } catch (e) {
      console.error("offer-accept receipt email failed:", e)
    }
  }

  return result.updated
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
