import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"

export const dynamic = "force-dynamic"

const respondSchema = z.object({
  action: z.enum(["accept", "decline"]),
  // Required when accepting
  uniformSize: z.string().optional(),
  jerseyPref1: z.number().int().min(0).max(99).optional(),
  jerseyPref2: z.number().int().min(0).max(99).optional(),
  jerseyPref3: z.number().int().min(0).max(99).optional(),
})

/**
 * Get a single offer
 * GET /api/offers/[id]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const offer = await prisma.offer.findUnique({
      where: { id: params.id },
      include: {
        team: {
          select: {
            id: true, name: true, ageGroup: true, gender: true, season: true,
            tenant: { select: { id: true, name: true } },
          },
        },
        player: {
          select: {
            id: true, firstName: true, lastName: true, parentId: true,
            dateOfBirth: true, gender: true, position: true,
          },
        },
        tryoutSignup: {
          select: { id: true, playerName: true, notes: true },
        },
      },
    })

    if (!offer) {
      return NextResponse.json({ error: "Offer not found" }, { status: 404 })
    }

    // Verify access: must be the parent of the player OR club staff
    const isParent = offer.player.parentId === session.user.id
    const isClubStaff = await prisma.userRole.findFirst({
      where: {
        userId: session.user.id,
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
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const userId = session.user.id

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
          select: { id: true, name: true, tenantId: true, tenant: { select: { name: true } } },
        },
      },
    })

    if (!offer) {
      return NextResponse.json({ error: "Offer not found" }, { status: 404 })
    }

    // Only the parent can respond
    if (offer.player.parentId !== userId) {
      return NextResponse.json({ error: "Only the parent/guardian can respond to this offer" }, { status: 403 })
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

    if (data.action === "accept") {
      // Validate required fields on acceptance
      if (!data.uniformSize) {
        return NextResponse.json(
          { error: "Uniform size is required when accepting an offer" },
          { status: 400 }
        )
      }
      if (data.jerseyPref1 === undefined) {
        return NextResponse.json(
          { error: "At least one jersey number preference is required" },
          { status: 400 }
        )
      }

      const result = await prisma.$transaction(async (tx) => {
        // Update the offer
        const updated = await tx.offer.update({
          where: { id: params.id },
          data: {
            status: "ACCEPTED",
            uniformSize: data.uniformSize,
            jerseyPref1: data.jerseyPref1,
            jerseyPref2: data.jerseyPref2 ?? null,
            jerseyPref3: data.jerseyPref3 ?? null,
            respondedAt: new Date(),
          },
        })

        // Create TeamPlayer record (player joins the team)
        await tx.teamPlayer.upsert({
          where: {
            teamId_playerId: {
              teamId: offer.teamId,
              playerId: offer.playerId,
            },
          },
          create: {
            teamId: offer.teamId,
            playerId: offer.playerId,
            uniformSize: data.uniformSize,
            status: "ACTIVE",
          },
          update: {
            status: "ACTIVE",
            uniformSize: data.uniformSize,
          },
        })

        // Notify the club
        const clubOwner = await tx.userRole.findFirst({
          where: {
            tenantId: offer.team.tenantId,
            role: { in: ["ClubOwner", "ClubManager"] },
          },
          select: { userId: true },
        })

        if (clubOwner) {
          await tx.notification.create({
            data: {
              userId: clubOwner.userId,
              type: "offer_accepted",
              title: "Offer Accepted",
              message: `${offer.player.firstName} ${offer.player.lastName} has accepted the offer to join ${offer.team.name}.`,
              link: `/clubs/${offer.team.tenantId}/offers`,
              referenceId: updated.id,
              referenceType: "Offer",
            },
          })
        }

        return updated
      })

      return NextResponse.json({
        success: true,
        status: result.status,
        message: "Offer accepted! The player has been added to the team.",
      })
    } else {
      // Decline
      const result = await prisma.$transaction(async (tx) => {
        const updated = await tx.offer.update({
          where: { id: params.id },
          data: {
            status: "DECLINED",
            respondedAt: new Date(),
          },
        })

        // Notify the club
        const clubOwner = await tx.userRole.findFirst({
          where: {
            tenantId: offer.team.tenantId,
            role: { in: ["ClubOwner", "ClubManager"] },
          },
          select: { userId: true },
        })

        if (clubOwner) {
          await tx.notification.create({
            data: {
              userId: clubOwner.userId,
              type: "offer_declined",
              title: "Offer Declined",
              message: `${offer.player.firstName} ${offer.player.lastName} has declined the offer to join ${offer.team.name}.`,
              link: `/clubs/${offer.team.tenantId}/offers`,
              referenceId: updated.id,
              referenceType: "Offer",
            },
          })
        }

        return updated
      })

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
    console.error("Respond to offer error:", error)
    const message = error instanceof Error ? error.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
