import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { createWaiverSchema, createWaiver, listWaivers } from "@/lib/waivers/manage"

export const dynamic = "force-dynamic"

async function leagueAccess(userId: string, isPlatformAdmin: boolean, leagueId: string) {
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: { id: true, name: true, ownerId: true },
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

/** GET /api/leagues/[id]/waivers — league-side list (management view). */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
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

    const waivers = await listWaivers({ leagueId: params.id })
    return NextResponse.json({ waivers })
  } catch (error) {
    console.error("List league waivers error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/** POST /api/leagues/[id]/waivers — create from a template or custom text. */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
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

    const parsed = createWaiverSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Invalid input" },
        { status: 400 }
      )
    }
    const result = await createWaiver({ leagueId: params.id }, league.name, parsed.data)
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 })
    return NextResponse.json({ success: true, waiver: result.waiver })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }
    console.error("Create league waiver error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
