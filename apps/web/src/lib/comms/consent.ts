// Marketing-email consent, scoped per sending org (CASL).
//
// The legal sender of a re-engagement email is the CLUB or LEAGUE, not the
// platform — so consent attaches to (user, org), three layers: PLATFORM,
// TENANT, LEAGUE. Registration/purchase creates an existing business
// relationship = IMPLIED consent (~2y from lastEngagedAt, rolls forward on
// each new engagement). An explicit checkbox upgrades it to EXPRESS
// (durable until withdrawn). WITHDRAWN always wins and is never overwritten
// by later engagements.
//
// Transactional email (receipts, offers, game changes) is OUT of scope here.
// Design: docs/season-continuity-plan.md §5 · owner decisions 2026-07-09.

import { prisma } from "@youthbasketballhub/db"

export type ConsentScope = "PLATFORM" | "TENANT" | "LEAGUE"

/** CASL existing-business-relationship window. */
export const IMPLIED_CONSENT_WINDOW_MS = 2 * 365 * 24 * 60 * 60 * 1000

function orgWhere(scope: ConsentScope, orgId?: string | null) {
  return {
    scope,
    tenantId: scope === "TENANT" ? orgId : null,
    leagueId: scope === "LEAGUE" ? orgId : null,
  }
}

/**
 * Record an engagement (program registration, offer accept, team submit).
 * Creates/refreshes IMPLIED consent — but never resurrects a WITHDRAWN row
 * and never downgrades EXPRESS.
 */
export async function upsertImpliedConsent(
  userId: string,
  scope: ConsentScope,
  orgId: string | null,
  source: string
): Promise<void> {
  const where = orgWhere(scope, orgId)
  const existing = await (prisma as any).communicationConsent.findFirst({
    where: { userId, ...where },
  })
  if (!existing) {
    await (prisma as any).communicationConsent.create({
      data: { userId, ...where, status: "IMPLIED", source, lastEngagedAt: new Date() },
    })
    return
  }
  if (existing.status === "WITHDRAWN") return // opt-out is sticky
  await (prisma as any).communicationConsent.update({
    where: { id: existing.id },
    // EXPRESS stays EXPRESS; IMPLIED window rolls forward.
    data: { lastEngagedAt: new Date() },
  })
}

/** Explicit checkbox — durable until withdrawn. Overrides prior WITHDRAWN
 *  (the user just re-opted-in deliberately). */
export async function grantExpressConsent(
  userId: string,
  scope: ConsentScope,
  orgId: string | null,
  source: string
): Promise<void> {
  const where = orgWhere(scope, orgId)
  const existing = await (prisma as any).communicationConsent.findFirst({
    where: { userId, ...where },
  })
  if (!existing) {
    await (prisma as any).communicationConsent.create({
      data: { userId, ...where, status: "EXPRESS", source, lastEngagedAt: new Date() },
    })
    return
  }
  await (prisma as any).communicationConsent.update({
    where: { id: existing.id },
    data: { status: "EXPRESS", source, lastEngagedAt: new Date(), withdrawnAt: null },
  })
}

/** Unsubscribe — from a token link or the preferences page. Sticky. */
export async function withdrawConsent(
  userId: string,
  scope: ConsentScope,
  orgId: string | null,
  source: string
): Promise<void> {
  const where = orgWhere(scope, orgId)
  const existing = await (prisma as any).communicationConsent.findFirst({
    where: { userId, ...where },
  })
  if (!existing) {
    // Record the opt-out even with no prior relationship, so a future
    // engagement can't quietly re-enable sends.
    await (prisma as any).communicationConsent.create({
      data: {
        userId,
        ...where,
        status: "WITHDRAWN",
        source,
        withdrawnAt: new Date(),
      },
    })
    return
  }
  await (prisma as any).communicationConsent.update({
    where: { id: existing.id },
    data: { status: "WITHDRAWN", source, withdrawnAt: new Date() },
  })
}

/** Send-time gate for MARKETING email. Every composer send must pass this
 *  per recipient — the UI building an audience is never the enforcement. */
export async function hasMarketingConsent(
  userId: string,
  scope: ConsentScope,
  orgId: string | null
): Promise<boolean> {
  const where = orgWhere(scope, orgId)
  const row = await (prisma as any).communicationConsent.findFirst({
    where: { userId, ...where },
  })
  if (!row) return false
  if (row.status === "WITHDRAWN") return false
  if (row.status === "EXPRESS") return true
  // IMPLIED — valid inside the CASL window only.
  return Date.now() - new Date(row.lastEngagedAt).getTime() < IMPLIED_CONSENT_WINDOW_MS
}

/** All of a user's consent rows (for /settings/communications). */
export async function listConsents(userId: string) {
  return (prisma as any).communicationConsent.findMany({
    where: { userId },
    orderBy: [{ scope: "asc" }, { createdAt: "asc" }],
  })
}
