import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { createWaiverSchema, createWaiver, listWaivers } from "@/lib/waivers/manage"

export const dynamic = "force-dynamic"

async function clubAccess(userId: string, isPlatformAdmin: boolean, tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, name: true },
  })
  if (!tenant) return { tenant: null, allowed: false }
  if (isPlatformAdmin) return { tenant, allowed: true }
  const role = await prisma.userRole.findFirst({
    where: { userId, tenantId, role: { in: ["ClubOwner", "ClubManager"] } },
  })
  return { tenant, allowed: !!role }
}

/** GET /api/clubs/[id]/waivers — club management list. */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
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

    const waivers = await listWaivers({ tenantId: params.id })
    return NextResponse.json({ waivers })
  } catch (error) {
    console.error("List club waivers error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/** POST /api/clubs/[id]/waivers — create from a template or custom text. */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
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

    const parsed = createWaiverSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Invalid input" },
        { status: 400 }
      )
    }
    const result = await createWaiver({ tenantId: params.id }, tenant.name, parsed.data)
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 })
    return NextResponse.json({ success: true, waiver: result.waiver })
  } catch (error) {
    console.error("Create club waiver error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
