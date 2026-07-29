import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { getSessionUserId } from "@/lib/auth-helpers"

export const dynamic = "force-dynamic"

/**
 * GET /api/seasons/[id]/report — league-side season analytics (owner
 * 2026-07-29 "stats and analytics"): per-club registration + money rollup.
 * Fees come from TeamSubmission-referenced obligations, so deposits and
 * partial payments count toward "received".
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const season = await (prisma as any).season.findUnique({
      where: { id: params.id },
      select: { id: true, leagueId: true, league: { select: { ownerId: true } } },
    })
    if (!season) return NextResponse.json({ error: "Season not found" }, { status: 404 })

    const allowed =
      season.league.ownerId === sessionInfo.userId ||
      (await prisma.userRole.findFirst({
        where: {
          userId: sessionInfo.userId,
          OR: [
            { leagueId: season.leagueId, role: { in: ["LeagueOwner", "LeagueManager"] } },
            { role: "PlatformAdmin" },
          ],
        },
      })) !== null
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const submissions = await (prisma as any).teamSubmission.findMany({
      where: { seasonId: params.id },
      select: {
        id: true,
        status: true,
        paymentStatus: true,
        team: { select: { tenant: { select: { id: true, name: true } } } },
        roster: { select: { players: { select: { playerId: true } } } },
      },
    })
    const obligations = await (prisma as any).paymentObligation.findMany({
      where: {
        referenceType: "TeamSubmission",
        referenceId: { in: submissions.map((s: any) => s.id) },
      },
      select: {
        referenceId: true,
        amount: true,
        status: true,
        dueDate: true,
        payments: { where: { status: "SUCCEEDED" }, select: { amount: true } },
      },
    })
    const bySubmission = new Map<string, any>(obligations.map((o: any) => [o.referenceId, o]))
    const now = new Date()

    const clubs = new Map<
      string,
      {
        tenantId: string
        name: string
        teams: number
        approved: number
        pending: number
        players: number
        owed: number
        received: number
        overdue: number
      }
    >()
    for (const s of submissions) {
      const tenant = s.team?.tenant
      if (!tenant) continue
      const row =
        clubs.get(tenant.id) ??
        {
          tenantId: tenant.id,
          name: tenant.name,
          teams: 0,
          approved: 0,
          pending: 0,
          players: 0,
          owed: 0,
          received: 0,
          overdue: 0,
        }
      row.teams++
      if (s.status === "APPROVED") {
        row.approved++
        row.players += s.roster?.players?.length ?? 0
      }
      if (s.status === "PENDING") row.pending++
      const o = bySubmission.get(s.id)
      if (o) {
        row.owed += Number(o.amount)
        row.received += o.payments.reduce((a: number, pm: any) => a + Number(pm.amount), 0)
        if (o.status !== "PAID" && o.dueDate && new Date(o.dueDate) < now) row.overdue++
      }
      clubs.set(tenant.id, row)
    }

    const rows = [...clubs.values()].sort((a, b) => a.name.localeCompare(b.name))
    const totals = rows.reduce(
      (t, r) => ({
        teams: t.teams + r.teams,
        approved: t.approved + r.approved,
        players: t.players + r.players,
        owed: t.owed + r.owed,
        received: t.received + r.received,
        overdue: t.overdue + r.overdue,
      }),
      { teams: 0, approved: 0, players: 0, owed: 0, received: 0, overdue: 0 }
    )

    return NextResponse.json({ clubs: rows, totals })
  } catch (error) {
    console.error("Season report error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
