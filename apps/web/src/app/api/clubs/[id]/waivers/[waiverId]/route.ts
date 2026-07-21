import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { updateWaiverSchema, updateWaiver } from "@/lib/waivers/manage"

export const dynamic = "force-dynamic"

async function clubAccess(userId: string, isPlatformAdmin: boolean, tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true },
  })
  if (!tenant) return { tenant: null, allowed: false }
  if (isPlatformAdmin) return { tenant, allowed: true }
  const role = await prisma.userRole.findFirst({
    where: { userId, tenantId, role: { in: ["ClubOwner", "ClubManager"] } },
  })
  return { tenant, allowed: !!role }
}

/** PATCH /api/clubs/[id]/waivers/[waiverId] — edit; body change bumps version. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; waiverId: string } }
) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { tenant, allowed } = await clubAccess(
      sessionInfo.userId,
      sessionInfo.isPlatformAdmin,
      params.id
    )
    if (!tenant) return NextResponse.json({ error: "Club not found" }, { status: 404 })
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const parsed = updateWaiverSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Invalid input" },
        { status: 400 }
      )
    }
    const result = await updateWaiver({ tenantId: params.id }, params.waiverId, parsed.data)
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: 404 })
    return NextResponse.json({
      success: true,
      waiver: result.waiver,
      versionBumped: result.versionBumped,
    })
  } catch (error) {
    console.error("Update club waiver error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/** DELETE — deactivate (signatures are kept; the document stops being used). */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string; waiverId: string } }
) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { tenant, allowed } = await clubAccess(
      sessionInfo.userId,
      sessionInfo.isPlatformAdmin,
      params.id
    )
    if (!tenant) return NextResponse.json({ error: "Club not found" }, { status: 404 })
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const result = await updateWaiver({ tenantId: params.id }, params.waiverId, {
      active: false,
    })
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Deactivate club waiver error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
