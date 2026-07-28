import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"

export const dynamic = "force-dynamic"

/**
 * Referee settlements (owner 2026-07-24): refs are paid per GAME officiated,
 * not per shift — after a session day passes, the per-referee tally awaits
 * league confirmation ("double check before the settlement"). GET computes/
 * refreshes the pending rows; PATCH confirms one.
 */

async function leagueAccess(userId: string, leagueId: string) {
  const role = await prisma.userRole.findFirst({
    where: {
      userId,
      leagueId,
      role: { in: ["LeagueOwner", "LeagueManager"] as any },
    },
    select: { id: true },
  })
  if (role) return true
  const admin = await prisma.userRole.findFirst({
    where: { userId, role: "PlatformAdmin" as any },
    select: { id: true },
  })
  return !!admin
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSessionUserId()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!(await leagueAccess(session.userId, params.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Completed games in this league that already happened.
    const games = await (prisma as any).game.findMany({
      where: {
        status: "COMPLETED",
        scheduledAt: { lt: new Date() },
        season: { leagueId: params.id },
      },
      select: { id: true, scheduledAt: true },
    })
    const gameById = new Map<string, Date>(games.map((g: any) => [g.id, new Date(g.scheduledAt)]))

    if (games.length > 0) {
      const assignments = await prisma.userRole.findMany({
        where: { role: "Referee" as any, gameId: { in: [...gameById.keys()] } },
        select: { userId: true, gameId: true },
      })

      // Tally games per (referee, calendar day).
      const tally = new Map<string, { userId: string; date: Date; count: number }>()
      for (const a of assignments) {
        const played = gameById.get(a.gameId as string)!
        const day = new Date(Date.UTC(played.getUTCFullYear(), played.getUTCMonth(), played.getUTCDate()))
        const key = `${a.userId}:${day.toISOString()}`
        const row = tally.get(key) ?? { userId: a.userId, date: day, count: 0 }
        row.count++
        tally.set(key, row)
      }

      // Agreed rates: accepted session requests by referee+day.
      const accepted = await (prisma as any).refereeSessionRequest.findMany({
        where: { leagueId: params.id, status: "ACCEPTED", acceptedById: { not: null } },
        select: {
          acceptedById: true,
          agreedRatePerGame: true,
          offeredRatePerGame: true,
          sessionDay: { select: { date: true } },
        },
      })
      const rateFor = (userId: string, day: Date): number | null => {
        for (const r of accepted) {
          if (r.acceptedById !== userId || !r.sessionDay?.date) continue
          const d = new Date(r.sessionDay.date)
          if (
            d.getUTCFullYear() === day.getUTCFullYear() &&
            d.getUTCMonth() === day.getUTCMonth() &&
            d.getUTCDate() === day.getUTCDate()
          ) {
            const rate = r.agreedRatePerGame ?? r.offeredRatePerGame
            return rate != null ? Number(rate) : null
          }
        }
        return null
      }

      // Upsert pending rows (unique league+referee+date). Confirmed rows are
      // never touched — they are the settlement of record.
      for (const row of tally.values()) {
        const rate = rateFor(row.userId, row.date)
        await (prisma as any).refereeSettlement.upsert({
          where: {
            leagueId_refereeUserId_sessionDate: {
              leagueId: params.id,
              refereeUserId: row.userId,
              sessionDate: row.date,
            },
          },
          create: {
            leagueId: params.id,
            refereeUserId: row.userId,
            sessionDate: row.date,
            gamesCount: row.count,
            ratePerGame: rate,
            total: rate != null ? rate * row.count : null,
          },
          update: {
            // Refresh tallies only while still pending.
          },
        })
        await (prisma as any).refereeSettlement.updateMany({
          where: {
            leagueId: params.id,
            refereeUserId: row.userId,
            sessionDate: row.date,
            status: "PENDING_CONFIRM",
          },
          data: {
            gamesCount: row.count,
            ratePerGame: rate,
            total: rate != null ? rate * row.count : null,
          },
        })
      }
    }

    const settlements = await (prisma as any).refereeSettlement.findMany({
      where: { leagueId: params.id },
      include: { referee: { select: { firstName: true, lastName: true, email: true } } },
      orderBy: [{ status: "asc" }, { sessionDate: "desc" }],
      take: 100,
    })

    return NextResponse.json({
      settlements: settlements.map((s: any) => ({
        id: s.id,
        refereeName:
          [s.referee.firstName, s.referee.lastName].filter(Boolean).join(" ") || s.referee.email,
        sessionDate: s.sessionDate,
        gamesCount: s.gamesCount,
        ratePerGame: s.ratePerGame != null ? Number(s.ratePerGame) : null,
        total: s.total != null ? Number(s.total) : null,
        status: s.status,
        confirmedAt: s.confirmedAt,
      })),
    })
  } catch (error) {
    console.error("Referee settlements error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSessionUserId()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!(await leagueAccess(session.userId, params.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { settlementId } = await request.json()
    if (!settlementId) return NextResponse.json({ error: "settlementId required" }, { status: 400 })

    const updated = await (prisma as any).refereeSettlement.updateMany({
      where: { id: settlementId, leagueId: params.id, status: "PENDING_CONFIRM" },
      data: { status: "CONFIRMED", confirmedById: session.userId, confirmedAt: new Date() },
    })
    if (updated.count === 0) {
      return NextResponse.json({ error: "Settlement not found or already confirmed" }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Referee settlement confirm error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
