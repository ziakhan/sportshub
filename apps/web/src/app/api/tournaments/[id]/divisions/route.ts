import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"

export const dynamic = "force-dynamic"

const createDivisionSchema = z.object({
  name: z.string().min(1).max(100),
  ageGroup: z.string().min(1),
  gender: z.enum(["MALE", "FEMALE", "COED"]).optional(),
  maxTeams: z.number().min(1).optional(),
})

/**
 * POST /api/tournaments/[id]/divisions — Create a division
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const tournament = await (prisma as any).tournament.findUnique({
      where: { id: params.id },
      select: { ownerId: true },
    })
    if (!tournament || (tournament.ownerId !== sessionInfo.userId && !sessionInfo.isPlatformAdmin)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const data = createDivisionSchema.parse(body)

    const division = await (prisma as any).tournamentDivision.create({
      data: {
        tournamentId: params.id,
        name: data.name,
        ageGroup: data.ageGroup,
        gender: data.gender || null,
        maxTeams: data.maxTeams ?? null,
      },
    })

    return NextResponse.json({ success: true, id: division.id }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    console.error("Create tournament division error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * GET /api/tournaments/[id]/divisions — List divisions
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const divisions = await (prisma as any).tournamentDivision.findMany({
      where: { tournamentId: params.id },
      include: { _count: { select: { teams: true } } },
      orderBy: { ageGroup: "asc" },
    })
    return NextResponse.json({ divisions })
  } catch (error) {
    console.error("Get tournament divisions error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * DELETE /api/tournaments/[id]/divisions?divisionId=xxx — Delete a division
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const tournament = await (prisma as any).tournament.findUnique({
      where: { id: params.id },
      select: { ownerId: true },
    })
    if (!tournament || (tournament.ownerId !== sessionInfo.userId && !sessionInfo.isPlatformAdmin)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const divisionId = request.nextUrl.searchParams.get("divisionId")
    if (!divisionId) {
      return NextResponse.json({ error: "divisionId required" }, { status: 400 })
    }

    await (prisma as any).tournamentDivision.delete({ where: { id: divisionId } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete tournament division error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
