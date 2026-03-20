import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"

export const dynamic = "force-dynamic"

const updateTemplateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  seasonFee: z.number().min(0).optional(),
  installments: z.number().min(1).max(12).optional(),
  practiceSessions: z.number().min(0).optional(),
  includesBall: z.boolean().optional(),
  includesBag: z.boolean().optional(),
  includesShoes: z.boolean().optional(),
  includesUniform: z.boolean().optional(),
  includesTracksuit: z.boolean().optional(),
})

async function verifyClubAdmin(clubId: string, userId: string) {
  const hasAccess = await prisma.userRole.findFirst({
    where: {
      userId,
      OR: [
        { tenantId: clubId, role: { in: ["ClubOwner", "ClubManager"] } },
        { role: "PlatformAdmin" },
      ],
    },
  })
  return !!hasAccess
}

/**
 * PATCH /api/clubs/[id]/offer-templates/[templateId]
 * Update a club offer template
 * Access: ClubOwner / ClubManager only
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; templateId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const isAdmin = await verifyClubAdmin(params.id, session.user.id)
    if (!isAdmin) {
      return NextResponse.json({ error: "Only club owners and managers can edit templates" }, { status: 403 })
    }

    const template = await prisma.offerTemplate.findFirst({
      where: { id: params.templateId, tenantId: params.id },
    })
    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 })
    }

    const body = await request.json()
    const data = updateTemplateSchema.parse(body)

    const updated = await prisma.offerTemplate.update({
      where: { id: params.templateId },
      data,
    })

    return NextResponse.json({
      success: true,
      ...(updated as any),
      seasonFee: Number((updated as any).seasonFee),
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }
    console.error("Update club template error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * DELETE /api/clubs/[id]/offer-templates/[templateId]
 * Soft-delete (archive) a club offer template
 * Access: ClubOwner / ClubManager only
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; templateId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const isAdmin = await verifyClubAdmin(params.id, session.user.id)
    if (!isAdmin) {
      return NextResponse.json({ error: "Only club owners and managers can archive templates" }, { status: 403 })
    }

    const template = await prisma.offerTemplate.findFirst({
      where: { id: params.templateId, tenantId: params.id },
    })
    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 })
    }

    await prisma.offerTemplate.update({
      where: { id: params.templateId },
      data: { isActive: false },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete club template error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
