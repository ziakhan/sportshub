import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { canActForPlayer } from "@/lib/authz/player-scope"
import { absorbIntoGuardianRow, looksLikeSamePlayer } from "@/lib/family/merge-players"

export const dynamic = "force-dynamic"

/**
 * POST /api/family/merge — apply the merge a link already offered
 * (parent-child linking arc 2026-08-13).
 *
 * Contract:
 *   body { sourcePlayerId, targetPlayerId }
 *   200  { merged: true, survivingPlayerId }
 *   403  { error: "Those profiles are not both yours." }
 *   409  { error } — the two rows are not the same person, or somebody else
 *        already signs in to the survivor
 *   401  { error } — signed out
 *
 * The one place a family says "yes, those two are the same kid". Linking
 * never merges on its own: the link-code redemption and the guardian invite
 * both hand back a `mergeCandidate` and stop there, because collapsing two
 * children into one is a decision a person makes. This is where that tap
 * lands.
 *
 * `targetPlayerId` survives and keeps the history; `sourcePlayerId` is
 * absorbed, soft-deleted, and its login moves to the survivor.
 *
 * Authorization is the whole endpoint, so it reuses the guard the invitation
 * accept path has always run rather than a second version of it. Two callers
 * are allowed, and only two:
 *  - the guardian who holds the survivor and can act for the duplicate;
 *  - the kid who signs in to the duplicate, once a real guardian is attached
 *    to it and that same guardian holds the survivor. This is the shape a
 *    PARENT_INVITES_CHILD redemption leaves behind, and the kid is the one
 *    giving something up, so they get to say yes to it. No link yet, or a
 *    different household on the other row, means no merge.
 * Then:
 *  - inside the transaction absorbIntoGuardianRow re-asks, so a row that
 *    changed hands in between cannot be swept up (for a kid caller the
 *    source row is re-read too, so the guardian it names is the current one);
 *  - and the two rows must still look like the same person by name and birth
 *    year, so nobody can merge two different children by mistyping.
 * Every entitlement failure gives the same 403 and the same sentence.
 */

const mergeSchema = z.object({
  sourcePlayerId: z.string(),
  targetPlayerId: z.string(),
})

const NOT_YOURS = "Those profiles are not both yours."
const forbidden = () => NextResponse.json({ error: NOT_YOURS }, { status: 403 })

const PLAYER_FIELDS = {
  id: true,
  firstName: true,
  lastName: true,
  dateOfBirth: true,
  parentId: true,
  userId: true,
  deletedAt: true,
  absorbedAt: true,
  absorbedIntoPlayerId: true,
} as const

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionUserId()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const data = mergeSchema.parse(await request.json().catch(() => ({})))

    const [source, target] = await Promise.all([
      (prisma as any).player.findUnique({
        where: { id: data.sourcePlayerId },
        select: PLAYER_FIELDS,
      }),
      (prisma as any).player.findUnique({
        where: { id: data.targetPlayerId },
        select: PLAYER_FIELDS,
      }),
    ])
    if (!source || !target) return forbidden()

    // The survivor has to be live and unabsorbed, whoever is asking.
    if (target.deletedAt || target.absorbedAt) return forbidden()

    // Tapping the button twice on a slow phone is not an error: if this exact
    // merge already happened, say so again. Answerable by either side, since
    // after the merge the survivor carries the parent AND the kid's login.
    if (source.absorbedAt && source.absorbedIntoPlayerId === target.id) {
      const holdsSurvivor =
        target.parentId === session.userId || target.userId === session.userId
      if (!holdsSurvivor) return forbidden()
      return NextResponse.json({ merged: true, survivingPlayerId: target.id })
    }

    if (source.deletedAt || source.absorbedAt) return forbidden()

    // Two people may ask, and only these two.
    //
    // The guardian holding both rows: the ordinary case, a parent tidying up
    // after a link.
    const asGuardian =
      target.parentId === session.userId && (await canActForPlayer(session.userId, source.id))

    // The kid giving up their own duplicate. After redeeming a parent's link
    // code they hold the login on the source row but the survivor is the
    // parent's, so the guardian test above can never pass for them. Narrow on
    // purpose: it has to be their own login row, a real guardian has to be
    // attached already, and it has to be the SAME guardian who holds the
    // survivor. No link yet means no merge.
    const asLinkedKid =
      source.userId === session.userId &&
      source.parentId !== session.userId &&
      source.parentId === target.parentId

    if (!asGuardian && !asLinkedKid) return forbidden()

    if (source.id === target.id) {
      return NextResponse.json({ error: "Those are already the same profile" }, { status: 409 })
    }

    // Both rows are theirs, so the answer from here on can be specific.
    if (!looksLikeSamePlayer(source, target)) {
      return NextResponse.json(
        { error: "Those two profiles are not the same player, so we left them alone" },
        { status: 409 }
      )
    }

    await prisma.$transaction(async (tx: any) => {
      // Whose row the survivor must be. The guardian answers for themself; a
      // kid answers for the guardian they are linked to, re-read here so a
      // household that changed between the check and the write cannot be
      // swept up.
      let guardianUserId = session.userId
      if (!asGuardian) {
        const fresh = await tx.player.findUnique({
          where: { id: source.id },
          select: { userId: true, parentId: true, deletedAt: true, absorbedAt: true },
        })
        if (
          !fresh ||
          fresh.deletedAt ||
          fresh.absorbedAt ||
          fresh.userId !== session.userId ||
          fresh.parentId === session.userId
        ) {
          throw new Error("CLAIM_TARGET_NOT_YOURS")
        }
        guardianUserId = fresh.parentId
      }

      await absorbIntoGuardianRow(tx, {
        actorUserId: session.userId,
        guardianUserId,
        source: { id: source.id, userId: source.userId },
        targetId: target.id,
        loginUserId: source.userId,
      })
    })

    return NextResponse.json({ merged: true, survivingPlayerId: target.id })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    if (error?.message === "CLAIM_TARGET_GONE" || error?.message === "CLAIM_TARGET_NOT_YOURS") {
      return forbidden()
    }
    if (error?.message === "CLAIM_TARGET_TAKEN") {
      return NextResponse.json({ error: "Someone already signs in to that profile" }, { status: 409 })
    }
    console.error("Family merge error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
