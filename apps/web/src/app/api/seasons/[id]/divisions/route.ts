import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { isSeasonLocked, SEASON_LOCKED_MESSAGE } from "@/lib/seasons/season-lock"

export const dynamic = "force-dynamic"

const createDivisionSchema = z.object({
  name: z.string().min(1).max(100),
  ageGroup: z.string().min(1),
  gender: z.enum(["MALE", "FEMALE", "COED"]).optional(),
  tier: z.number().min(1).default(1),
  maxTeams: z.number().int().min(1).max(128).optional(),
})

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const season = await prisma.season.findUnique({
      where: { id: params.id },
      select: { status: true, league: { select: { ownerId: true } } },
    })
    if (!season || (season.league.ownerId !== sessionInfo.userId && !sessionInfo.isPlatformAdmin)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    if (isSeasonLocked(season.status)) {
      return NextResponse.json(
        { error: SEASON_LOCKED_MESSAGE, status: season.status },
        { status: 409 }
      )
    }

    const body = await request.json()
    const data = createDivisionSchema.parse(body)

    const division = await prisma.division.create({
      data: {
        seasonId: params.id,
        name: data.name,
        ageGroup: data.ageGroup,
        gender: data.gender || null,
        tier: data.tier,
        maxTeams: data.maxTeams ?? null,
      } as any,
    })

    return NextResponse.json({ success: true, id: division.id }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }
    console.error("Create division error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

const updateDivisionSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  ageGroup: z.string().min(1).optional(),
  gender: z.enum(["MALE", "FEMALE", "COED"]).nullable().optional(),
  tier: z.number().min(1).optional(),
  maxTeams: z.number().int().min(1).max(128).nullable().optional(),
})

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const season = await prisma.season.findUnique({
      where: { id: params.id },
      select: { status: true, league: { select: { ownerId: true } } },
    })
    if (!season || (season.league.ownerId !== sessionInfo.userId && !sessionInfo.isPlatformAdmin)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const divisionId = request.nextUrl.searchParams.get("divisionId")
    if (!divisionId) {
      return NextResponse.json({ error: "divisionId required" }, { status: 400 })
    }

    const body = await request.json()
    const data = updateDivisionSchema.parse(body)

    const division = await prisma.division.findUnique({
      where: { id: divisionId },
      select: { seasonId: true },
    })
    if (!division || division.seasonId !== params.id) {
      return NextResponse.json({ error: "Division not found" }, { status: 404 })
    }

    // Renaming is cosmetic and allowed at any season status (see season-lock.ts);
    // the structural shape (age group, gender, tier, capacity) locks with the season.
    const wantsStructuralChange =
      data.ageGroup !== undefined ||
      data.gender !== undefined ||
      data.tier !== undefined ||
      data.maxTeams !== undefined
    if (wantsStructuralChange && isSeasonLocked(season.status)) {
      return NextResponse.json(
        { error: SEASON_LOCKED_MESSAGE, status: season.status },
        { status: 409 }
      )
    }

    const updateData: Record<string, unknown> = {}
    if (data.name !== undefined) updateData.name = data.name
    if (data.ageGroup !== undefined) updateData.ageGroup = data.ageGroup
    if (data.gender !== undefined) updateData.gender = data.gender
    if (data.tier !== undefined) updateData.tier = data.tier
    if (data.maxTeams !== undefined) updateData.maxTeams = data.maxTeams
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 })
    }

    const updated = await prisma.division.update({
      where: { id: divisionId },
      data: updateData as any,
    })

    return NextResponse.json({ success: true, division: updated })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }
    console.error("Update division error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const divisions = await prisma.division.findMany({
      where: { seasonId: params.id },
      include: { _count: { select: { teamSubmissions: true } } },
      orderBy: [{ ageGroup: "asc" }, { tier: "asc" }],
    })
    return NextResponse.json({
      divisions: divisions.map((d: any) => ({
        ...d,
        _count: { teams: d._count.teamSubmissions },
      })),
    })
  } catch (error) {
    console.error("Get divisions error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const season = await prisma.season.findUnique({
      where: { id: params.id },
      select: { status: true, league: { select: { ownerId: true } } },
    })
    if (!season || (season.league.ownerId !== sessionInfo.userId && !sessionInfo.isPlatformAdmin)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    if (isSeasonLocked(season.status)) {
      return NextResponse.json(
        { error: SEASON_LOCKED_MESSAGE, status: season.status },
        { status: 409 }
      )
    }

    const divisionId = request.nextUrl.searchParams.get("divisionId")
    if (!divisionId) {
      return NextResponse.json({ error: "divisionId required" }, { status: 400 })
    }

    await prisma.division.delete({ where: { id: divisionId } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete division error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
