import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import {
  createOfferForPlayer,
  resolveOfferTerms,
  OfferCreationError,
} from "@/lib/offers/create-offer"
import { audit } from "@/lib/audit"

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

    // G2 (owner decision): offering to a player rostered at ANOTHER club is a
    // recruiting feature — allowed, but audited per offer.
    const rivalRosterSpots = await prisma.teamPlayer.findMany({
      where: {
        playerId: data.playerId,
        status: "ACTIVE",
        team: { tenantId: { not: team.tenantId } },
      },
      select: {
        team: {
          select: { id: true, name: true, tenantId: true, tenant: { select: { name: true } } },
        },
      },
    })

    // Resolve terms (template + explicit overrides) via the shared service
    const { terms } = await resolveOfferTerms(prisma, {
      tenantId: team.tenantId,
      templateId: data.templateId,
      overrides: {
        seasonFee: data.seasonFee,
        installments: data.installments,
        practiceSessions: data.practiceSessions,
        includesBall: data.includesBall,
        includesBag: data.includesBag,
        includesShoes: data.includesShoes,
        includesUniform: data.includesUniform,
        includesTracksuit: data.includesTracksuit,
      },
    })

    // Create the offer + notification + update signup status in a transaction
    const result = await prisma.$transaction(async (tx: any) => {
      const offer = await createOfferForPlayer(tx, {
        teamId: data.teamId,
        playerId: data.playerId,
        tryoutSignupId: data.tryoutSignupId,
        templateId: data.templateId,
        terms,
        message: data.message,
        expiresAt: new Date(data.expiresAt),
        player,
        clubName: team.tenant.name,
        teamName: team.name,
      })

      if (rivalRosterSpots.length > 0) {
        await audit(tx, {
          actorId: sessionInfo.realUserId,
          actorRole: user.roles[0].role,
          action: "OFFER_CROSS_CLUB_RECRUIT",
          resource: "Offer",
          resourceId: offer.id,
          tenantId: team.tenantId,
          metadata: {
            playerId: player.id,
            recruitedFrom: rivalRosterSpots.map((s: any) => ({
              tenantId: s.team.tenantId,
              clubName: s.team.tenant.name,
              teamName: s.team.name,
            })),
          },
          request,
        })
      }

      return offer
    })
    const offerData = terms

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

    return NextResponse.json({ success: true, id: result.id }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }
    if (error instanceof OfferCreationError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.code === "TEMPLATE_NOT_FOUND" ? 404 : 409 }
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
            select: {
              id: true,
              firstName: true,
              lastName: true,
              dateOfBirth: true,
              gender: true,
              position: true,
            },
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
            select: {
              id: true,
              firstName: true,
              lastName: true,
              dateOfBirth: true,
              gender: true,
              position: true,
            },
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
            select: {
              id: true,
              name: true,
              ageGroup: true,
              gender: true,
              tenant: { select: { name: true, currency: true } },
            },
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
