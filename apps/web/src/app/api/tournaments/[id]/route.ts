import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { getPublicTournament } from "@/lib/queries/tournament"

export const dynamic = "force-dynamic"

/**
 * GET /api/tournaments/[id] — Get tournament details
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const tournament = await getPublicTournament(params.id)

    if (!tournament) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    return NextResponse.json(tournament)
  } catch (error) {
    console.error("Get tournament error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * PATCH /api/tournaments/[id] — Update tournament (including status changes)
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const tournament = await (prisma as any).tournament.findUnique({
      where: { id: params.id },
      select: { ownerId: true },
    })
    if (!tournament) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    // Verify ownership (impersonation-aware)
    const isOwner = tournament.ownerId === sessionInfo.userId
    if (!isOwner && !sessionInfo.isPlatformAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const updateData: Record<string, any> = {}

    const fields = [
      "name",
      "description",
      "city",
      "state",
      "country",
      "currency",
      "gamesGuaranteed",
      "gameSlotMinutes",
      "gameLengthMinutes",
      "gamePeriods",
      "playoffFormat",
      "status",
    ]
    for (const field of fields) {
      if (body[field] !== undefined) updateData[field] = body[field]
    }
    if (body.teamFee !== undefined) updateData.teamFee = body.teamFee
    if (body.startDate) updateData.startDate = new Date(body.startDate)
    if (body.endDate) updateData.endDate = new Date(body.endDate)
    if (body.registrationDeadline)
      updateData.registrationDeadline = new Date(body.registrationDeadline)
    if (body.tenantId !== undefined) updateData.tenantId = body.tenantId || null

    const updated = await (prisma as any).tournament.update({
      where: { id: params.id },
      data: updateData,
    })

    return NextResponse.json({
      success: true,
      ...updated,
      teamFee: updated.teamFee ? Number(updated.teamFee) : null,
    })
  } catch (error) {
    console.error("Update tournament error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
