import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"

/**
 * GET /api/clubs/[id] — Club details with branding
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: params.id },
    include: { branding: true },
  })

  if (!tenant) {
    return NextResponse.json({ error: "Club not found" }, { status: 404 })
  }

  return NextResponse.json({ club: tenant })
}

/**
 * PATCH /api/clubs/[id] — Update club name, slug, branding, timezone
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const userId = session.user.id

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Verify ClubOwner or ClubManager
    const role = await prisma.userRole.findFirst({
      where: {
        userId: user.id,
        tenantId: params.id,
        role: { in: ["ClubOwner", "ClubManager"] },
      },
    })

    if (!role) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 })
    }

    const body = await request.json()
    const { name, slug, timezone, primaryColor } = body

    // Update tenant
    const updateData: Record<string, string> = {}
    if (name) updateData.name = name
    if (slug) updateData.slug = slug
    if (timezone) updateData.timezone = timezone

    const tenant = await prisma.tenant.update({
      where: { id: params.id },
      data: updateData,
    })

    // Update branding if primaryColor provided
    if (primaryColor) {
      await prisma.tenantBranding.upsert({
        where: { tenantId: params.id },
        create: { tenantId: params.id, primaryColor },
        update: { primaryColor },
      })
    }

    return NextResponse.json({ club: tenant })
  } catch (error) {
    console.error("Update club error:", error)
    return NextResponse.json(
      { error: "Failed to update club" },
      { status: 500 }
    )
  }
}
