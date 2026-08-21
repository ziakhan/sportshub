import { prisma } from "@youthbasketballhub/db"
import { notify } from "@/lib/notifications"
import { ensureObligation, recomputeObligationStatus } from "@/lib/payments/obligations"
import { scheduleInstallments } from "@/lib/payments/installments"
import { appBaseUrl, escapeHtml, formatMoney, sendEmail, transactionalFooter } from "@/lib/email"
import { upsertImpliedConsent } from "@/lib/comms/consent"
import { rosterState } from "@/lib/teams/roster-commitment"
import { addAcceptedPlayerToTeam } from "@/lib/teams/roster-entry"

/**
 * Offer response domain service — accept/decline with roster formation.
 *
 * Extracted from the offers/[id] route handler: this is core business logic
 * (gear validation conditioned on what the offer includes, roster upsert,
 * club notification, all atomic). The route stays a thin HTTP adapter.
 *
 * Two shapes of offer arrive here (club tryout events, 2026-08-20):
 *  - a TEAM offer, which forms a roster spot on acceptance, and
 *  - a TEAMLESS age-group offer from the tryout pool, which commits the money
 *    and nothing else. The jersey arrives later, at assignment.
 * `offerScope` is the one place that resolves club, currency and display
 * label for either shape.
 *
 * The teamless shape has two endings, because assignment and offer state are
 * orthogonal: the club may pick a kid off the pool board BEFORE the family
 * says yes. When that already happened, acceptance is the missing half and the
 * roster spot is written here — the same rule as `rosterOnAssignment`, read
 * from the other end. Without an assignment it stays money only.
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
  /** Null for an age-group program offer sent from the tryout pool. */
  teamId: string | null
  tenantId?: string | null
  ageGroup?: string | null
  playerId: string
  seasonFee: unknown // Prisma Decimal
  installments: number
  includesUniform: boolean
  includesShoes: boolean
  includesTracksuit: boolean
  includesBall?: boolean
  includesBag?: boolean
  player: { id: string; parentId: string; firstName: string; lastName: string }
  team: {
    id: string
    name: string
    tenantId: string
    tenant: { name: string; currency: string }
  } | null
  tenant?: { name: string; currency: string } | null
  options?: OfferOptionTerms[]
}

export interface OfferScope {
  tenantId: string
  clubName: string
  currency: string
  /** What the family is joining: a team name, or "U13 program". */
  label: string
  /** True when nothing gets rostered on acceptance. */
  teamless: boolean
}

/**
 * Club, currency and display label for either shape of offer. tenantId is
 * authoritative on the offer itself; the team's tenant is the fallback for
 * every row written before the column existed.
 */
