import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"

export const dynamic = "force-dynamic"

const createOfferSchema = z.object({
  teamId: z.string(),
  playerId: z.string(),
  tryoutSignupId: z.string().optional(),
  templateId: z.string().optional(),
  // These can override template values
  seasonFee: z.number().min(0).optional(),
  installments: z.number().min(1).max(12).optional(),
  practiceSessions: z.number().min(0).optional(),
  includesBall: z.boolean().optional(),
  includesBag: z.boolean().optional(),
  includesShoes: z.boolean().optional(),
  includesUniform: z.boolean().optional(),
  includesTracksuit: z.boolean().optional(),
  message: z.string().optional(),
  expiresAt: z.string().datetime(),
})

/**
 * Create an offer
 * POST /api/offers
 */
export async function POST(request: NextRequest) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const userId = sessionInfo.userId

    const body = await request.json()
    const data = createOfferSchema.parse(body)

    // Get the team and verify club permissions
    const team = await prisma.team.findUnique({
      where: { id: data.teamId },
      select: { id: true, tenantId: true, name: true, tenant: { select: { name: true } } },
    })

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 })
    }

    // Verify user has permission (ClubOwner, ClubManager, Staff, or PlatformAdmin)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          where: {
            OR: [
              { tenantId: team.tenantId, role: { in: ["ClubOwner", "ClubManager", "Staff"] } },
              { role: "PlatformAdmin" },
            ],
          },
        },
      },
    })

    if (!user || user.roles.length === 0) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Verify the player exists
    const player = await prisma.player.findUnique({
      where: { id: data.playerId },
      select: { id: true, parentId: true, firstName: true, lastName: true },
    })

    if (!player) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 })
    }

    // Check for existing pending offer for this player on this team
    const existingOffer = await prisma.offer.findFirst({
      where: {
        teamId: data.teamId,
        playerId: data.playerId,
        status: "PENDING",
      },
    })

    if (existingOffer) {
      return NextResponse.json(
        { error: "A pending offer already exists for this player on this team" },
        { status: 409 }
      )
    }

    // Load template if provided
    let templateValues = {
      seasonFee: 0,
      installments: 1,
      practiceSessions: 0,
      includesBall: false,
      includesBag: false,
      includesShoes: false,
      includesUniform: false,
      includesTracksuit: false,
    }

    if (data.templateId) {
      const template = await prisma.offerTemplate.findFirst({
        where: { id: data.templateId, tenantId: team.tenantId, isActive: true },
      })
      if (!template) {
        return NextResponse.json({ error: "Template not found" }, { status: 404 })
      }
      templateValues = {
        seasonFee: Number(template.seasonFee),
        installments: template.installments,
        practiceSessions: template.practiceSessions,
        includesBall: template.includesBall,
        includesBag: template.includesBag,
        includesShoes: template.includesShoes,
        includesUniform: template.includesUniform,
        includesTracksuit: template.includesTracksuit,
      }
    }

    // Merge: explicit values override template defaults
    const offerData = {
      seasonFee: data.seasonFee ?? templateValues.seasonFee,
      installments: data.installments ?? templateValues.installments,
      practiceSessions: data.practiceSessions ?? templateValues.practiceSessions,
      includesBall: data.includesBall ?? templateValues.includesBall,
      includesBag: data.includesBag ?? templateValues.includesBag,
      includesShoes: data.includesShoes ?? templateValues.includesShoes,
      includesUniform: data.includesUniform ?? templateValues.includesUniform,
      includesTracksuit: data.includesTracksuit ?? templateValues.includesTracksuit,
    }

    // Create the offer + notification + update signup status in a transaction
    const result = await prisma.$transaction(async (tx: any) => {
      const offer = await tx.offer.create({
        data: {
          teamId: data.teamId,
          playerId: data.playerId,
          tryoutSignupId: data.tryoutSignupId || null,
          templateId: data.templateId || null,
          ...offerData,
          message: data.message || null,
          expiresAt: new Date(data.expiresAt),
        },
      })

      // Update tryout signup status to OFFERED
      if (data.tryoutSignupId) {
        await tx.tryoutSignup.update({
          where: { id: data.tryoutSignupId },
          data: { status: "OFFERED" },
        })
      }

      // Create notification for the parent
      await tx.notification.create({
        data: {
          userId: player.parentId,
          type: "offer_received",
          title: "New Team Offer",
          message: `${team.tenant.name} has sent an offer for ${player.firstName} ${player.lastName} to join ${team.name}.`,
          link: `/offers`,
          referenceId: offer.id,
          referenceType: "Offer",
        },
      })

      return offer
    })

    // Send email notification (don't fail if email fails)
    try {
      const parent = await prisma.user.findUnique({
        where: { id: player.parentId },
        select: { email: true, firstName: true },
      })
      if (parent?.email) {
        const { sendOfferEmail } = await import("@/lib/email")
        await sendOfferEmail({
          to: parent.email,
          parentName: parent.firstName || "Parent",
          playerName: `${player.firstName} ${player.lastName}`,
          clubName: team.tenant.name,
          teamName: team.name,
          seasonFee: Number(offerData.seasonFee),
          message: data.message,
          offerLink: `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/offers`,
        })
      }
    } catch (emailError) {
      console.error("Failed to send offer email:", emailError)
    }

    return NextResponse.json(
      { success: true, id: result.id },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }
    console.error("Create offer error:", error)
    const message = error instanceof Error ? error.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * List offers
 * GET /api/offers?teamId=xxx (club-side: offers sent by team)
 * GET /api/offers?mine=true (parent-side: offers received for my players)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const userId = session.user.id

    const searchParams = request.nextUrl.searchParams
    const teamId = searchParams.get("teamId")
    const mine = searchParams.get("mine") === "true"
    const tenantId = searchParams.get("tenantId")

    if (teamId) {
      // Club-side: get offers for a specific team
      const team = await prisma.team.findUnique({
        where: { id: teamId },
        select: { tenantId: true },
      })
      if (!team) {
        return NextResponse.json({ error: "Team not found" }, { status: 404 })
      }

      // Verify club permission
      const hasAccess = await prisma.userRole.findFirst({
        where: {
          userId,
          OR: [
            { tenantId: team.tenantId, role: { in: ["ClubOwner", "ClubManager", "Staff"] } },
            { role: "PlatformAdmin" },
          ],
        },
      })
      if (!hasAccess) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }

      const offers = await prisma.offer.findMany({
        where: { teamId },
        include: {
          player: {
            select: { id: true, firstName: true, lastName: true, dateOfBirth: true, gender: true, position: true },
          },
          tryoutSignup: {
            select: { id: true, playerName: true, notes: true },
          },
        },
        orderBy: { createdAt: "desc" },
      })

      return NextResponse.json({ offers: offers.map(simplifyOffer) })
    }

    if (tenantId) {
      // Club-side: get all offers for a tenant (across all teams)
      const hasAccess = await prisma.userRole.findFirst({
        where: {
          userId,
          OR: [
            { tenantId, role: { in: ["ClubOwner", "ClubManager", "Staff"] } },
            { role: "PlatformAdmin" },
          ],
        },
      })
      if (!hasAccess) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }

      const offers = await prisma.offer.findMany({
        where: { team: { tenantId } },
        include: {
          team: { select: { id: true, name: true } },
          player: {
            select: { id: true, firstName: true, lastName: true, dateOfBirth: true, gender: true, position: true },
          },
          tryoutSignup: {
            select: { id: true, playerName: true, notes: true },
          },
        },
        orderBy: { createdAt: "desc" },
      })

      return NextResponse.json({ offers: offers.map(simplifyOffer) })
    }

    if (mine) {
      // Parent-side: get offers for my players
      const players = await prisma.player.findMany({
        where: { parentId: userId },
        select: { id: true },
      })
      const playerIds = players.map((p: any) => p.id)

      if (playerIds.length === 0) {
        return NextResponse.json({ offers: [] })
      }

      const offers = await prisma.offer.findMany({
        where: { playerId: { in: playerIds } },
        include: {
          team: {
            select: { id: true, name: true, ageGroup: true, gender: true, tenant: { select: { name: true, currency: true } } },
          },
          player: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
        orderBy: { createdAt: "desc" },
      })

      return NextResponse.json({ offers: offers.map(simplifyOffer) })
    }

    return NextResponse.json(
      { error: "Either teamId, tenantId, or mine=true parameter is required" },
      { status: 400 }
    )
  } catch (error) {
    console.error("Get offers error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Simplify Decimal fields for JSON serialization
function simplifyOffer(offer: any) {
  return {
    ...offer,
    seasonFee: Number(offer.seasonFee),
  }
}
