import { notify } from "@/lib/notifications"

/**
 * Offer creation domain service — template resolution, duplicate guard,
 * create + parent notification. Shared by POST /api/offers and the
 * PlayerInvitation accept flow (G3), which must mint an identical offer.
 */

export interface OfferTerms {
  seasonFee: number
  installments: number
  practiceSessions: number
  includesBall: boolean
  includesBag: boolean
  includesShoes: boolean
  includesUniform: boolean
  includesTracksuit: boolean
}

export type OfferTermOverrides = Partial<OfferTerms>

const DEFAULT_TERMS: OfferTerms = {
  seasonFee: 0,
  installments: 1,
  practiceSessions: 0,
  includesBall: false,
  includesBag: false,
  includesShoes: false,
  includesUniform: false,
  includesTracksuit: false,
}

export class OfferCreationError extends Error {
  constructor(
    message: string,
    public code: "TEMPLATE_NOT_FOUND" | "DUPLICATE_PENDING_OFFER"
  ) {
    super(message)
  }
}

/**
 * Merge template values (when a template is given) with explicit overrides.
 *
 * `onMissingTemplate` — "throw" for direct offer creation (the club just
 * picked the template, a miss is an input error); "ignore" for invitation
 * acceptance (the template may have been deactivated between invite and
 * accept — fall back to the invitation's stored overrides).
 */
export async function resolveOfferTerms(
  db: any,
  opts: {
    tenantId: string
    templateId?: string | null
    overrides?: OfferTermOverrides
    onMissingTemplate?: "throw" | "ignore"
  }
): Promise<{ terms: OfferTerms; templateId: string | null }> {
  const { tenantId, templateId, overrides = {}, onMissingTemplate = "throw" } = opts

  let templateValues: OfferTerms = { ...DEFAULT_TERMS }
  let resolvedTemplateId: string | null = null

  if (templateId) {
    const template = await db.offerTemplate.findFirst({
      where: { id: templateId, tenantId, isActive: true },
    })
    if (!template) {
      if (onMissingTemplate === "throw") {
        throw new OfferCreationError("Template not found", "TEMPLATE_NOT_FOUND")
      }
    } else {
      resolvedTemplateId = template.id
      templateValues = {
        seasonFee: Number(template.seasonFee),
        installments: template.installments,
        practiceSessions: template.practiceSessions,
        includesBall: template.includesBall,
        includesBag: template.includesBag,
        includesShoes: template.includesShoes,
        includesUniform: template.includesUniform,
        includesTracksuit: template.includesTracksuit,
      }
    }
  }

  const terms = { ...templateValues }
  for (const key of Object.keys(DEFAULT_TERMS) as (keyof OfferTerms)[]) {
    const override = overrides[key]
    if (override !== undefined) (terms as any)[key] = override
  }
  return { terms, templateId: resolvedTemplateId }
}

export interface CreateOfferInput {
  teamId: string
  playerId: string
  tryoutSignupId?: string | null
  templateId?: string | null
  terms: OfferTerms
  message?: string | null
  expiresAt: Date
  /** For the parent notification. */
  player: { parentId: string; firstName: string; lastName: string }
  clubName: string
  teamName: string
}

/**
 * Create the offer, flip the tryout signup to OFFERED, and notify the parent.
 * Pass the transaction client — the duplicate-pending guard runs inside it.
 * Throws OfferCreationError(DUPLICATE_PENDING_OFFER) when the player already
 * has a pending offer on this team.
 */
export async function createOfferForPlayer(tx: any, input: CreateOfferInput) {
  const existing = await tx.offer.findFirst({
    where: { teamId: input.teamId, playerId: input.playerId, status: "PENDING" },
    select: { id: true },
  })
  if (existing) {
    throw new OfferCreationError(
      "A pending offer already exists for this player on this team",
      "DUPLICATE_PENDING_OFFER"
    )
  }

  const offer = await tx.offer.create({
    data: {
      teamId: input.teamId,
      playerId: input.playerId,
      tryoutSignupId: input.tryoutSignupId || null,
      templateId: input.templateId || null,
      ...input.terms,
      message: input.message || null,
      expiresAt: input.expiresAt,
    },
  })

  if (input.tryoutSignupId) {
    await tx.tryoutSignup.update({
      where: { id: input.tryoutSignupId },
      data: { status: "OFFERED" },
    })
  }

  await notify(tx, {
    userId: input.player.parentId,
    type: "offer_received",
    title: "New Team Offer",
    message: `${input.clubName} has sent an offer for ${input.player.firstName} ${input.player.lastName} to join ${input.teamName}.`,
    link: `/offers`,
    referenceId: offer.id,
    referenceType: "Offer",
  })

  return offer
}
