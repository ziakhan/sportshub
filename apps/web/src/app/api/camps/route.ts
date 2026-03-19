import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"

export const dynamic = "force-dynamic"

const createSchema = z.object({
  tenantId: z.string(),
  name: z.string().min(3).max(200),
  description: z.string().optional(),
  details: z.string().optional(),
  campType: z.enum(["MARCH_BREAK", "HOLIDAY", "SUMMER", "WEEKLY"]),
  ageGroup: z.string(),
  gender: z.enum(["MALE", "FEMALE", "COED"]).optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  dailyStartTime: z.string(),
  dailyEndTime: z.string(),
  location: z.string().min(3),
  numberOfWeeks: z.number().min(1).default(1),
  weeklyFee: z.number().min(0),
  fullCampFee: z.number().min(0).optional(),
  maxParticipants: z.number().optional(),
  includesLunch: z.boolean().default(false),
  includesSnacks: z.boolean().default(false),
  includesJersey: z.boolean().default(false),
  includesBall: z.boolean().default(false),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const data = createSchema.parse(body)

    const hasAccess = await prisma.userRole.findFirst({
      where: {
        userId: session.user.id,
        OR: [
          { tenantId: data.tenantId, role: { in: ["ClubOwner", "ClubManager", "Staff"] } },
          { role: "PlatformAdmin" },
        ],
      },
    })
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const camp = await (prisma as any).camp.create({
      data: {
        tenantId: data.tenantId,
        name: data.name,
        description: data.description || null,
        details: data.details || null,
        campType: data.campType,
        ageGroup: data.ageGroup,
        gender: data.gender || null,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        dailyStartTime: data.dailyStartTime,
        dailyEndTime: data.dailyEndTime,
        location: data.location,
        numberOfWeeks: data.numberOfWeeks,
        weeklyFee: data.weeklyFee,
        fullCampFee: data.fullCampFee ?? null,
        maxParticipants: data.maxParticipants || null,
        includesLunch: data.includesLunch,
        includesSnacks: data.includesSnacks,
        includesJersey: data.includesJersey,
        includesBall: data.includesBall,
        isPublished: false,
      },
    })

    return NextResponse.json({ success: true, id: camp.id }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    console.error("Create camp error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const tenantId = request.nextUrl.searchParams.get("tenantId")
    const isPublic = request.nextUrl.searchParams.get("public") === "true"

    if (isPublic) {
      const camps = await (prisma as any).camp.findMany({
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
        camps: camps.map((c: any) => ({
          ...c,
          weeklyFee: Number(c.weeklyFee),
          fullCampFee: c.fullCampFee ? Number(c.fullCampFee) : null,
        })),
      })
    }

    if (!tenantId) {
      return NextResponse.json({ error: "tenantId required" }, { status: 400 })
    }

    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const camps = await (prisma as any).camp.findMany({
      where: { tenantId },
      include: { _count: { select: { signups: true } } },
      orderBy: { startDate: "desc" },
    })

    return NextResponse.json({
      camps: camps.map((c: any) => ({
        ...c,
        weeklyFee: Number(c.weeklyFee),
        fullCampFee: c.fullCampFee ? Number(c.fullCampFee) : null,
      })),
    })
  } catch (error) {
    console.error("Get camps error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
