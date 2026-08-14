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
 * accept path has always run rather than a second version of it:
 *  - the caller must be able to act for the source (guardian, or its own
 *    login) AND the target must be one of the caller's own player rows;
 *  - inside the transaction absorbIntoGuardianRow re-asks, so a row that
 *    changed hands in between cannot be swept up;
 *  - and the two rows must still look like the same person by name and birth
 *    year, so a parent cannot merge two different children by mistyping.
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

    // The survivor has to be the caller's own row, live. This is the same
    // test findMergeCandidates applies when it offers the merge.
    if (target.deletedAt || target.absorbedAt || target.parentId !== session.userId) {
      return forbidden()
    }

    if (source.id === target.id) {
      return NextResponse.json({ error: "Those are already the same profile" }, { status: 409 })
    }

    // Tapping the button twice on a slow phone is not an error: if this exact
    // merge already happened, say so again. Safe to answer because the
    // survivor is already known to be the caller's.
    if (source.absorbedAt && source.absorbedIntoPlayerId === target.id) {
      return NextResponse.json({ merged: true, survivingPlayerId: target.id })
    }

    if (source.deletedAt || source.absorbedAt) return forbidden()
    if (!(await canActForPlayer(session.userId, source.id))) return forbidden()

    // Both rows are theirs, so the answer from here on can be specific.
    if (!looksLikeSamePlayer(source, target)) {
      return NextResponse.json(
        { error: "Those two profiles are not the same player, so we left them alone" },
        { status: 409 }
      )
    }

    await prisma.$transaction(async (tx: any) => {
      await absorbIntoGuardianRow(tx, {
        actorUserId: session.userId,
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
