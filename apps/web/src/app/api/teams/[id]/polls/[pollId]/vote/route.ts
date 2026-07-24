import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { getSessionUserId } from "@/lib/auth-helpers"
import { getChatMembership } from "@/lib/teams/chat-access"
import { pollInclude, serializePoll } from "@/lib/teams/polls"

export const dynamic = "force-dynamic"

const voteSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.string().min(1),
        optionIds: z.array(z.string().min(1)).min(1, "Pick at least one option").max(12),
      })
    )
    .min(1, "Answer at least one question")
    .max(10),
})

/**
 * POST /api/teams/[id]/polls/[pollId]/vote — any member (staff or family).
 * Answers any subset of questions; re-submitting a question replaces that
 * question's previous choices. Single-choice questions accept exactly one
 * option. Returns the freshly aggregated poll.
 *
 * Also serves the PollBubble embedded in this team's chat for polls relayed
 * in from another scope (a club poll with "Also post to team chats" —
 * three-tier polls ruling, owner 2026-07-24): team-chat membership is the
 * gate either way, so voting through the chat bubble needs no client change.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; pollId: string } }
) {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const membership = await getChatMembership(params.id, auth.userId, auth.isPlatformAdmin)
    if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const parsed = voteSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Invalid vote" },
        { status: 400 }
      )
    }

    // Own-team poll OR a poll relayed into this team's chat (three-tier
    // polls ruling, owner 2026-07-24): a club poll with "Also post to team
    // chats" checked carries no teamId of its own, but the PollBubble in
    // this team's chat still needs to vote through this exact route.
    const poll = await (prisma as any).poll.findFirst({
      where: {
        id: params.pollId,
        OR: [{ teamId: params.id }, { chatMessages: { some: { teamId: params.id } } }],
      },
      select: {
        id: true,
        status: true,
        questions: { select: { id: true, allowMultiple: true, options: { select: { id: true } } } },
      },
    })
    if (!poll) return NextResponse.json({ error: "Poll not found" }, { status: 404 })
    if (poll.status !== "OPEN") {
      return NextResponse.json({ error: "This poll is closed" }, { status: 400 })
    }

    const questionById = new Map<string, { allowMultiple: boolean; optionIds: Set<string> }>(
      poll.questions.map((q: any) => [
        q.id,
        { allowMultiple: q.allowMultiple, optionIds: new Set(q.options.map((o: any) => o.id)) },
      ])
    )

    // Validate every answer against the poll's own structure
    const cleaned: Array<{ questionId: string; optionIds: string[] }> = []
    const seenQuestions = new Set<string>()
    for (const answer of parsed.data.answers) {
      const question = questionById.get(answer.questionId)
      if (!question) {
        return NextResponse.json({ error: "Unknown question" }, { status: 400 })
      }
      if (seenQuestions.has(answer.questionId)) {
        return NextResponse.json({ error: "Duplicate question in submission" }, { status: 400 })
      }
      seenQuestions.add(answer.questionId)

      const optionIds = [...new Set(answer.optionIds)]
      if (optionIds.some((id) => !question.optionIds.has(id))) {
        return NextResponse.json({ error: "Unknown option" }, { status: 400 })
      }
      if (!question.allowMultiple && optionIds.length > 1) {
        return NextResponse.json(
          { error: "This question allows only one choice" },
          { status: 400 }
        )
      }
      cleaned.push({ questionId: answer.questionId, optionIds })
    }

    // Replace this member's choices for each answered question atomically
    await (prisma as any).$transaction(async (tx: any) => {
      for (const answer of cleaned) {
        await tx.pollVote.deleteMany({
          where: { questionId: answer.questionId, userId: auth.userId },
        })
        await tx.pollVote.createMany({
          data: answer.optionIds.map((optionId) => ({
            questionId: answer.questionId,
            optionId,
            userId: auth.userId,
          })),
        })
      }
    })

    const updated = await (prisma as any).poll.findUnique({
      where: { id: params.pollId },
      include: pollInclude,
    })
    return NextResponse.json({
      poll: serializePoll(updated, auth.userId, membership.role !== "family"),
    })
  } catch (error) {
    console.error("Poll vote error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
