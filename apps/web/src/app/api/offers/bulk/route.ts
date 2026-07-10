import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import {
  createOfferForPlayer,
  offerPackageSchema,
  OfferCreationError,
} from "@/lib/offers/create-offer"
import { sendOfferEmail, appBaseUrl } from "@/lib/email"
import { audit } from "@/lib/audit"

export const dynamic = "force-dynamic"

const bulkOfferSchema = z.object({
  teamId: z.string(),
  signupIds: z.array(z.string()).min(1).max(100),
  options: z.array(offerPackageSchema).min(1).max(4),
  message: z.string().optional(),
  expiresAt: z.string().datetime(),
})

/**
 * POST /api/offers/bulk — one composed offer (with its package options),
 * sent to many tryout signups at once. Each recipient gets their own Offer
 * row; failures skip that player and report why instead of failing the
 * batch (already-offered, cancelled signup, no linked player profile).
 */
export async function POST(request: NextRequest) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const data = bulkOfferSchema.parse(await request.json())

    const team = await prisma.team.findUnique({
      where: { id: data.teamId },
      select: { id: true, tenantId: true, name: true, tenant: { select: { name: true } } },
    })
    if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 })

    const user = await prisma.user.findUnique({
      where: { id: sessionInfo.userId },
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

    // Signups must belong to a tryout of THIS team
    const signups = await (prisma as any).tryoutSignup.findMany({
      where: { id: { in: data.signupIds }, tryout: { teamId: data.teamId } },
      select: {
        id: true,
        status: true,
        userId: true,
        playerName: true,
        player: { select: { id: true, parentId: true, firstName: true, lastName: true } },
      },
    })

    // Signups made before the player profile existed carry only a name —
    // resolve them the same way the signups page does (parent + exact name)
    const unlinked = signups.filter((s: any) => !s.player)
    if (unlinked.length > 0) {
      const parentPlayers = await prisma.player.findMany({
        where: {
          parentId: { in: [...new Set(unlinked.map((s: any) => s.userId))] },
          deletedAt: null,
        } as any,
        select: { id: true, parentId: true, firstName: true, lastName: true },
      })
      for (const signup of unlinked) {
        signup.player =
          parentPlayers.find(
            (p: any) =>
              p.parentId === signup.userId &&
              `${p.firstName} ${p.lastName}` === signup.playerName
          ) ?? null
      }
    }
    const signupById = new Map(signups.map((s: any) => [s.id, s]))

    const {
      label: _l,
      sourceTemplateId,
      allowFullPay: _af,
      allowInstallments: _ai,
      depositAmount: _dep,
      installmentTerms: _it,
      ...firstTerms
    } = data.options[0]
    const expiresAt = new Date(data.expiresAt)

    // Cross-club recruiting audit (G2): one batched lookup for all players
    const playerIds = signups.filter((s: any) => s.player).map((s: any) => s.player.id)
    const rivalSpots =
      playerIds.length > 0
        ? await prisma.teamPlayer.findMany({
            where: {
              playerId: { in: playerIds },
              status: "ACTIVE",
              team: { tenantId: { not: team.tenantId } },
            },
            select: {
              playerId: true,
              team: {
                select: { id: true, name: true, tenantId: true, tenant: { select: { name: true } } },
              },
            },
          })
        : []
    const rivalsByPlayer = new Map<string, any[]>()
    for (const spot of rivalSpots) {
      const list = rivalsByPlayer.get(spot.playerId) ?? []
      list.push(spot)
      rivalsByPlayer.set(spot.playerId, list)
    }

    const sent: Array<{ signupId: string; offerId: string; parentId: string; playerName: string }> =
      []
    const skipped: Array<{ signupId: string; playerName: string | null; reason: string }> = []

    for (const signupId of data.signupIds) {
      const signup: any = signupById.get(signupId)
      if (!signup) {
        skipped.push({ signupId, playerName: null, reason: "Signup not found for this team" })
        continue
      }
      const playerName =
        signup.player
          ? `${signup.player.firstName} ${signup.player.lastName}`
          : signup.playerName
      if (!signup.player) {
        skipped.push({ signupId, playerName, reason: "No linked player profile" })
        continue
      }
      if (signup.status === "CANCELLED") {
        skipped.push({ signupId, playerName, reason: "Signup was cancelled" })
        continue
      }

      try {
        // Per-signup transaction: one bad row never sinks the batch
        const offer = await prisma.$transaction(async (tx: any) => {
          const created = await createOfferForPlayer(tx, {
            teamId: data.teamId,
            playerId: signup.player.id,
            tryoutSignupId: signup.id,
            templateId: sourceTemplateId ?? null,
            terms: firstTerms,
            options: data.options,
            message: data.message,
            expiresAt,
            player: signup.player,
            clubName: team.tenant.name,
            teamName: team.name,
          })
          const rivals = rivalsByPlayer.get(signup.player.id) ?? []
          if (rivals.length > 0) {
            await audit(tx, {
              actorId: sessionInfo.realUserId,
              actorRole: user.roles[0].role,
              action: "OFFER_CROSS_CLUB_RECRUIT",
              resource: "Offer",
              resourceId: created.id,
              tenantId: team.tenantId,
              metadata: {
                playerId: signup.player.id,
                recruitedFrom: rivals.map((s: any) => ({
                  tenantId: s.team.tenantId,
                  clubName: s.team.tenant.name,
                  teamName: s.team.name,
                })),
              },
              request,
            })
          }
          return created
        })
        sent.push({
          signupId,
          offerId: offer.id,
          parentId: signup.player.parentId,
          playerName,
        })
      } catch (error) {
        if (error instanceof OfferCreationError) {
          skipped.push({
            signupId,
            playerName,
            reason:
              error.code === "DUPLICATE_PENDING_OFFER"
                ? "Already has a pending offer"
                : error.message,
          })
        } else {
          console.error("Bulk offer row error:", error)
          skipped.push({ signupId, playerName, reason: "Failed — try individually" })
        }
      }
    }

    // Emails after the writes, best-effort
    if (sent.length > 0) {
      const parents = await prisma.user.findMany({
        where: { id: { in: [...new Set(sent.map((s) => s.parentId))] } },
        select: { id: true, email: true, firstName: true },
      })
      const parentById = new Map(parents.map((p: any) => [p.id, p]))
      await Promise.allSettled(
        sent.map((row) => {
          const parent: any = parentById.get(row.parentId)
          if (!parent?.email) return Promise.resolve()
          return sendOfferEmail({
            to: parent.email,
            parentName: parent.firstName || "Parent",
            playerName: row.playerName,
            clubName: team.tenant.name,
            teamName: team.name,
            seasonFee: firstTerms.seasonFee,
            packages:
              data.options.length > 1
                ? data.options.map((o) => ({ label: o.label, fee: o.seasonFee }))
                : undefined,
            message: data.message,
            offerLink: `${appBaseUrl()}/offers`,
          })
        })
      )
    }

    return NextResponse.json({ sent: sent.length, skipped }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    console.error("Bulk offer error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
