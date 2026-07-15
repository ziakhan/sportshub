import { createHash, randomBytes } from "node:crypto"
import { prisma } from "@youthbasketballhub/db"

/**
 * Guest scorekeeper invites (owner 2026-07-15): a WhatsApp-able one-time
 * link for volunteers who aren't in the system. Token is game-scoped,
 * expires after the game window, revocable; the volunteer's name is
 * stamped on claim for the audit trail.
 */

export function hashScoreToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex")
}

export function newScoreToken(): string {
  return randomBytes(24).toString("base64url")
}

/** Valid = exists, not revoked, not expired. Claimed is a separate gate. */
export async function findValidInvite(rawToken: string) {
  const invite = await (prisma as any).gameScoreInvite.findUnique({
    where: { tokenHash: hashScoreToken(rawToken) },
    select: {
      id: true,
      gameId: true,
      createdById: true,
      expiresAt: true,
      revokedAt: true,
      claimedAt: true,
      claimedName: true,
    },
  })
  if (!invite || invite.revokedAt || invite.expiresAt < new Date()) return null
  return invite
}

/**
 * Route-level guest gate for the scoring APIs: header token must be valid,
 * CLAIMED, and belong to THIS game. Returns the volunteer's name.
 */
export async function resolveGuestScorer(
  request: Request,
  gameId: string
): Promise<{ name: string; actorUserId: string } | null> {
  const raw = request.headers.get("x-guest-score-token")
  if (!raw) return null
  const invite = await findValidInvite(raw)
  if (!invite || invite.gameId !== gameId || !invite.claimedAt) return null
  // Guests act under the DELEGATOR's identity (the operator who minted the
  // link) — FKs stay intact; the volunteer's name lives on the invite.
  return { name: invite.claimedName ?? "Guest scorekeeper", actorUserId: invite.createdById }
}
