import { createHash, randomBytes, randomUUID } from "node:crypto"
import { prisma } from "@youthbasketballhub/db"

/**
 * Refresh-token store for native-app bearer auth (M2 —
 * docs/roadmap/native-app-execution-plan.md). Node-only counterpart to the
 * edge-safe native-auth-tokens.ts.
 *
 * The client holds an opaque 256-bit token; we store only its sha256. Every
 * refresh rotates: the presented row is revoked and a new one is issued in
 * the same family. Presenting an already-revoked token therefore means the
 * token leaked (or a very stale retry) — the whole family is revoked so a
 * thief's live descendant token dies with it.
 */

export const REFRESH_TOKEN_TTL_DAYS = 60

/**
 * A token re-presented within this window of being rotated out is treated
 * as a LOST RESPONSE (the phone never got the successor — killed app, OTA
 * JS reload, dropped connection) rather than theft: the family survives and
 * a fresh successor is issued. Outside the window it's a genuine replay and
 * the family is revoked. Audit v2 §A1b.
 */
export const ROTATION_GRACE_MS = 60_000

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex")
}

function refreshExpiry(): Date {
  return new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000)
}

export async function issueRefreshToken(
  userId: string,
  opts: { familyId?: string; deviceLabel?: string | null } = {}
): Promise<string> {
  const raw = randomBytes(32).toString("base64url")
  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashToken(raw),
      familyId: opts.familyId ?? randomUUID(),
      deviceLabel: opts.deviceLabel ?? null,
      expiresAt: refreshExpiry(),
    },
  })
  return raw
}

async function revokeFamily(familyId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { familyId, revokedAt: null },
    data: { revokedAt: new Date() },
  })
}

/**
 * Rotate a refresh token: revoke the presented one, issue a successor in the
 * same family. Null means the caller gets a 401 and must sign in again —
 * covering not-found, replay (family revoked as a side effect), expiry, and
 * users no longer ACTIVE.
 */
export async function rotateRefreshToken(
  raw: string
): Promise<{ userId: string; refreshToken: string } | null> {
  const row = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(raw) },
    include: { user: { select: { status: true } } },
  })
  if (!row) return null

  if (row.revokedAt) {
    if (
      // lastUsedAt marks a rotation claim — ONLY those get grace. Tokens
      // revoked by sign-out/family revocation have no lastUsedAt and stay
      // dead: explicit revocation is final.
      row.lastUsedAt !== null &&
      Date.now() - row.revokedAt.getTime() < ROTATION_GRACE_MS &&
      row.expiresAt >= new Date() &&
      row.user.status === "ACTIVE"
    ) {
      // Lost-response recovery: the client re-presented the token we just
      // rotated out because it never received the successor. Revoke every
      // live token in the family (including that unseen successor) and
      // issue a fresh one — the family stays alive, exactly one token ends
      // up active, and a thief who stole the OLD token gets at most the
      // same one-minute window the legitimate client has.
      await revokeFamily(row.familyId)
      const refreshToken = await issueRefreshToken(row.userId, {
        familyId: row.familyId,
        deviceLabel: row.deviceLabel,
      })
      return { userId: row.userId, refreshToken }
    }
    // Replay of a rotated-out token — theft signal.
    await revokeFamily(row.familyId)
    return null
  }
  if (row.expiresAt < new Date() || row.user.status !== "ACTIVE") {
    await revokeFamily(row.familyId)
    return null
  }

  // Atomic claim: two concurrent refreshes with the same token race here —
  // exactly one revokes the row, the loser is treated as a replay.
  const claimed = await prisma.refreshToken.updateMany({
    where: { id: row.id, revokedAt: null },
    data: { revokedAt: new Date(), lastUsedAt: new Date() },
  })
  if (claimed.count !== 1) {
    await revokeFamily(row.familyId)
    return null
  }

  const refreshToken = await issueRefreshToken(row.userId, {
    familyId: row.familyId,
    deviceLabel: row.deviceLabel,
  })
  return { userId: row.userId, refreshToken }
}

/** Sign out one device: possession of the refresh token is the authority. */
export async function revokeByToken(raw: string): Promise<void> {
  const row = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(raw) },
    select: { familyId: true },
  })
  if (row) await revokeFamily(row.familyId)
}

/** Sign out everywhere (requires a verified access token at the route). */
export async function revokeAllForUser(userId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  })
}
