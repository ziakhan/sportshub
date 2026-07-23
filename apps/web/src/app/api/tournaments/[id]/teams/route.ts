import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@youthbasketballhub/db"
import { ensureObligation, cancelObligationIfUnpaid } from "@/lib/payments/obligations"

export const dynamic = "force-dynamic"

/**
 * GET /api/tournaments/[id]/teams — List registered teams
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const teams = await (prisma as any).tournamentTeam.findMany({
      where: { tournamentId: params.id },
      include: {
        team: {
          select: {
            id: true,
            name: true,
            ageGroup: true,
            gender: true,
            tenant: { select: { id: true, name: true } },
          },
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
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const tournament = await (prisma as any).tournament.findUnique({
      where: { id: params.id },
      select: { ownerId: true, name: true, tenantId: true, teamFee: true, currency: true },
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

    // Scope: the registration must belong to THIS tournament (IDOR guard, gap-audit §2).
    const target = await (prisma as any).tournamentTeam.findFirst({
      where: { id: tournamentTeamId, tournamentId: params.id },
      select: {
        id: true,
        registrationFee: true,
        team: { select: { name: true, tenantId: true } },
      },
    })
    if (!target) return NextResponse.json({ error: "Team registration not found" }, { status: 404 })

    await prisma.$transaction(async (tx: any) => {
      await tx.tournamentTeam.update({
        where: { id: tournamentTeamId },
        data: { status },
      })

      // Payment audit 2026-07-23: entry fees previously existed only as a
      // number on the row — no obligation, no ledger, invisible to the club
      // payments page. Approval now creates the club-owed debt (mirrors the
      // league team-fee wiring); rejection/withdrawal cancels it if unpaid.
      const fee = Number(target.registrationFee ?? tournament.teamFee ?? 0)
      if (status === "APPROVED" && fee > 0 && tournament.tenantId && target.team?.tenantId) {
        await ensureObligation(tx, {
          payerTenantId: target.team.tenantId,
          payeeTenantId: tournament.tenantId,
          referenceType: "TournamentEntry",
          referenceId: target.id,
          description: `Tournament entry — ${tournament.name} (${target.team.name})`,
          amount: fee,
          currency: tournament.currency ?? "CAD",
        })
      }
      if (status === "REJECTED" || status === "WITHDRAWN") {
        await cancelObligationIfUnpaid(tx, "TournamentEntry", target.id)
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Update tournament team error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
