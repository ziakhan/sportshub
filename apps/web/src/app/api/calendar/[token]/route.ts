import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { buildIcs, type CalendarEvent } from "@/lib/calendar/ics"
import { getMemberTeamIds } from "@/lib/teams/chat-access"

export const dynamic = "force-dynamic"

const GAME_LENGTH_MS = 2 * 3600_000

/**
 * GET /api/calendar/[token] — personal iCal feed: practices + games for
 * every team the token's owner belongs to. Public route (allowlisted in
 * public-paths.ts); the unguessable token is the auth. Subscribed phone
 * calendars re-fetch periodically, so moves/cancellations propagate
 * without any push machinery (cancelled practices ship STATUS:CANCELLED).
 */
export async function GET(_request: NextRequest, { params }: { params: { token: string } }) {
  try {
    if (!params.token || params.token.length < 16) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    const user = await (prisma as any).user.findUnique({
      where: { calendarToken: params.token },
      select: { id: true, firstName: true },
    })
    if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const teamIds = [...(await getMemberTeamIds(user.id))]
    if (teamIds.length === 0) {
      return icsResponse(buildIcs("SportsHub", []))
    }

    const now = Date.now()
    const weekBack = new Date(now - 7 * 86_400_000)
    const horizon = new Date(now + 180 * 86_400_000)

    const [practices, games] = await Promise.all([
      (prisma as any).practice.findMany({
        where: { teamId: { in: teamIds }, scheduledAt: { gte: weekBack, lte: horizon } },
        select: {
          id: true,
          scheduledAt: true,
          duration: true,
          location: true,
          notes: true,
          status: true,
          updatedAt: true,
          team: { select: { name: true } },
          venue: { select: { name: true, address: true } },
        },
      }),
      (prisma as any).game.findMany({
        where: {
          OR: [{ homeTeamId: { in: teamIds } }, { awayTeamId: { in: teamIds } }],
          scheduledAt: { gte: weekBack, lte: horizon },
          status: { in: ["SCHEDULED", "LIVE", "COMPLETED"] },
        },
        select: {
          id: true,
          scheduledAt: true,
          status: true,
          updatedAt: true,
          homeTeam: { select: { name: true } },
          awayTeam: { select: { name: true } },
          venue: { select: { name: true, address: true } },
          season: { select: { label: true, league: { select: { name: true } } } },
        },
      }),
    ])

    const events: CalendarEvent[] = []
    for (const p of practices) {
      const start = new Date(p.scheduledAt)
      events.push({
        uid: `practice-${p.id}@sportshub`,
        title: `Practice — ${p.team.name}`,
        start,
        end: new Date(start.getTime() + p.duration * 60_000),
        location: p.venue ? [p.venue.name, p.venue.address].filter(Boolean).join(", ") : p.location,
        description: p.notes,
        cancelled: p.status === "CANCELLED",
        sequence: Math.floor(new Date(p.updatedAt).getTime() / 1000),
      })
    }
    for (const g of games) {
      const start = new Date(g.scheduledAt)
      events.push({
        uid: `game-${g.id}@sportshub`,
        title: `Game — ${g.homeTeam.name} vs ${g.awayTeam.name}`,
        start,
        end: new Date(start.getTime() + GAME_LENGTH_MS),
        location: g.venue ? [g.venue.name, g.venue.address].filter(Boolean).join(", ") : null,
        description: g.season ? `${g.season.league?.name ?? ""} ${g.season.label ?? ""}`.trim() : null,
        cancelled: false,
        sequence: Math.floor(new Date(g.updatedAt).getTime() / 1000),
      })
    }
    events.sort((a, b) => a.start.getTime() - b.start.getTime())

    const name = user.firstName ? `SportsHub — ${user.firstName}` : "SportsHub"
    return icsResponse(buildIcs(name, events))
  } catch (error) {
    console.error("Calendar feed error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

function icsResponse(body: string): NextResponse {
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="sportshub.ics"',
      "Cache-Control": "private, max-age=300",
    },
  })
}
