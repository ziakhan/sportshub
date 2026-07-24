import { NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"

export const dynamic = "force-dynamic"

/**
 * GET /api/live — the scoreboard as JSON (M4 mobile Home/Scores screen).
 * Same shape of data the /scores page renders server-side: live now,
 * this week's finals, next week's schedule. Public read (only shows what
 * the anonymous website already shows); the app refetches on `game.update`
 * socket pings to the public `scores` room.
 */

const gameSelect = {
  id: true,
  status: true,
  scheduledAt: true,
  homeScore: true,
  awayScore: true,
  homeTeam: {
    select: { id: true, name: true, tenant: { select: { branding: { select: { primaryColor: true } } } } },
  },
  awayTeam: {
    select: { id: true, name: true, tenant: { select: { branding: { select: { primaryColor: true } } } } },
  },
  venue: { select: { name: true } },
  season: { select: { id: true, label: true, league: { select: { name: true } } } },
}

function serialize(g: any) {
  return {
    id: g.id,
    status: g.status,
    scheduledAt: g.scheduledAt,
    homeScore: g.homeScore,
    awayScore: g.awayScore,
    homeTeam: {
      id: g.homeTeam?.id ?? null,
      name: g.homeTeam?.name ?? "TBD",
      color: g.homeTeam?.tenant?.branding?.primaryColor ?? null,
    },
    awayTeam: {
      id: g.awayTeam?.id ?? null,
      name: g.awayTeam?.name ?? "TBD",
      color: g.awayTeam?.tenant?.branding?.primaryColor ?? null,
    },
    venue: g.venue?.name ?? null,
    league: g.season?.league?.name ?? null,
    seasonLabel: g.season?.label ?? null,
  }
}

export async function GET() {
  try {
    const now = new Date()
    const weekBack = new Date(now.getTime() - 7 * 86400_000)
    const weekAhead = new Date(now.getTime() + 7 * 86400_000)

    const [live, finals, upcoming] = await Promise.all([
      (prisma as any).game.findMany({
        where: { status: "LIVE" },
        select: gameSelect,
        orderBy: { scheduledAt: "asc" },
        take: 12,
      }),
      (prisma as any).game.findMany({
        where: { status: "COMPLETED", scheduledAt: { gte: weekBack } },
        select: gameSelect,
        // Five-tab parity pass (2026-07-24): the public (public)/scores page
        // takes 36 finals — this route (native scores.tsx's data source) was
        // capped at 24, a silent drift where the app could show fewer
        // "Recent results" than the web page for the same week.
        orderBy: { scheduledAt: "desc" },
        take: 36,
      }),
      (prisma as any).game.findMany({
        where: { status: "SCHEDULED", scheduledAt: { gte: now, lte: weekAhead } },
        select: gameSelect,
        orderBy: { scheduledAt: "asc" },
        take: 24,
      }),
    ])

    return NextResponse.json({
      live: live.map(serialize),
      finals: finals.map(serialize),
      upcoming: upcoming.map(serialize),
    })
  } catch (error) {
    console.error("Live scoreboard list error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
