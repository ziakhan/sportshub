import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { isSeasonLocked, SEASON_LOCKED_MESSAGE } from "@/lib/seasons/season-lock"
import { composeDivisionName } from "@/lib/teams/naming"

export const dynamic = "force-dynamic"

// Derived naming (league-ia-redesign §4): identity is ageGroup + gender +
// tier; the display name is ALWAYS composed. A typed `name` is ignored.
const createDivisionSchema = z.object({
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

    // Same structure twice = a duplicate bracket, guaranteed confusion.
    const duplicate = await prisma.division.findFirst({
      where: {
        seasonId: params.id,
        ageGroup: data.ageGroup,
        gender: data.gender || null,
        tier: data.tier,
      },
      select: { id: true },
    })
    if (duplicate) {
      return NextResponse.json(
        {
          error: `${composeDivisionName({ ageGroup: data.ageGroup, gender: data.gender, tier: data.tier })} already exists in this season.`,
        },
        { status: 409 }
      )
    }

    const division = await prisma.division.create({
      data: {
        seasonId: params.id,
        name: composeDivisionName({
          ageGroup: data.ageGroup,
          gender: data.gender,
          tier: data.tier,
        }),
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
      select: { seasonId: true, ageGroup: true, gender: true, tier: true },
    })
    if (!division || division.seasonId !== params.id) {
      return NextResponse.json({ error: "Division not found" }, { status: 404 })
    }

    // Names are derived, so every remaining edit is structural — all of it
    // locks with the season.
    if (isSeasonLocked(season.status)) {
      return NextResponse.json(
        { error: SEASON_LOCKED_MESSAGE, status: season.status },
        { status: 409 }
      )
    }

    const updateData: Record<string, unknown> = {}
    if (data.ageGroup !== undefined) updateData.ageGroup = data.ageGroup
    if (data.gender !== undefined) updateData.gender = data.gender
    if (data.tier !== undefined) updateData.tier = data.tier
    if (data.maxTeams !== undefined) updateData.maxTeams = data.maxTeams
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 })
    }

    // Identity changed → recompose the display name (never typed).
    if (
      data.ageGroup !== undefined ||
      data.gender !== undefined ||
      data.tier !== undefined
    ) {
      updateData.name = composeDivisionName({
        ageGroup: data.ageGroup ?? division.ageGroup,
        gender: data.gender !== undefined ? data.gender : (division.gender as any),
        tier: data.tier ?? division.tier,
      })
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

    // Scope: the division must belong to THIS season (IDOR guard, gap-audit §2).
    const target = await prisma.division.findFirst({
      where: { id: divisionId, seasonId: params.id },
      select: { id: true, _count: { select: { teamSubmissions: true } } },
    })
    if (!target) return NextResponse.json({ error: "Division not found" }, { status: 404 })

    // Studio P0 guard: deleting a division used to silently null its teams'
    // division — they then vanished from the scheduler. Reassign first.
    const teamCount = (target as any)._count?.teamSubmissions ?? 0
    if (teamCount > 0) {
      return NextResponse.json(
        {
          error: `${teamCount} team${teamCount === 1 ? " is" : "s are"} in this division — move them to another division first.`,
          code: "DIVISION_IN_USE",
        },
        { status: 409 }
      )
    }

    await prisma.division.delete({ where: { id: divisionId } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete division error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
