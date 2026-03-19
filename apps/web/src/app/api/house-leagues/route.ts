import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"

export const dynamic = "force-dynamic"

const createSchema = z.object({
  tenantId: z.string(),
  name: z.string().min(3).max(200),
  description: z.string().optional(),
  details: z.string().optional(),
  ageGroup: z.string(),
  gender: z.enum(["MALE", "FEMALE", "COED"]).optional(),
  season: z.string().optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  daysOfWeek: z.string().min(1),
  startTime: z.string().min(3),
  endTime: z.string().min(3),
  location: z.string().min(3),
  fee: z.number().min(0),
  maxParticipants: z.number().optional(),
  includesUniform: z.boolean().default(false),
  includesJersey: z.boolean().default(false),
  includesBall: z.boolean().default(false),
  includesMedal: z.boolean().default(false),
})

/**
 * POST /api/house-leagues — Create a house league
 */
export async function POST(request: NextRequest) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const userId = sessionInfo.userId

    const body = await request.json()
    const data = createSchema.parse(body)

    // Verify club permission
    const hasAccess = await prisma.userRole.findFirst({
      where: {
        userId,
        OR: [
          { tenantId: data.tenantId, role: { in: ["ClubOwner", "ClubManager", "Staff"] } },
          { role: "PlatformAdmin" },
        ],
      },
    })
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const houseLeague = await (prisma as any).houseLeague.create({
      data: {
        tenantId: data.tenantId,
        name: data.name,
        description: data.description || null,
        details: data.details || null,
        ageGroup: data.ageGroup,
        gender: data.gender || null,
        season: data.season || null,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        daysOfWeek: data.daysOfWeek,
        startTime: data.startTime,
        endTime: data.endTime,
        location: data.location,
        fee: data.fee,
        maxParticipants: data.maxParticipants || null,
        includesUniform: data.includesUniform,
        includesJersey: data.includesJersey,
        includesBall: data.includesBall,
        includesMedal: data.includesMedal,
        isPublished: false,
      },
    })

    return NextResponse.json({ success: true, id: houseLeague.id }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    console.error("Create house league error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * GET /api/house-leagues?tenantId=xxx — List house leagues for a club
 * GET /api/house-leagues?public=true — Public listing (published only)
 */
export async function GET(request: NextRequest) {
  try {
    const tenantId = request.nextUrl.searchParams.get("tenantId")
    const isPublic = request.nextUrl.searchParams.get("public") === "true"

    if (isPublic) {
      const leagues = await (prisma as any).houseLeague.findMany({
        where: {
          isPublished: true,
          endDate: { gte: new Date() },
          ...(tenantId ? { tenantId } : {}),
        },
        include: {
          tenant: { select: { id: true, name: true, slug: true, currency: true, branding: { select: { primaryColor: true } } } },
          _count: { select: { signups: true } },
        },
        orderBy: { startDate: "asc" },
      })
      return NextResponse.json({
        leagues: leagues.map((l: any) => ({ ...l, fee: Number(l.fee) })),
      })
    }

    if (!tenantId) {
      return NextResponse.json({ error: "tenantId required" }, { status: 400 })
    }

    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const leagues = await (prisma as any).houseLeague.findMany({
      where: { tenantId },
      include: { _count: { select: { signups: true } } },
      orderBy: { startDate: "desc" },
    })

    return NextResponse.json({
      leagues: leagues.map((l: any) => ({ ...l, fee: Number(l.fee) })),
    })
  } catch (error) {
    console.error("Get house leagues error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