export function offerScope(offer: OfferForResponse): OfferScope {
  const tenant = offer.tenant ?? offer.team?.tenant
  const tenantId = offer.tenantId ?? offer.team?.tenantId
  if (!tenant || !tenantId) {
    throw new OfferResponseError("This offer is not attached to a club", "OFFER_NO_CLUB")
  }
  return {
    tenantId,
    clubName: tenant.name,
    currency: tenant.currency,
    label: offer.team?.name ?? `${offer.ageGroup ?? "club"} program`,
    teamless: !offer.teamId,
  }
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
  // Jersey at assignment, money at offer (owner ruling 2026-08-20): an
  // age-group program offer has no team yet, so it asks for no number.
  if (offer.teamId && data.jerseyPref1 === undefined) {
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
  accepted: boolean,
  /** The team the accept landed them on, when the club had already picked them. */
  joinedTeamName?: string | null
): Promise<void> {
  const scope = offerScope(offer)
  const clubOwner = await tx.userRole.findFirst({
    where: {
      tenantId: scope.tenantId,
      role: { in: ["ClubOwner", "ClubManager"] },
    },
    select: { userId: true },
  })
  if (!clubOwner) return
  const playerName = `${offer.player.firstName} ${offer.player.lastName}`
  const joining = joinedTeamName ?? (scope.teamless ? `the ${scope.label}` : scope.label)
  await notify(tx, {
    userId: clubOwner.userId,
    type: accepted ? "offer_accepted" : "offer_declined",
    title: accepted ? "Offer Accepted" : "Offer Declined",
    message: accepted
      ? `${playerName} has accepted the offer to join ${joining}.`
      : `${playerName} has declined the offer to join ${joining}.`,
    link: `/clubs/${scope.tenantId}/offers`,
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
  const scope = offerScope(offer)

  // Roster commitment cap (owner 2026-07-24): offers may exceed the cap on
  // purpose, but once COMMITTED players (paid/free) fill it, accepting into
  // the team stops — the spot race is over. A pool offer holds no roster spot,
  // so no cap applies until someone assigns the player to a team.
  if (offer.teamId) {
    const capState = await rosterState(prisma, offer.teamId)
    if (capState?.isFull) {
      throw new OfferResponseError(
        `${capState.team.name} has filled its committed roster — contact the club about waitlist options.`,
        "TEAM_FULL"
      )
    }
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

    // A team offer forms its roster spot here, as it always has.
    let joinedTeam: { id: string; name: string } | null = null
    if (offer.teamId) {
      await addAcceptedPlayerToTeam(tx, {
        teamId: offer.teamId,
        playerId: offer.playerId,
        uniformSize: data.uniformSize,
        shoeSize: data.shoeSize,
        tracksuitSize: data.tracksuitSize,
      })
    } else {
      // A pool offer buys a spot in the age-group program. If a coach already
      // claimed this kid off the pool board, the team half of the deal is
      // settled and only the money was outstanding — so the roster spot lands
      // now. Nothing to claim yet means money only: the spot follows the
      // assignment, whichever of the two arrives second.
      const held = await tx.tryoutPoolMember.findFirst({
        where: {
          tenantId: scope.tenantId,
          playerId: offer.playerId,
          teamId: { not: null },
          ...(offer.ageGroup ? { ageGroup: offer.ageGroup } : {}),
        },
        select: { team: { select: { id: true, name: true } } },
        orderBy: { assignedAt: "desc" },
      })
      if (held?.team) {
        await addAcceptedPlayerToTeam(tx, {
          teamId: held.team.id,
          playerId: offer.playerId,
          uniformSize: data.uniformSize,
          shoeSize: data.shoeSize,
          tracksuitSize: data.tracksuitSize,
        })
        joinedTeam = held.team
      }
    }

    // Accepting creates the season-fee debt (flagship family→club flow).
    const playerName = `${offer.player.firstName} ${offer.player.lastName}`
    const obligation = await ensureObligation(tx, {
      payerUserId: offer.player.parentId,
      payeeTenantId: scope.tenantId,
      referenceType: "Offer",
      referenceId: offer.id,
      description: scope.teamless
        ? `Season fee for the ${scope.label} (${playerName})`
        : `Season fee — ${scope.label} (${playerName})`,
      amount: Number(offer.seasonFee),
      currency: scope.currency,
    })

    // The deposit/full payment the family made on-session (Stage C). pay-intent
    // already wrote a PENDING Payment row for the confirmed intent, and the
    // route re-verified its amount/owner/currency against this plan. We only
    // LINK that row to the new obligation and mark it settled here — never mint
    // a second row, and the client's plan never decides the amount (audit
    // C1/H1, 2026-08-21). Linking happens AFTER the roster-cap gate above, so a
    // TEAM_FULL accept never records money against a debt. The re-checks
    // (relatedOfferId, unconsumed) are belt-and-suspenders on the route gate.
    let onSessionPayment: { id: string } | null = null
    if (data.depositPaymentIntentId && obligation) {
      const existing = await tx.payment.findUnique({
        where: { stripePaymentIntentId: data.depositPaymentIntentId },
        select: { id: true, relatedOfferId: true, obligationId: true },
      })
      if (existing && existing.relatedOfferId === offer.id && existing.obligationId == null) {
        onSessionPayment = await tx.payment.update({
          where: { id: existing.id },
          data: {
            obligationId: obligation.id,
            status: "SUCCEEDED",
            installmentNumber: 1,
            paymentType: "SEASON_FEE",
            description:
              plan === "INSTALLMENTS"
                ? `Deposit for ${scope.label}`
                : `Season fee for ${scope.label}`,
          },
          select: { id: true },
        })
        // Derive the obligation status from its payments (the engine's rule):
        // a full on-session payment settles it, a deposit takes it to
        // partially paid. The webhook is idempotent against this.
        await recomputeObligationStatus(tx, obligation.id)
      }
    }

    await notifyClubOfResponse(tx, offer, updated.id, true, joinedTeam?.name)
    return {
      updated,
      joinedTeam,
      obligationId: obligation?.id ?? null,
      paymentId: onSessionPayment?.id ?? null,
    }
  })

  // What the family actually joined: the team the club had already picked them
  // for, or the age-group program they are still pooled in.
  const joinedLabel = result.joinedTeam?.name ?? scope.label
  const joinedPreposition = scope.teamless && !result.joinedTeam ? "in" : "on"

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
      merchant: { tenantId: scope.tenantId },
      tenantId: scope.tenantId,
      obligationId: result.obligationId,
      currency: scope.currency,
      teamName: scope.label,
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
      scope.tenantId,
      `offer-accept:${offer.id}`
    )
  } catch (e) {
    console.error("offer-accept consent upsert failed:", e)
  }

  // Receipt for the on-session charge (skip free offers — nothing was charged).
  const chargedAmount =
    plan === "INSTALLMENTS" && chosen ? Number(chosen.depositAmount ?? 0) : Number(offer.seasonFee)
  if (result.paymentId && chargedAmount > 0) {
    const clubName = scope.clubName
    const playerName = `${offer.player.firstName} ${offer.player.lastName}`
    const isDeposit = plan === "INSTALLMENTS"
    const money = formatMoney(chargedAmount, scope.currency)
    try {
      await notify(prisma, {
        userId: offer.player.parentId,
        type: "payment_receipt",
        title: "Payment received",
        message: `${isDeposit ? "Deposit" : "Season fee"} for ${playerName} (${joinedLabel}): ${money} paid. Thank you!`,
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
              <p>We received your ${isDeposit ? "deposit" : "season fee payment"} of <strong>${money}</strong> for <strong>${escapeHtml(playerName)}</strong> ${joinedPreposition} <strong>${escapeHtml(joinedLabel)}</strong> at <strong>${escapeHtml(clubName)}</strong>.</p>
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

  // `joinedTeam` rides along so callers can say where the kid landed; the
  // offer row's own fields are untouched, so `result.status` still reads.
  return { ...result.updated, joinedTeam: result.joinedTeam }
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
