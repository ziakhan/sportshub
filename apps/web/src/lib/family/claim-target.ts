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

  const candidates = await (prisma as any).player.findMany({
    where: {
      parentId: parent.id,
      deletedAt: null,
      absorbedAt: null,
      // A row somebody already signs in as is not claimable.
      userId: null,
      id: { not: kid.id },
    },
    select: { id: true, firstName: true, lastName: true, dateOfBirth: true },
  })

  const match = candidates.find((c: any) => looksLikeSamePlayer(c, kid))
  if (!match) return null

  return { parentUserId: parent.id, playerId: match.id, playerFirstName: match.firstName }
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
  const rows = await (prisma as any).player.findMany({
    where: {
      parentId: parentUserId,
      deletedAt: null,
      absorbedAt: null,
      userId: null,
      id: { not: kid.id },
    },
    select: { id: true, firstName: true, lastName: true, dateOfBirth: true },
  })
  return rows.filter((r: any) => looksLikeSamePlayer(r, kid))
}
