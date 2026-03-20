import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@youthbasketballhub/db"

export const dynamic = "force-dynamic"

/**
 * GET /api/tournaments/[id]/teams — List registered teams
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const teams = await (prisma as any).tournamentTeam.findMany({
      where: { tournamentId: params.id },
      include: {
        team: {
          select: { id: true, name: true, ageGroup: true, gender: true, tenant: { select: { id: true, name: true } } },
        },
        division: { select: { id: true, name: true, ageGroup: true } },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({
      teams: teams.map((t: any) => ({
        ...t,
        registrationFee: t.registrationFee ? Number(t.registrationFee) : null,
      })),
    })
  } catch (error) {
    console.error("Get tournament teams error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * PATCH /api/tournaments/[id]/teams — Update team status (approve/reject)
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

    const tournament = await (prisma as any).tournament.findUnique({
      where: { id: params.id },
      select: { ownerId: true },
    })
    if (!tournament) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const isPlatformAdmin = await prisma.userRole.findFirst({
      where: { userId: session.user.id, role: "PlatformAdmin" as any },
    })
    if (tournament.ownerId !== session.user.id && !isPlatformAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const { tournamentTeamId, status } = body

    if (!tournamentTeamId || !["APPROVED", "REJECTED", "WITHDRAWN"].includes(status)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 })
    }

    await (prisma as any).tournamentTeam.update({
      where: { id: tournamentTeamId },
      data: { status },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Update tournament team error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
