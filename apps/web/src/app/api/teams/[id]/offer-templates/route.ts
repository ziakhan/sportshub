import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"

export const dynamic = "force-dynamic"

const createTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  seasonFee: z.number().min(0),
  installments: z.number().min(1).max(12).default(1),
  practiceSessions: z.number().min(0).default(0),
  includesBallBag: z.boolean().default(false),
  includesShoes: z.boolean().default(false),
  includesUniform: z.boolean().default(false),
  includesTracksuit: z.boolean().default(false),
})

async function verifyTeamAccess(teamId: string, userId: string) {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { id: true, tenantId: true, name: true },
  })
  if (!team) return null

  const hasAccess = await prisma.userRole.findFirst({
    where: {
      userId,
      OR: [
        { tenantId: team.tenantId, role: { in: ["ClubOwner", "ClubManager", "Staff"] } },
        { role: "PlatformAdmin" },
      ],
    },
  })
  if (!hasAccess) return null

  return team
}

/**
 * GET /api/teams/[id]/offer-templates
 * List active offer templates for a team
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const team = await verifyTeamAccess(params.id, session.user.id)
    if (!team) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const templates = await prisma.offerTemplate.findMany({
      where: { teamId: params.id, isActive: true },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({
      templates: templates.map((t) => ({
        ...t,
        seasonFee: Number(t.seasonFee),
      })),
    })
  } catch (error) {
    console.error("Get templates error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * POST /api/teams/[id]/offer-templates
 * Create an offer template for a team
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const team = await verifyTeamAccess(params.id, session.user.id)
    if (!team) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const data = createTemplateSchema.parse(body)

    const template = await prisma.offerTemplate.create({
      data: {
        teamId: params.id,
        ...data,
      },
    })

    return NextResponse.json(
      { success: true, id: template.id, name: template.name },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }
    console.error("Create template error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
