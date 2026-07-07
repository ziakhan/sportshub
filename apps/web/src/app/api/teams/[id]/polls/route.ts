import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { getSessionUserId } from "@/lib/auth-helpers"
import { notifyMany } from "@/lib/notifications"
import { getChatMembers, getChatMembership } from "@/lib/teams/chat-access"
import { pollInclude, serializePoll } from "@/lib/teams/polls"

export const dynamic = "force-dynamic"

/**
 * Team polls & surveys (engagement v1). Membership mirrors team chat:
 * staff (club owners/managers + team Staff/TeamManager) create, close and
 * delete; staff + rostered families vote and see aggregate results. Staff
 * additionally see who picked what.
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

/** GET /api/teams/[id]/polls — open polls first, newest first within group */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const membership = await getChatMembership(params.id, auth.userId, auth.isPlatformAdmin)
    if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const polls = await (prisma as any).poll.findMany({
      where: { teamId: params.id },
      include: pollInclude,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 50,
    })

    const isStaffView = membership.role !== "family"
    return NextResponse.json({
      membership: { role: membership.role },
      polls: polls.map((p: any) => serializePoll(p, auth.userId, isStaffView)),
    })
  } catch (error) {
    console.error("Poll list error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/** POST /api/teams/[id]/polls — staff only; nested create, bells members */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const membership = await getChatMembership(params.id, auth.userId, auth.isPlatformAdmin)
    if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    if (membership.role === "family") {
      return NextResponse.json({ error: "Only team staff can create polls" }, { status: 403 })
    }

    const parsed = createPollSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Invalid poll" },
        { status: 400 }
      )
    }

    const poll = await (prisma as any).poll.create({
      data: {
        teamId: params.id,
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

    const members = await getChatMembers(membership.teamId, membership.tenantId)
    const toNotify = members.userIds.filter((id) => id !== auth.userId)
    if (toNotify.length > 0) {
      await notifyMany(prisma, toNotify, {
        type: "team_poll",
        title: `New poll for ${membership.teamName}`,
        message: parsed.data.title,
        link: `/teams/${membership.teamId}/polls`,
        referenceId: poll.id,
        referenceType: "Poll",
      })
    }

    return NextResponse.json({ poll: serializePoll(poll, auth.userId, true) }, { status: 201 })
  } catch (error) {
    console.error("Poll create error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
