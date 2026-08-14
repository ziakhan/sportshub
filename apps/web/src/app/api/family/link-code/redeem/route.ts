import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { notifySafe } from "@/lib/notifications"
import { getFamilyAccountContext } from "@/lib/family/account-context"
import { findMergeCandidates } from "@/lib/family/claim-target"
import { linkGuardianToPlayer } from "@/lib/family/link-guardian"
import { normalizeLinkCode } from "@/lib/family/link-code"

export const dynamic = "force-dynamic"

/**
 * POST /api/family/link-code/redeem — the other half of the kitchen-table
 * handoff (parent-child linking arc 2026-08-13).
 *
 * Contract:
 *   body { code: "K7M2QX" }   (spaces, dashes and lowercase all fine)
 *   200  { linked: true, playerId, direction, mergeCandidate?: { id, name } }
 *   400  { error: "That code did not work. Check it and try again." }
 *   401  { error } — signed out
 *
 * Handing the code over IS the consent — the two people are standing
 * together — so this links on the spot. No approval round trip, and the same
 * end state as accepting a GUARDIAN invitation: Player.parentId becomes the
 * guardian and payer of record, and they hold the Parent role.
 *
 * Every failure returns the same 400 and the same sentence. Expired, spent,
 * never existed, your own, meant for the other kind of account: telling them
 * apart would turn this endpoint into a way to probe six-character codes.
 *
 * A merge is never automatic. If the parent already has a row for this kid,
 * the link is made and the duplicate comes back as `mergeCandidate` for the
 * UI to offer, because collapsing two children into one is a decision a
 * person makes, not a side effect of typing a code.
 */

const GENERIC = "That code did not work. Check it and try again."
const fail = () => NextResponse.json({ error: GENERIC }, { status: 400 })

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionUserId()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const code = normalizeLinkCode(body?.code)
    if (code.length < 4) return fail()

    const row = await (prisma as any).familyLinkCode.findUnique({
      where: { code },
      select: {
        id: true,
        direction: true,
        playerId: true,
        createdByUserId: true,
        expiresAt: true,
        usedAt: true,
      },
    })
    if (!row) return fail()
    if (row.usedAt) return fail()
    if (new Date(row.expiresAt) < new Date()) return fail()
    if (row.createdByUserId === session.userId) return fail()

    const ctx = await getFamilyAccountContext(session.userId)

    // Who ends up as the guardian, and which player row gets one. The
    // redeemer must be the opposite party: a kid's code needs an adult
    // account to redeem it, a parent's code needs the kid's own login.
    let kidPlayerId: string
    let parentUserId: string
    if (row.direction === "CHILD_INVITES_PARENT") {
      if (!row.playerId) return fail()
      // A minor cannot be somebody else's guardian.
      if (ctx.player && ctx.isMinor) return fail()

      const kid = await (prisma as any).player.findFirst({
        where: { id: row.playerId, deletedAt: null, absorbedAt: null },
        select: { id: true, parentId: true, userId: true },
      })
      if (!kid) return fail()
      // Somebody already looks after them (parentId still points at the kid
      // while they are their own guardian).
      if (kid.parentId !== kid.userId) return fail()

      kidPlayerId = kid.id
      parentUserId = session.userId
    } else {
      if (!ctx.player || ctx.hasLinkedParent) return fail()
      kidPlayerId = ctx.player.id
      parentUserId = row.createdByUserId
    }

    const kid = await (prisma as any).player.findUnique({
      where: { id: kidPlayerId },
      select: { id: true, firstName: true, lastName: true, dateOfBirth: true },
    })
    if (!kid) return fail()

    await prisma.$transaction(async (tx: any) => {
      // Single use, decided by the database: two people typing the same code
      // at the same moment cannot both win.
      const claimed = await tx.familyLinkCode.updateMany({
        where: { id: row.id, usedAt: null },
        data: { usedAt: new Date(), usedByUserId: session.userId },
      })
      if (claimed.count !== 1) throw new Error("CODE_ALREADY_USED")

      await linkGuardianToPlayer(tx, { playerId: kidPlayerId, parentUserId })
    })

    // Two of the same child under one roof: link first, offer the merge
    // after. The code the parent made may already name the row they meant,
    // so that one leads.
    const candidates = await findMergeCandidates(parentUserId, kid)
    const top = candidates.find((c) => c.id === row.playerId) ?? candidates[0] ?? null
    // Same shape the accept page's merge offer already reads.
    const mergeCandidate = top ? { id: top.id, name: `${top.firstName} ${top.lastName}` } : null

    const [me, creator] = await Promise.all([
      prisma.user.findUnique({
        where: { id: session.userId },
        select: { firstName: true, lastName: true, email: true },
      }),
      prisma.user.findUnique({ where: { id: row.createdByUserId }, select: { id: true } }),
    ])
    const meName =
      [me?.firstName, me?.lastName].filter(Boolean).join(" ") || me?.email || "Someone"

    if (creator) {
      await notifySafe({
        userId: creator.id,
        type: "family_linked",
        title: `You are now linked with ${meName}`,
        message: `You are now linked with ${meName}. Not you? You can remove this from your family settings.`,
        link: "/dashboard",
        referenceId: row.id,
        referenceType: "FamilyLinkCode",
      })
    }

    return NextResponse.json({
      linked: true,
      playerId: kidPlayerId,
      direction: row.direction,
      ...(mergeCandidate ? { mergeCandidate } : {}),
    })
  } catch (error: any) {
    if (error?.message === "CODE_ALREADY_USED") return fail()
    console.error("Family link code redeem error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
