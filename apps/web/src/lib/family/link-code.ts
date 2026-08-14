import { randomInt } from "node:crypto"
import { prisma } from "@youthbasketballhub/db"

/**
 * Six characters handed across the kitchen table (parent-child linking arc
 * 2026-08-13).
 *
 * The email invite assumes two people who are apart. Most of the time they
 * are not: a kid signs up at practice with a parent standing right there. So
 * one of them makes a code, the other types it in, and they are linked. The
 * handoff itself is the consent, which is why redeeming links immediately
 * instead of mailing an approval request back.
 *
 * The alphabet drops O/0 and I/1/L so a code read out loud in a loud gym
 * still lands. One live code per person: making a new one voids the old, so
 * a code someone shouted across a gym last month cannot be used later.
 */

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
const CODE_LENGTH = 6
export const LINK_CODE_TTL_DAYS = 7

export type FamilyLinkDirection = "PARENT_INVITES_CHILD" | "CHILD_INVITES_PARENT"

export function generateLinkCode(): string {
  let code = ""
  for (let i = 0; i < CODE_LENGTH; i++) code += ALPHABET[randomInt(0, ALPHABET.length)]
  return code
}

/** Typed by hand, so spaces, dashes and lowercase all have to work. */
export function normalizeLinkCode(input: unknown): string {
  if (typeof input !== "string") return ""
  return input.replace(/[\s-]/g, "").toUpperCase()
}

export interface ActiveLinkCode {
  code: string
  expiresAt: Date
  direction: FamilyLinkDirection
  playerId: string | null
}

/** The caller's one live code, if they have one. */
export async function getActiveLinkCode(userId: string): Promise<ActiveLinkCode | null> {
  const row = await (prisma as any).familyLinkCode.findFirst({
    where: { createdByUserId: userId, usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    select: { code: true, expiresAt: true, direction: true, playerId: true },
  })
  return row ?? null
}

/**
 * Mint a code, retiring whatever the caller had before it. Codes are short
 * enough to collide once in a long while, so a taken one is simply redrawn.
 */
export async function createLinkCode({
  userId,
  direction,
  playerId,
}: {
  userId: string
  direction: FamilyLinkDirection
  playerId: string | null
}): Promise<ActiveLinkCode> {
  await (prisma as any).familyLinkCode.deleteMany({
    where: { createdByUserId: userId, usedAt: null },
  })

  const expiresAt = new Date(Date.now() + LINK_CODE_TTL_DAYS * 24 * 3600 * 1000)
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const row = await (prisma as any).familyLinkCode.create({
        data: {
          code: generateLinkCode(),
          createdByUserId: userId,
          direction,
          playerId,
          expiresAt,
        },
        select: { code: true, expiresAt: true, direction: true, playerId: true },
      })
      return row
    } catch (error: any) {
      if (error?.code !== "P2002") throw error
    }
  }
  throw new Error("LINK_CODE_COLLISION")
}
