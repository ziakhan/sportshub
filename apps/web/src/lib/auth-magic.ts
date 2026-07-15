// Magic sign-in (Slack-style, 2026-07-15). Each request mints ONE LoginToken
// row carrying two redemption shapes for the same grant:
//   - link token: 32 random bytes, emailed as /magic-link?token=…
//   - 6-digit code: typed into the sign-in page (cross-device: request on
//     laptop, read the code from the phone's inbox)
// Unlike password-reset tokens (lib/auth-reset.ts — stateless, invalidated by
// the password change itself), signing in changes nothing, so single-use MUST
// be server-side state: hashed at rest, consumed atomically, code guesses
// bounded per-row by `attempts`.

import { createHash, randomBytes, randomInt, randomUUID } from "crypto"
import { prisma } from "@youthbasketballhub/db"

export const MAGIC_TOKEN_TTL_MS = 15 * 60 * 1000
export const MAX_CODE_ATTEMPTS = 5
/** Max unconsumed requests per user per TTL window — bounds email blasting. */
export const MAX_ACTIVE_REQUESTS = 3

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex")
}

export function hashLinkToken(token: string): string {
  return sha256(token)
}

/** Code hashes are salted with the row id so equal codes never collide. */
export function hashCode(rowId: string, code: string): string {
  return sha256(`${rowId}:${code}`)
}

type MagicUser = { id: string; email: string; name: string | null }

function toAuthUser(user: {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
}): MagicUser {
  return {
    id: user.id,
    email: user.email,
    name: [user.firstName, user.lastName].filter(Boolean).join(" ") || null,
  }
}

/**
 * Mint a link token + code for the user. Returns null when the per-user
 * window is exhausted (caller stays silent — anti-enumeration).
 */
export async function createLoginToken(
  userId: string
): Promise<{ token: string; code: string } | null> {
  const windowStart = new Date(Date.now() - MAGIC_TOKEN_TTL_MS)
  const recent = await prisma.loginToken.count({
    where: { userId, createdAt: { gt: windowStart } },
  })
  if (recent >= MAX_ACTIVE_REQUESTS) return null

  const id = randomUUID()
  const token = randomBytes(32).toString("base64url")
  const code = randomInt(0, 1_000_000).toString().padStart(6, "0")

  await prisma.loginToken.create({
    data: {
      id,
      userId,
      tokenHash: hashLinkToken(token),
      codeHash: hashCode(id, code),
      expiresAt: new Date(Date.now() + MAGIC_TOKEN_TTL_MS),
    },
  })
  return { token, code }
}

/** Consume exactly once; returns false if another request got there first. */
async function consume(rowId: string): Promise<boolean> {
  const updated = await prisma.loginToken.updateMany({
    where: { id: rowId, consumedAt: null },
    data: { consumedAt: new Date() },
  })
  return updated.count === 1
}

async function activeUser(userId: string): Promise<MagicUser | null> {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user || user.status !== "ACTIVE") return null
  return toAuthUser(user)
}

/** Redeem the emailed link. Null on unknown/expired/consumed/locked tokens. */
export async function redeemLoginLink(token: string): Promise<MagicUser | null> {
  const row = await prisma.loginToken.findUnique({
    where: { tokenHash: hashLinkToken(token) },
  })
  if (!row || row.consumedAt || row.expiresAt < new Date()) return null
  if (row.attempts >= MAX_CODE_ATTEMPTS) return null
  if (!(await consume(row.id))) return null
  return activeUser(row.userId)
}

/**
 * Redeem a typed 6-digit code for the given email. A wrong guess burns an
 * attempt on the newest live row; MAX_CODE_ATTEMPTS kills that row (the link
 * shape included — one grant, one budget).
 */
export async function redeemLoginCode(
  rawEmail: string,
  rawCode: string
): Promise<MagicUser | null> {
  const email = rawEmail.trim().toLowerCase()
  const code = rawCode.replace(/\D/g, "")
  if (!email || code.length !== 6) return null

  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
  })
  if (!user || user.status !== "ACTIVE") return null

  const rows = await prisma.loginToken.findMany({
    where: {
      userId: user.id,
      consumedAt: null,
      expiresAt: { gt: new Date() },
      attempts: { lt: MAX_CODE_ATTEMPTS },
    },
    orderBy: { createdAt: "desc" },
    take: MAX_ACTIVE_REQUESTS,
  })

  for (const row of rows) {
    if (row.codeHash === hashCode(row.id, code)) {
      if (!(await consume(row.id))) return null
      return toAuthUser(user)
    }
  }

  if (rows.length > 0) {
    await prisma.loginToken.update({
      where: { id: rows[0].id },
      data: { attempts: { increment: 1 } },
    })
  }
  return null
}
