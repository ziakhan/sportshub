// Waiver signing links — tokenized public access, mechanics copied from
// lib/auth-magic.ts (hash at rest, single-use consume, TTL). Unlike
// LoginToken this token does NOT authenticate a User: it grants access to
// sign ONE waiver for ONE player. Parents click it straight from email with
// no session.

import { createHash, randomBytes } from "crypto"
import { prisma } from "@youthbasketballhub/db"

/** 30 days — waiver links live much longer than sign-in links; a parent may
 *  get the email weeks before the season starts. Re-approval re-mints. */
export const WAIVER_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000

export function hashWaiverToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

/**
 * Mint a signing link token for (waiver, player, season). Reuses a still-live
 * unconsumed request instead of minting a duplicate — repeated approvals or
 * reminder re-sends within the TTL reuse the same row but get a FRESH token
 * (the old link keeps working via its own row only when we skip minting, so
 * callers decide: `reuseExisting` skips the email-blast dedupe).
 */
export async function mintWaiverSignRequest({
  waiverId,
  playerId,
  seasonId,
  emailedTo,
}: {
  waiverId: string
  playerId: string
  seasonId: string | null
  emailedTo: string
}): Promise<{ token: string; requestId: string }> {
  const token = randomBytes(32).toString("base64url")
  const request = await (prisma as any).waiverSignRequest.create({
    data: {
      waiverId,
      playerId,
      seasonId,
      emailedTo,
      tokenHash: hashWaiverToken(token),
      expiresAt: new Date(Date.now() + WAIVER_TOKEN_TTL_MS),
    },
  })
  return { token, requestId: request.id }
}

/** A live (unconsumed, unexpired) request already exists for this exact ask —
 *  used to avoid re-emailing the same parent on repeated approval events. */
export async function hasLiveSignRequest({
  waiverId,
  playerId,
  seasonId,
}: {
  waiverId: string
  playerId: string
  seasonId: string | null
}): Promise<boolean> {
  const existing = await (prisma as any).waiverSignRequest.findFirst({
    where: {
      waiverId,
      playerId,
      seasonId,
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: { id: true },
  })
  return !!existing
}

export type SignRequestLookup = {
  request: {
    id: string
    playerId: string
    seasonId: string | null
    emailedTo: string
  }
  waiver: {
    id: string
    title: string
    body: string
    type: string
    version: number
    annualRenewal: boolean
    orgName: string
  }
  player: { id: string; firstName: string; lastName: string }
  alreadySigned: boolean
}

/** Resolve a raw token to its request + waiver + player. Null on unknown,
 *  expired, consumed, or inactive-waiver tokens. */
export async function getSignRequestByToken(
  token: string
): Promise<SignRequestLookup | null> {
  if (!token || token.length > 200) return null
  const row = await (prisma as any).waiverSignRequest.findUnique({
    where: { tokenHash: hashWaiverToken(token) },
    include: {
      waiver: {
        select: {
          id: true,
          title: true,
          body: true,
          type: true,
          version: true,
          annualRenewal: true,
          active: true,
          tenant: { select: { name: true } },
          league: { select: { name: true } },
        },
      },
      player: { select: { id: true, firstName: true, lastName: true, deletedAt: true } },
    },
  })
  if (!row || row.expiresAt < new Date()) return null
  if (!row.waiver.active || row.player.deletedAt) return null

  // Signed since this link was minted (via this link, a re-sent one, or the
  // other guardian) — the page shows "already signed" instead of the pad.
  const existing = await (prisma as any).waiverSignature.findFirst({
    where: {
      waiverId: row.waiver.id,
      playerId: row.player.id,
      waiverVersion: row.waiver.version,
      OR: [{ validUntil: null }, { validUntil: { gt: new Date() } }],
    },
    select: { id: true },
  })

  // A consumed token stays resolvable ONLY to say "already signed" (parents
  // re-open the same email link after signing). Consumed with no signature on
  // file is a dead token.
  if (row.consumedAt && !existing) return null

  return {
    request: {
      id: row.id,
      playerId: row.playerId,
      seasonId: row.seasonId,
      emailedTo: row.emailedTo,
    },
    waiver: {
      id: row.waiver.id,
      title: row.waiver.title,
      body: row.waiver.body,
      type: row.waiver.type,
      version: row.waiver.version,
      annualRenewal: row.waiver.annualRenewal,
      orgName: row.waiver.league?.name ?? row.waiver.tenant?.name ?? "SportsHub",
    },
    player: {
      id: row.player.id,
      firstName: row.player.firstName,
      lastName: row.player.lastName,
    },
    alreadySigned: !!existing,
  }
}

/** Consume exactly once; false if another request got there first. */
export async function consumeSignRequest(requestId: string): Promise<boolean> {
  const updated = await (prisma as any).waiverSignRequest.updateMany({
    where: { id: requestId, consumedAt: null },
    data: { consumedAt: new Date() },
  })
  return updated.count === 1
}
