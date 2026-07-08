import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { getSessionUserId } from "@/lib/auth-helpers"
import { getChatMembership } from "@/lib/teams/chat-access"
import {
  formatPracticeDate,
  notifyTeam,
  practiceSelect,
  serializePractice,
} from "@/lib/teams/practices"

export const dynamic = "force-dynamic"

/**
 * GET /api/teams/[id]/practices — members; occurrences from a week back to
 * ten weeks out (cancelled included so the calendar can show strikethrough).
 * Team events ride along in the same window, and ?includeGames=1 folds the
 * team's games in too — the calendar page polls this ONE endpoint for live
 * updates (one calendar, owner rule 2026-07-07).
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const membership = await getChatMembership(params.id, auth.userId, auth.isPlatformAdmin)
    if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const now = Date.now()
    const from = new Date(now - 7 * 86_400_000)
    const to = new Date(now + 70 * 86_400_000)
    const includeGames = new URL(request.url).searchParams.get("includeGames") === "1"

    const [practices, teamEvents, games] = await Promise.all([
      (prisma as any).practice.findMany({
        where: { teamId: params.id, scheduledAt: { gte: from, lte: to } },
        select: practiceSelect,
        orderBy: { scheduledAt: "asc" },
      }),
      (prisma as any).teamEvent.findMany({
        where: {
          teams: { some: { teamId: params.id } },
          startAt: { gte: from, lte: to },
        },
        select: {
          id: true,
          title: true,
          description: true,
          location: true,
          startAt: true,
          durationMinutes: true,
          status: true,
        },
        orderBy: { startAt: "asc" },
      }),
      includeGames
        ? (prisma as any).game.findMany({
            where: {
              OR: [{ homeTeamId: params.id }, { awayTeamId: params.id }],
              scheduledAt: { gte: from, lte: to },
              status: { in: ["SCHEDULED", "LIVE", "COMPLETED"] },
            },
            select: {
              id: true,
              scheduledAt: true,
              status: true,
              homeScore: true,
              awayScore: true,
              homeTeamId: true,
              homeTeam: { select: { name: true } },
              awayTeam: { select: { name: true } },
              venue: { select: { name: true } },
            },
            orderBy: { scheduledAt: "asc" },
          })
        : Promise.resolve([]),
    ])

    return NextResponse.json({
      practices: practices.map(serializePractice),
      events: teamEvents,
      games: games.map((g: any) => ({
        id: g.id,
        scheduledAt: g.scheduledAt,
        status: g.status,
        isHome: g.homeTeamId === params.id,
        opponent: g.homeTeamId === params.id ? g.awayTeam.name : g.homeTeam.name,
        usScore: g.homeTeamId === params.id ? g.homeScore : g.awayScore,
        themScore: g.homeTeamId === params.id ? g.awayScore : g.homeScore,
        venue: g.venue?.name ?? null,
      })),
      membership: { role: membership.role },
    })
  } catch (error) {
    console.error("Practice list error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

const createSchema = z.object({
  scheduledAt: z.string().datetime(),
  durationMinutes: z.number().int().min(15).max(360).default(90),
  location: z.string().trim().max(200).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
})

/** POST /api/teams/[id]/practices — staff add a one-off practice (notifies) */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const membership = await getChatMembership(params.id, auth.userId, auth.isPlatformAdmin)
    if (!membership || membership.role === "family") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const parsed = createSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Invalid practice" },
        { status: 400 }
      )
    }

    const practice = await (prisma as any).practice.create({
      data: {
        teamId: params.id,
        tenantId: membership.tenantId,
        scheduledAt: new Date(parsed.data.scheduledAt),
        duration: parsed.data.durationMinutes,
        location: parsed.data.location || null,
        notes: parsed.data.notes || null,
      },
      select: practiceSelect,
    })

    const when = formatPracticeDate(practice.scheduledAt)
    await notifyTeam({
      teamId: membership.teamId,
      tenantId: membership.tenantId,
      excludeUserId: auth.userId,
      type: "practice_change",
      title: `Practice added — ${membership.teamName}`,
      message: `${when}${practice.location ? ` at ${practice.location}` : ""}`,
      link: `/teams/${membership.teamId}/calendar`,
      referenceId: membership.teamId,
      emailSubject: `Practice added — ${membership.teamName}: ${when}`,
      emailHtml: `<p>A practice was added for <strong>${membership.teamName}</strong>.</p><p><strong>${when}</strong>${practice.location ? ` at ${practice.location}` : ""} (${practice.duration} min)</p><p>Team calendar: <a href="${process.env.NEXTAUTH_URL || ""}/teams/${membership.teamId}/calendar">view schedule</a></p>`,
    })

    return NextResponse.json({ practice: serializePractice(practice) }, { status: 201 })
  } catch (error) {
    console.error("Practice create error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
