import { prisma } from "@youthbasketballhub/db"
import { isPayingMinor, isNudgeAge, ageByBirthYear } from "./minor"

/**
 * Who is this signed-in person, family-wise? (parent-child linking arc
 * 2026-08-12)
 *
 * One question answered in one place, because five payable routes and the
 * dashboard nudge all need the same three facts:
 *  - do they have a player profile they log into themselves (self-owned)?
 *  - is a real guardian attached, or are they still their own guardian?
 *  - are they under 18 by birth year, i.e. never the payer?
 *
 * Self-owned means `Player.userId === this account`. That covers both a kid
 * who signed up on their own and a parent-added kid who claimed a login. The
 * guardian question is separate: `Player.parentId` is the guardian AND payer
 * of record, and it points back at the kid themself until a real parent
 * accepts a link.
 */

export interface FamilyAccountContext {
  /** The player profile this account signs in as, if any. */
  player: {
    id: string
    firstName: string
    lastName: string
    dateOfBirth: Date
    parentId: string
    handle: string | null
  } | null
  /** A real guardian is attached (someone other than the account itself). */
  hasLinkedParent: boolean
  /** The guardian's user id, when one is attached. */
  parentUserId: string | null
  /** Under 18 by birth year — never their own payer. */
  isMinor: boolean
  /** 13-17: the audience for the standing link-your-parent nudge. */
  isNudgeAge: boolean
  age: number
}

const EMPTY: FamilyAccountContext = {
  player: null,
  hasLinkedParent: false,
  parentUserId: null,
  isMinor: false,
  isNudgeAge: false,
  age: 0,
}

export async function getFamilyAccountContext(userId: string): Promise<FamilyAccountContext> {
  const player = await (prisma as any).player.findFirst({
    where: { userId, deletedAt: null, absorbedAt: null },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      dateOfBirth: true,
      parentId: true,
      handle: true,
    },
  })
  if (!player) return EMPTY

  const dob = new Date(player.dateOfBirth)
  const hasLinkedParent = player.parentId !== userId
  return {
    player,
    hasLinkedParent,
    parentUserId: hasLinkedParent ? player.parentId : null,
    isMinor: isPayingMinor(dob),
    isNudgeAge: isNudgeAge(dob),
    age: ageByBirthYear(dob),
  }
}
