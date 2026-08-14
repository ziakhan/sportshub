import { prisma } from "@youthbasketballhub/db"
import { looksLikeSamePlayer } from "./merge-players"

/**
 * "Did a parent already add you?" resolved server-side (parent-child linking
 * arc 2026-08-12).
 *
 * The kid never learns the answer. They give their parent's email; if that
 * account already holds a player row that is plainly them, the parent gets a
 * request to link the two instead of an invite to create a second world. If
 * it does not, the parent gets the ordinary guardian invite. Both look
 * identical from the kid's side, so this can never be used to find out
 * whether an email has an account.
 */

export interface ClaimTarget {
  parentUserId: string
  playerId: string
  playerFirstName: string
}

export interface NameMatch {
  id: string
  firstName: string
  lastName: string
  dateOfBirth: Date
  parentId: string
}

/**
 * Every "is this the same kid?" question on the platform goes through here
 * (name + birth year, the rule in looksLikeSamePlayer). Two shapes of the
 * same search:
 *
 *  - scoped to one parent: the rows under that account are few, so we load
 *    them and let looksLikeSamePlayer decide, exactly as this module always
 *    did.
 *  - platform-wide (the onboarding claim check): narrowed in SQL first, then
 *    handed to the same rule so the answer can never drift between the two.
 *
 * "Parent-created" is `userId: null` — a row somebody already signs in as is
 * theirs, not a profile waiting to be claimed. Soft-deleted and absorbed rows
 * are never candidates.
 */
export async function findClaimTargetByName({
  firstName,
  lastName,
  birthYear,
  parentUserId,
  excludePlayerId,
}: {
  firstName: string
  lastName: string
  birthYear: number
  /** Limit the search to one parent's players. */
  parentUserId?: string
  /** The asker's own row, never a match for itself. */
  excludePlayerId?: string
}): Promise<NameMatch[]> {
  if (!firstName?.trim() || !lastName?.trim() || !Number.isInteger(birthYear)) return []

  const where: any = {
    deletedAt: null,
    absorbedAt: null,
    // A row somebody already signs in as is not claimable.
    userId: null,
  }
  if (parentUserId) where.parentId = parentUserId
  if (excludePlayerId) where.id = { not: excludePlayerId }
  if (!parentUserId) {
    // No parent scope means every player on the platform, so narrow before
    // loading. A day either side of the year covers dates stored at a UTC
    // midnight that reads as the previous day locally; the year check below
    // is still the one that decides.
    where.firstName = { equals: firstName.trim(), mode: "insensitive" }
    where.lastName = { equals: lastName.trim(), mode: "insensitive" }
    where.dateOfBirth = {
      gte: new Date(Date.UTC(birthYear - 1, 11, 30)),
      lt: new Date(Date.UTC(birthYear + 1, 0, 2)),
    }
  }

  const rows = await (prisma as any).player.findMany({
    where,
    select: { id: true, firstName: true, lastName: true, dateOfBirth: true, parentId: true },
  })

  const asked = { firstName, lastName, dateOfBirth: new Date(birthYear, 0, 1) }
  return rows.filter((r: NameMatch) => looksLikeSamePlayer(r, asked))
}

export async function findClaimTarget({
  parentEmail,
  kid,
}: {
  parentEmail: string
  kid: { id: string; firstName: string; lastName: string; dateOfBirth: Date }
}): Promise<ClaimTarget | null> {
  const parent = await prisma.user.findFirst({
    where: { email: { equals: parentEmail, mode: "insensitive" } },
    select: { id: true },
  })
  if (!parent) return null

  const [match] = await findClaimTargetByName({
    firstName: kid.firstName,
    lastName: kid.lastName,
    birthYear: new Date(kid.dateOfBirth).getFullYear(),
    parentUserId: parent.id,
    excludePlayerId: kid.id,
  })
  if (!match) return null

  return { parentUserId: parent.id, playerId: match.id, playerFirstName: match.firstName }
}

/**
 * The email-free version, for a kid who never types an address (auto-claim,
 * 2026-08-13): onboarding already knows their name and birth year, so the
 * server finds the profile and resolves the parent itself.
 *
 * Exactly one match is a claim. Two families holding a row for the same name
 * and birth year is not something we can pick between, so it is treated as no
 * match and the kid is asked for an email the ordinary way.
 */
export async function resolveAutoClaimTarget(kid: {
  id: string
  firstName: string
  lastName: string
  dateOfBirth: Date
}): Promise<{ parentUserId: string; parentEmail: string; playerId: string } | null> {
  const matches = await findClaimTargetByName({
    firstName: kid.firstName,
    lastName: kid.lastName,
    birthYear: new Date(kid.dateOfBirth).getFullYear(),
    excludePlayerId: kid.id,
  })
  if (matches.length !== 1) return null

  const parent = await prisma.user.findUnique({
    where: { id: matches[0].parentId },
    select: { id: true, email: true, deletedAt: true },
  })
  if (!parent || parent.deletedAt || !parent.email) return null

  return { parentUserId: parent.id, parentEmail: parent.email, playerId: matches[0].id }
}

/**
 * The other duplicate shape, for the parent adding a child who already signed
 * up on their own (2026-08-13). Self-registered means the row has its own
 * login AND is still its own guardian: `userId` set and `parentId === userId`.
 * Once a real parent is attached those two differ, and the kid is somebody's
 * already.
 */
export async function findSelfRegisteredMatches({
  firstName,
  lastName,
  birthYear,
}: {
  firstName: string
  lastName: string
  birthYear: number
}): Promise<NameMatch[]> {
  if (!firstName?.trim() || !lastName?.trim() || !Number.isInteger(birthYear)) return []

  const rows = await (prisma as any).player.findMany({
    where: {
      deletedAt: null,
      absorbedAt: null,
      userId: { not: null },
      firstName: { equals: firstName.trim(), mode: "insensitive" },
      lastName: { equals: lastName.trim(), mode: "insensitive" },
      dateOfBirth: {
        gte: new Date(Date.UTC(birthYear - 1, 11, 30)),
        lt: new Date(Date.UTC(birthYear + 1, 0, 2)),
      },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      dateOfBirth: true,
      parentId: true,
      userId: true,
    },
  })

  const asked = { firstName, lastName, dateOfBirth: new Date(birthYear, 0, 1) }
  return rows
    .filter((r: any) => r.parentId === r.userId && looksLikeSamePlayer(r, asked))
    .map((r: any) => ({
      id: r.id,
      firstName: r.firstName,
      lastName: r.lastName,
      dateOfBirth: r.dateOfBirth,
      parentId: r.parentId,
    }))
}

/**
 * The mirror image, used when a parent accepts a guardian invite: rows under
 * this parent that look like the kid who invited them. Offered as a one-tap
 * merge so a family never ends up with two of the same child.
 */
export async function findMergeCandidates(
  parentUserId: string,
  kid: { id: string; firstName: string; lastName: string; dateOfBirth: Date }
): Promise<Array<{ id: string; firstName: string; lastName: string }>> {
  const rows = await findClaimTargetByName({
    firstName: kid.firstName,
    lastName: kid.lastName,
    birthYear: new Date(kid.dateOfBirth).getFullYear(),
    parentUserId,
    excludePlayerId: kid.id,
  })
  return rows.map((r) => ({ id: r.id, firstName: r.firstName, lastName: r.lastName }))
}
