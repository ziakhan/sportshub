import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"

export const dynamic = "force-dynamic"

const createDivisionSchema = z.object({
  name: z.string().min(1).max(100),
  ageGroup: z.string().min(1),
  gender: z.enum(["MALE", "FEMALE", "COED"]).optional(),
  tier: z.number().min(1).default(1),
})

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const league = await prisma.league.findUnique({
      where: { id: params.id },
      select: { ownerId: true },
    })
    if (!league || league.ownerId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const data = createDivisionSchema.parse(body)

    const division = await prisma.leagueDivision.create({
      data: {
        leagueId: params.id,
        name: data.name,
        ageGroup: data.ageGroup,
        gender: data.gender || null,
        tier: data.tier,
      } as any,
    })

    return NextResponse.json({ success: true, id: division.id }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    console.error("Create division error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const divisions = await prisma.leagueDivision.findMany({
      where: { leagueId: params.id },
      include: { _count: { select: { teams: true } } },
      orderBy: [{ ageGroup: "asc" }, { tier: "asc" }],
    })
    return NextResponse.json({ divisions })
  } catch (error) {
    console.error("Get divisions error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const league = await prisma.league.findUnique({
      where: { id: params.id },
      select: { ownerId: true },
    })
    if (!league || league.ownerId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const divisionId = request.nextUrl.searchParams.get("divisionId")
    if (!divisionId) {
      return NextResponse.json({ error: "divisionId required" }, { status: 400 })
    }

    await prisma.leagueDivision.delete({ where: { id: divisionId } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete division error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
