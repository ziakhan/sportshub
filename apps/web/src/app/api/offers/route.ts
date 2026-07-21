import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { canActOnTeam, actorRoleAtTenant, isClubAdmin, coachedTeamIds } from "@/lib/authz/team-scope"
import { z } from "zod"
import {
  createOfferForPlayer,
  offerPackageSchema,
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
  // Package choices (composer sends these; overrides above are the legacy
  // single-package shape and are ignored when options are present)
  options: z.array(offerPackageSchema).min(1).max(4).optional(),
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

    // Security fix 2026-07-20: admins send offers for any team; Staff only
    // for a team their role row actually references (was tenant-wide).
    if (!(await canActOnTeam(userId, team.tenantId, team.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    const actorRole = await actorRoleAtTenant(userId, team.tenantId)

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

    // Resolve terms: package options (first option = pending-display
    // snapshot) or the legacy single template + overrides shape
    let terms: Awaited<ReturnType<typeof resolveOfferTerms>>["terms"]
    let templateId: string | null | undefined = data.templateId
    if (data.options && data.options.length > 0) {
      const {
      label: _l,
      sourceTemplateId,
      allowFullPay: _af,
      allowInstallments: _ai,
      depositAmount: _dep,
      installmentTerms: _it,
      ...firstTerms
    } = data.options[0]
      terms = firstTerms
      templateId = sourceTemplateId ?? null
    } else {
      const resolved = await resolveOfferTerms(prisma, {
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
      terms = resolved.terms
    }

    // Create the offer + notification + update signup status in a transaction
    const result = await prisma.$transaction(async (tx: any) => {
      const offer = await createOfferForPlayer(tx, {
        teamId: data.teamId,
        playerId: data.playerId,
        tryoutSignupId: data.tryoutSignupId,
        templateId,
        terms,
        options: data.options,
        message: data.message,
        expiresAt: new Date(data.expiresAt),
        player,
        clubName: team.tenant.name,
        teamName: team.name,
      })

      if (rivalRosterSpots.length > 0) {
        await audit(tx, {
          actorId: sessionInfo.realUserId,
          actorRole,
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
        const { sendOfferEmail, appBaseUrl } = await import("@/lib/email")
        await sendOfferEmail({
          to: parent.email,
          parentName: parent.firstName || "Parent",
          playerName: `${player.firstName} ${player.lastName}`,
          clubName: team.tenant.name,
          teamName: team.name,
          seasonFee: Number(offerData.seasonFee),
          packages:
            data.options && data.options.length > 1
              ? data.options.map((o) => ({ label: o.label, fee: o.seasonFee }))
              : undefined,
          message: data.message,
          offerLink: `${appBaseUrl()}/offers`,
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
    // getSessionUserId (not raw getServerSession) so the native app's bearer
    // tokens work here — this GET is the app's family offers list (M4).
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const userId = sessionInfo.userId

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

      // Security fix 2026-07-20: a coach may read only their own team's
      // offers (was any tenant Staff → any team's recruiting pipeline).
      if (!(await canActOnTeam(userId, team.tenantId, teamId))) {
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
        // Grows every season — cap the payload (gap-audit P1 #18)
        take: 500,
      })

      return NextResponse.json({ offers: offers.map(simplifyOffer) })
    }

    if (tenantId) {
      // Club-side: offers across teams. Security fix 2026-07-20: admins see
      // the whole club; a coach sees ONLY their own team's offers.
      const admin = await isClubAdmin(userId, tenantId)
      let offerWhere: any
      if (admin) {
        offerWhere = { team: { tenantId } }
      } else {
        const myTeamIds = await coachedTeamIds(userId, tenantId)
        if (myTeamIds.length === 0) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        }
        offerWhere = { team: { tenantId }, teamId: { in: myTeamIds } }
      }

      const offers = await prisma.offer.findMany({
        where: offerWhere,
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
        // Grows every season — cap the payload (gap-audit P1 #18)
        take: 500,
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
          options: { orderBy: { sortOrder: "asc" } },
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
    ...(offer.options
      ? { options: offer.options.map((o: any) => ({ ...o, seasonFee: Number(o.seasonFee) })) }
      : {}),
  }
}
