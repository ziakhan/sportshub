import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { notifySafe } from "@/lib/notifications"

export const dynamic = "force-dynamic"

/**
 * POST /api/offers/[id]/rescind — club withdraws a PENDING offer.
 *
 * Closes the biggest money-flow gap in the editability audit: a club that sent
 * wrong terms previously had NO remedy while the family could still accept
 * (minting the obligation + charging a deposit). RESCINDED is terminal, like
 * DECLINED/EXPIRED — no money has moved yet at PENDING, so nothing to unwind.
 *
 * Authz: ClubOwner/ClubManager of the offer's tenant, or PlatformAdmin.
 * (Deliberately NOT Staff — rescind is money-adjacent, matching waive/refund.)
 */
export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const offer = await (prisma as any).offer.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        status: true,
        player: { select: { id: true, firstName: true, parentId: true } },
        team: { select: { id: true, name: true, tenantId: true } },
      },
    })
    if (!offer) return NextResponse.json({ error: "Offer not found" }, { status: 404 })

    if (!sessionInfo.isPlatformAdmin) {
      const clubAdmin = await prisma.userRole.findFirst({
        where: {
          userId: sessionInfo.userId,
          tenantId: offer.team.tenantId,
          role: { in: ["ClubOwner", "ClubManager"] },
        },
      })
      if (!clubAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Only a live offer can be withdrawn — accepted/declined/expired are
    // terminal, and rescinding an ACCEPTED offer would orphan money/roster.
    if (offer.status !== "PENDING") {
      return NextResponse.json(
        { error: `Only pending offers can be rescinded (this one is ${offer.status.toLowerCase()})` },
        { status: 409 }
      )
    }

    // Guard the race against a concurrent family accept: the conditional
    // update only wins if the offer is still PENDING.
    const result = await (prisma as any).offer.updateMany({
      where: { id: params.id, status: "PENDING" },
      data: { status: "RESCINDED" },
    })
    if (result.count === 0) {
      return NextResponse.json(
        { error: "Offer was just responded to — refresh to see its current status" },
        { status: 409 }
      )
    }

    await notifySafe({
      userId: offer.player.parentId,
      type: "offer_rescinded",
      title: "An offer was withdrawn",
      message: `${offer.team.name} withdrew their offer for ${offer.player.firstName}.`,
      link: "/offers",
      referenceType: "Offer",
      referenceId: offer.id,
    })

    return NextResponse.json({ success: true, status: "RESCINDED" })
  } catch (error) {
    console.error("Rescind offer error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
