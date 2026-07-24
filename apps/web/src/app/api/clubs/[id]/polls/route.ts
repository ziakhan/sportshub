import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { getSessionUserId } from "@/lib/auth-helpers"
import { notifyMany } from "@/lib/notifications"
import { canManageClubPolls } from "@/lib/polls/authz"
import { clubPollAudienceUserIds, isClubPollAudience } from "@/lib/polls/audience"
import { relayPollToTeamChat } from "@/lib/polls/chat-relay"
import { pollInclude, serializePoll } from "@/lib/teams/polls"

export const dynamic = "force-dynamic"

/**
 * Club-wide polls (three-tier polls ruling, owner 2026-07-24). ClubOwner/
 * ClubManager create; the audience is everyone with a role at the tenant
 * plus parents of an ACTIVE rostered player on any of its teams (the same
 * cascade `api/clubs/[id]/announcements` uses). Voting/list reuse
 * `canSeePoll` via `isClubPollAudience`.
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
  // "Also post to team chats" — default OFF (owner ruling). Empty/omitted =
  // no chat relay at all.
  relayTeamIds: z.array(z.string()).max(200).optional().default([]),
})

/** GET /api/clubs/[id]/polls — open polls first, newest first within group */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const isStaff = auth.isPlatformAdmin || (await canManageClubPolls(auth.userId, params.id))
    if (!isStaff && !(await isClubPollAudience(auth.userId, params.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const [polls, teams] = await Promise.all([
      (prisma as any).poll.findMany({
        where: { tenantId: params.id },
        include: pollInclude,
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        take: 50,
      }),
      // Staff-only: powers the "Also post to team chats" picker on create.
      isStaff
        ? prisma.team.findMany({
            where: { tenantId: params.id, archivedAt: null },
            select: { id: true, name: true },
            orderBy: { name: "asc" },
          })
        : Promise.resolve([]),
    ])

    return NextResponse.json({
      isStaff,
      teams,
      polls: polls.map((p: any) => serializePoll(p, auth.userId, isStaff)),
    })
  } catch (error) {
    console.error("Club poll list error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/** POST /api/clubs/[id]/polls — ClubOwner/ClubManager only */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!(await canManageClubPolls(auth.userId, params.id, auth.isPlatformAdmin))) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 })
    }

    const parsed = createPollSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Invalid poll" },
        { status: 400 }
      )
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: params.id },
      select: { name: true },
    })
    if (!tenant) return NextResponse.json({ error: "Club not found" }, { status: 404 })

    const poll = await (prisma as any).poll.create({
      data: {
        tenantId: params.id,
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

    // Bell fanout to the club's whole poll audience — best-effort, mirrors
    // the announcement bell fanout (never fails the poll creation itself).
    try {
      const audience = (await clubPollAudienceUserIds(params.id)).filter((id) => id !== auth.userId)
      if (audience.length > 0) {
        await notifyMany(prisma, audience, {
          type: "club_poll",
          title: `${tenant.name}: ${parsed.data.title}`,
          message: "New club poll. Cast your vote.",
          link: `/polls`,
          referenceId: poll.id,
          referenceType: "Poll",
        })
      }
    } catch (notifyError) {
      console.error("Club poll bell fanout failed:", notifyError)
    }

    // Opt-in chat relay ("Also post to team chats", default OFF): only the
    // explicitly selected teams get a chat message — never a blast to every
    // team in the club.
    let relayedTeams = 0
    if (parsed.data.relayTeamIds.length > 0) {
      const teams = await prisma.team.findMany({
        where: { id: { in: parsed.data.relayTeamIds }, tenantId: params.id },
        select: { id: true, name: true },
      })
      for (const team of teams) {
        try {
          await relayPollToTeamChat({
            pollId: poll.id,
            teamId: team.id,
            teamName: team.name,
            tenantId: params.id,
            senderId: auth.userId,
            body: poll.title,
          })
          relayedTeams += 1
        } catch (relayError) {
          console.error("Club poll chat relay failed:", team.id, relayError)
        }
      }
    }

    return NextResponse.json(
      { poll: serializePoll(poll, auth.userId, true), relayedTeams },
      { status: 201 }
    )
  } catch (error) {
    console.error("Club poll create error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
