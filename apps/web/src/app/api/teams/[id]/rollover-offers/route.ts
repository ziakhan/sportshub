import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { getSessionUserId } from "@/lib/auth-helpers"
import {
  createOfferForPlayer,
  resolveOfferTerms,
  OfferCreationError,
} from "@/lib/offers/create-offer"

export const dynamic = "force-dynamic"

/**
 * Carry-over offers — the one-click "Send all" from the Start-next-season
 * wizard (docs/season-continuity-plan.md §2, owner decision: offers are
 * STAGED in the wizard and created here in one click).
 *
 * POST /api/teams/[id]/rollover-offers — [id] is the NEW team. For each
 * returning player, mint an offer through the existing rail
 * (createOfferForPlayer → parent bell + offer email). Per-player failures
 * (duplicate pending offer, missing player) surface as skips, not failures.
 */

const rolloverOffersSchema = z.object({
  // Seed ids aren't UUIDs — keep z.string()
  playerIds: z.array(z.string()).min(1).max(100),
  templateId: z.string().optional(),
  seasonFee: z.number().min(0).optional(),
  installments: z.number().int().min(1).max(12).optional(),
  expiresInDays: z.number().int().min(1).max(90).optional().default(14),
})

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const team = await prisma.team.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        tenantId: true,
        name: true,
        archivedAt: true,
        tenant: { select: { name: true } },
      },
    })
    if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 })

    // Same authz as the rollover itself: ClubOwner/ClubManager of the tenant, or PlatformAdmin
    const role = await prisma.userRole.findFirst({
      where: {
        userId: auth.userId,
        OR: [
          { tenantId: team.tenantId, role: { in: ["ClubOwner", "ClubManager"] } },
          { role: "PlatformAdmin" },
        ],
      },
      select: { id: true },
    })
    if (!role) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    if (team.archivedAt) {
      return NextResponse.json(
        { error: "This team is archived — offers can only be sent for active teams" },
        { status: 409 }
      )
    }

    const parsed = rolloverOffersSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Invalid request", details: parsed.error.errors },
        { status: 400 }
      )
    }
    const data = parsed.data

    // Resolve terms ONCE — template values with manual overrides on top
    // (mirrors POST /api/offers' legacy single-package shape)
    let terms: Awaited<ReturnType<typeof resolveOfferTerms>>["terms"]
    let templateId: string | null = null
    try {
      const resolved = await resolveOfferTerms(prisma, {
        tenantId: team.tenantId,
        templateId: data.templateId,
        overrides: { seasonFee: data.seasonFee, installments: data.installments },
      })
      terms = resolved.terms
      templateId = resolved.templateId
    } catch (error) {
      if (error instanceof OfferCreationError && error.code === "TEMPLATE_NOT_FOUND") {
        return NextResponse.json({ error: "Template not found" }, { status: 404 })
      }
      throw error
    }

    const expiresAt = new Date(Date.now() + data.expiresInDays * 24 * 60 * 60 * 1000)

    const playerIds = [...new Set(data.playerIds)]
    const players = await prisma.player.findMany({
      where: { id: { in: playerIds }, deletedAt: null },
      select: { id: true, parentId: true, firstName: true, lastName: true },
    })
    const playerById = new Map(players.map((p: any) => [p.id, p]))

    let created = 0
    const skipped: Array<{ playerId: string; reason: string }> = []
    const emailJobs: Array<{ parentId: string; playerName: string }> = []

    // One transaction per offer so a single duplicate doesn't fail the batch
    for (const playerId of playerIds) {
      const player = playerById.get(playerId) as any
      if (!player) {
        skipped.push({ playerId, reason: "Player not found" })
        continue
      }
      try {
        await prisma.$transaction(async (tx: any) => {
          await createOfferForPlayer(tx, {
            teamId: team.id,
            playerId: player.id,
            templateId,
            terms,
            expiresAt,
            player,
            clubName: team.tenant.name,
            teamName: team.name,
          })
        })
        created++
        emailJobs.push({
          parentId: player.parentId,
          playerName: `${player.firstName} ${player.lastName}`,
        })
      } catch (error) {
        if (error instanceof OfferCreationError) {
          skipped.push({ playerId, reason: error.message })
        } else {
          console.error(`Rollover offer failed for player ${playerId}:`, error)
          skipped.push({ playerId, reason: "Couldn't create the offer" })
        }
      }
    }

    // Offer emails — best-effort, after the offers exist (mirrors POST /api/offers)
    if (emailJobs.length > 0) {
      try {
        const { sendOfferEmail, appBaseUrl } = await import("@/lib/email")
        const parents = await prisma.user.findMany({
          where: { id: { in: [...new Set(emailJobs.map((j) => j.parentId))] } },
          select: { id: true, email: true, firstName: true },
        })
        const parentById = new Map(parents.map((p: any) => [p.id, p]))
        const offerLink = `${appBaseUrl()}/offers`
        await Promise.all(
          emailJobs.map(async (job) => {
            const parent = parentById.get(job.parentId) as any
            if (!parent?.email) return
            await sendOfferEmail({
              to: parent.email,
              parentName: parent.firstName || "Parent",
              playerName: job.playerName,
              clubName: team.tenant.name,
              teamName: team.name,
              seasonFee: Number(terms.seasonFee),
              offerLink,
            })
          })
        )
      } catch (emailError) {
        console.error("Failed to send rollover offer emails:", emailError)
      }
    }

    return NextResponse.json({ created, skipped }, { status: created > 0 ? 201 : 200 })
  } catch (error) {
    console.error("Rollover offers error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
