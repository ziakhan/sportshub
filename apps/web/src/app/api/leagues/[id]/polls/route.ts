import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { getSessionUserId } from "@/lib/auth-helpers"
import { notifyMany } from "@/lib/notifications"
import { canManageLeaguePolls } from "@/lib/polls/authz"
import { isLeaguePollAudience, leaguePollAudienceUserIds } from "@/lib/polls/audience"
import { pollInclude, serializePoll } from "@/lib/teams/polls"

export const dynamic = "force-dynamic"

/**
 * League-wide polls (three-tier polls ruling, owner 2026-07-24). LeagueOwner/
 * LeagueManager create; the audience is every operator, staff, and family
 * of a team with an APPROVED submission into one of the league's seasons
 * (the same cascade `seasons/[id]/schedule/commit` uses for
 * `schedule_published`). No chat relay — league polls never post to team
 * chats (owner: maybe later).
 */

const createPollSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(150),
  description: z.string().trim().max(1000).optional(),
  questions: z
    .array(
      z.object({
        prompt: z.string().trim().min(1, "Question prompt is required").max(300),
        allowMultiple: z.boolean().optional().default(false),
        options: z
          .array(z.string().trim().min(1, "Option can't be empty").max(100))
          .min(2, "Each question needs at least 2 options")
          .max(12),
      })
    )
    .min(1, "Add at least one question")
    .max(10),
})

/** GET /api/leagues/[id]/polls — open polls first, newest first within group */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const isStaff = auth.isPlatformAdmin || (await canManageLeaguePolls(auth.userId, params.id))
    if (!isStaff && !(await isLeaguePollAudience(auth.userId, params.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const polls = await (prisma as any).poll.findMany({
      where: { leagueId: params.id },
      include: pollInclude,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 50,
    })

    return NextResponse.json({
      isStaff,
      polls: polls.map((p: any) => serializePoll(p, auth.userId, isStaff)),
    })
  } catch (error) {
    console.error("League poll list error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/** POST /api/leagues/[id]/polls — LeagueOwner/LeagueManager only */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!(await canManageLeaguePolls(auth.userId, params.id, auth.isPlatformAdmin))) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 })
    }

    const parsed = createPollSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Invalid poll" },
        { status: 400 }
      )
    }

    const league = await prisma.league.findUnique({ where: { id: params.id }, select: { name: true } })
    if (!league) return NextResponse.json({ error: "League not found" }, { status: 404 })

    const poll = await (prisma as any).poll.create({
      data: {
        leagueId: params.id,
        createdById: auth.userId,
        title: parsed.data.title,
        description: parsed.data.description || null,
        questions: {
          create: parsed.data.questions.map((q, qi) => ({
            prompt: q.prompt,
            allowMultiple: q.allowMultiple,
            order: qi,
            options: { create: q.options.map((label, oi) => ({ label, order: oi })) },
          })),
        },
      },
      include: pollInclude,
    })

    // Bell fanout to the whole league — best-effort, mirrors the
    // schedule_published fanout (never fails the poll creation itself).
    try {
      const audience = (await leaguePollAudienceUserIds(params.id)).filter((id) => id !== auth.userId)
      if (audience.length > 0) {
        await notifyMany(prisma, audience, {
          type: "league_poll",
          title: `${league.name}: ${parsed.data.title}`,
          message: "New league poll. Cast your vote.",
          link: `/polls`,
          referenceId: poll.id,
          referenceType: "Poll",
        })
      }
    } catch (notifyError) {
      console.error("League poll bell fanout failed:", notifyError)
    }

    return NextResponse.json({ poll: serializePoll(poll, auth.userId, true) }, { status: 201 })
  } catch (error) {
    console.error("League poll create error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
