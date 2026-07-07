import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { acceptOffer, declineOffer, OfferResponseError } from "@/lib/offers/respond-to-offer"

export const dynamic = "force-dynamic"

const respondSchema = z.object({
  action: z.enum(["accept", "decline"]),
  // Multi-option offers: which package the family chose (required to accept)
  optionId: z.string().optional(),
  // Required when accepting (conditional on what's included)
  uniformSize: z.string().optional(),
  shoeSize: z.string().optional(),
  tracksuitSize: z.string().optional(),
  jerseyPref1: z.number().int().min(0).max(99).optional(),
  jerseyPref2: z.number().int().min(0).max(99).optional(),
  jerseyPref3: z.number().int().min(0).max(99).optional(),
})

/**
 * Get a single offer
 * GET /api/offers/[id]
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const offer = await prisma.offer.findUnique({
      where: { id: params.id },
      include: {
        team: {
          select: {
            id: true,
            name: true,
            ageGroup: true,
            gender: true,
            season: true,
            tenant: { select: { id: true, name: true } },
          },
        },
        player: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            parentId: true,
            dateOfBirth: true,
            gender: true,
            position: true,
          },
        },
        tryoutSignup: {
          select: { id: true, playerName: true, notes: true },
        },
        options: { orderBy: { sortOrder: "asc" } },
      },
    })

    if (!offer) {
      return NextResponse.json({ error: "Offer not found" }, { status: 404 })
    }

    // Verify access: must be the parent of the player OR club staff
    const isParent = offer.player.parentId === sessionInfo.userId
    const isClubStaff = await prisma.userRole.findFirst({
      where: {
        userId: sessionInfo.userId,
        OR: [
          { tenantId: offer.team.tenant.id, role: { in: ["ClubOwner", "ClubManager", "Staff"] } },
          { role: "PlatformAdmin" },
        ],
      },
    })

    if (!isParent && !isClubStaff) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    return NextResponse.json({
      ...offer,
      seasonFee: Number(offer.seasonFee),
      options: (offer as any).options.map((o: any) => ({
        ...o,
        seasonFee: Number(o.seasonFee),
      })),
    })
  } catch (error) {
    console.error("Get offer error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * Respond to an offer (accept or decline)
 * PATCH /api/offers/[id]
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const userId = sessionInfo.userId

    const body = await request.json()
    const data = respondSchema.parse(body)

    // Get the offer with player info
    const offer = await prisma.offer.findUnique({
      where: { id: params.id },
      include: {
        player: {
          select: { id: true, parentId: true, firstName: true, lastName: true },
        },
        team: {
          select: { id: true, name: true, tenantId: true, tenant: { select: { name: true, currency: true } } },
        },
        options: { orderBy: { sortOrder: "asc" } },
      },
    })

    if (!offer) {
      return NextResponse.json({ error: "Offer not found" }, { status: 404 })
    }

    // Only the parent can respond
    if (offer.player.parentId !== userId) {
      return NextResponse.json(
        { error: "Only the parent/guardian can respond to this offer" },
        { status: 403 }
      )
    }

    if (offer.status !== "PENDING") {
      return NextResponse.json(
        { error: `This offer has already been ${offer.status.toLowerCase()}` },
        { status: 400 }
      )
    }

    // Check if expired
    if (new Date(offer.expiresAt) < new Date()) {
      await prisma.offer.update({
        where: { id: params.id },
        data: { status: "EXPIRED" },
      })
      return NextResponse.json({ error: "This offer has expired" }, { status: 400 })
    }

    // Multi-option offer: the family's chosen package overwrites the
    // snapshot columns BEFORE acceptance, so gear validation, payments and
    // the Order Sheet all read the package they actually picked.
    const offerOptions: any[] = (offer as any).options ?? []
    if (data.action === "accept" && offerOptions.length > 0) {
      const chosen = data.optionId
        ? offerOptions.find((o) => o.id === data.optionId)
        : undefined
      if (!chosen) {
        return NextResponse.json(
          { error: "Choose a package to accept this offer" },
          { status: 400 }
        )
      }
      await prisma.offer.update({
        where: { id: params.id },
        data: {
          chosenOptionId: chosen.id,
          templateId: chosen.sourceTemplateId ?? offer.templateId,
          seasonFee: chosen.seasonFee,
          installments: chosen.installments,
          practiceSessions: chosen.practiceSessions,
          includesBall: chosen.includesBall,
          includesBag: chosen.includesBag,
          includesShoes: chosen.includesShoes,
          includesUniform: chosen.includesUniform,
          includesTracksuit: chosen.includesTracksuit,
        },
      })
      Object.assign(offer, {
        seasonFee: chosen.seasonFee,
        installments: chosen.installments,
        includesBall: chosen.includesBall,
        includesBag: chosen.includesBag,
        includesShoes: chosen.includesShoes,
        includesUniform: chosen.includesUniform,
        includesTracksuit: chosen.includesTracksuit,
      })
    }

    if (data.action === "accept") {
      const result = await acceptOffer(offer as any, data)
      return NextResponse.json({
        success: true,
        status: result.status,
        message: "Offer accepted! The player has been added to the team.",
      })
    } else {
      const result = await declineOffer(offer as any)
      return NextResponse.json({
        success: true,
        status: result.status,
        message: "Offer declined.",
      })
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }
    if (error instanceof OfferResponseError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 })
    }
    console.error("Respond to offer error:", error)
    const message = error instanceof Error ? error.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
