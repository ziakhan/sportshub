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
  includesBall: z.boolean().default(false),
  includesBag: z.boolean().default(false),
  includesShoes: z.boolean().default(false),
  includesUniform: z.boolean().default(false),
  includesTracksuit: z.boolean().default(false),
})

async function verifyClubAccess(clubId: string, userId: string, requireAdmin: boolean) {
  const allowedRoles = requireAdmin
    ? ["ClubOwner", "ClubManager"] as any
    : ["ClubOwner", "ClubManager", "Staff", "TeamManager"] as any

  const hasAccess = await prisma.userRole.findFirst({
    where: {
      userId,
      OR: [
        { tenantId: clubId, role: { in: allowedRoles } },
        { role: "PlatformAdmin" as any },
      ],
    },
  })
  return !!hasAccess
}

/**
 * GET /api/clubs/[id]/offer-templates
 * List active offer templates for a club
 * Access: any club role
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

    const hasAccess = await verifyClubAccess(params.id, session.user.id, false)
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const templates = await prisma.offerTemplate.findMany({
      where: { tenantId: params.id, isActive: true },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({
      templates: templates.map((t: any) => ({
        ...t,
        seasonFee: Number(t.seasonFee),
      })),
    })
  } catch (error) {
    console.error("Get club templates error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * POST /api/clubs/[id]/offer-templates
 * Create an offer template for a club
 * Access: ClubOwner / ClubManager only
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

    const hasAccess = await verifyClubAccess(params.id, session.user.id, true)
    if (!hasAccess) {
      return NextResponse.json({ error: "Only club owners and managers can create templates" }, { status: 403 })
    }

    const body = await request.json()
    const data = createTemplateSchema.parse(body)

    const template = await prisma.offerTemplate.create({
      data: {
        tenantId: params.id,
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
    console.error("Create club template error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
