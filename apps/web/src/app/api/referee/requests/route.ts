import { NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { getSessionUserId } from "@/lib/auth-helpers"

export const dynamic = "force-dynamic"

/**
 * GET /api/referee/requests — the referee's inbox: offers addressed to me
 * plus open broadcasts from leagues whose pool I'm in, and my accepted
 * upcoming shifts.
 */
export async function GET() {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const myPools = await prisma.leagueReferee.findMany({
      where: { userId: auth.userId },
      select: { leagueId: true },
    })
    const poolLeagueIds = myPools.map((p: any) => p.leagueId)

    const requests = await prisma.refereeSessionRequest.findMany({
      where: {
        OR: [
          { targetUserId: auth.userId, status: "PENDING" },
          { targetUserId: null, status: "PENDING", leagueId: { in: poolLeagueIds } },
          { acceptedById: auth.userId, status: "ACCEPTED" },
        ],
      },
      select: {
        id: true,
        startTime: true,
        endTime: true,
        message: true,
        offeredRatePerGame: true,
        status: true,
        targetUserId: true,
        acceptedById: true,
        league: { select: { name: true } },
        sessionDay: {
          select: { date: true, session: { select: { label: true, season: { select: { label: true } } } } },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    })

    return NextResponse.json({
      requests: requests.map((r: any) => ({
        id: r.id,
        leagueName: r.league.name,
        date: r.sessionDay.date,
        sessionLabel: r.sessionDay.session.label,
        seasonLabel: r.sessionDay.session.season.label,
        window: `${r.startTime}–${r.endTime}`,
        message: r.message,
        offeredRatePerGame: r.offeredRatePerGame != null ? Number(r.offeredRatePerGame) : null,
        status: r.status,
        broadcast: !r.targetUserId,
        mine: r.acceptedById === auth.userId,
      })),
    })
  } catch (error) {
    console.error("Referee inbox error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
