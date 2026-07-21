import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { updateWaiverSchema, updateWaiver } from "@/lib/waivers/manage"

export const dynamic = "force-dynamic"

async function leagueAccess(userId: string, isPlatformAdmin: boolean, leagueId: string) {
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: { id: true, ownerId: true },
  })
  if (!league) return { league: null, allowed: false }
  if (league.ownerId === userId || isPlatformAdmin) return { league, allowed: true }
  const role = await prisma.userRole.findFirst({
    where: {
      userId,
      OR: [
        { leagueId, role: { in: ["LeagueOwner", "LeagueManager"] } },
        { role: "PlatformAdmin" },
      ],
    },
  })
  return { league, allowed: !!role }
}

/** PATCH /api/leagues/[id]/waivers/[waiverId] — edit; body change bumps version. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; waiverId: string } }
) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { league, allowed } = await leagueAccess(
      sessionInfo.userId,
      sessionInfo.isPlatformAdmin,
      params.id
    )
    if (!league) return NextResponse.json({ error: "League not found" }, { status: 404 })
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const parsed = updateWaiverSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Invalid input" },
        { status: 400 }
      )
    }
    const result = await updateWaiver({ leagueId: params.id }, params.waiverId, parsed.data)
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: 404 })
    return NextResponse.json({
      success: true,
      waiver: result.waiver,
      versionBumped: result.versionBumped,
    })
  } catch (error) {
    console.error("Update league waiver error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/** DELETE — deactivate (signatures are kept; the document stops being sent). */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string; waiverId: string } }
) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { league, allowed } = await leagueAccess(
      sessionInfo.userId,
      sessionInfo.isPlatformAdmin,
      params.id
    )
    if (!league) return NextResponse.json({ error: "League not found" }, { status: 404 })
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const result = await updateWaiver({ leagueId: params.id }, params.waiverId, {
      active: false,
    })
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Deactivate league waiver error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
