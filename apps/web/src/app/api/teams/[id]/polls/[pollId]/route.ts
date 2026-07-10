import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { getSessionUserId } from "@/lib/auth-helpers"
import { getChatMembership } from "@/lib/teams/chat-access"
import { pollInclude, serializePoll } from "@/lib/teams/polls"

export const dynamic = "force-dynamic"

/**
 * PATCH body — either lifecycle or content edit:
 *   { action: "close" | "reopen" }
 *   { action: "edit", title?, description?, questions? }
 *
 * Edit rules (votes reference option IDs, so relabeling is always safe):
 * - title / description / question prompts / option labels: editable any time
 * - adding a new option to a question: allowed any time
 * - removing an option: only while that option has zero votes (409 otherwise)
 * - adding or removing whole questions: only while the poll has zero votes
 *   in total (409 otherwise)
 * When `questions` is sent it is the COMPLETE desired list (edits carry the
 * question id, additions omit it, omissions are removals); the same
 * full-list semantics apply to each question's `options` array.
 */
const editOptionSchema = z.object({
  id: z.string().optional(), // existing option; omit to add a new one
  label: z.string().trim().min(1, "Option can't be empty").max(100),
})
const editQuestionSchema = z.object({
  id: z.string().optional(), // existing question; omit to add (zero-vote polls only)
  prompt: z.string().trim().min(1, "Question prompt is required").max(300).optional(),
  allowMultiple: z.boolean().optional(), // applied to NEW questions only
  options: z
    .array(editOptionSchema)
    .min(2, "Each question needs at least 2 options")
    .max(12)
    .optional(),
})
const patchSchema = z.union([
  z.object({ action: z.enum(["close", "reopen"]) }),
  z.object({
    action: z.literal("edit"),
    title: z.string().trim().min(1, "Title is required").max(150).optional(),
    description: z.string().trim().max(1000).nullable().optional(),
    questions: z
      .array(editQuestionSchema)
      .min(1, "A poll needs at least one question")
      .max(10)
      .optional(),
  }),
])

async function authorizeStaff(teamId: string, pollId: string) {
  const auth = await getSessionUserId()
  if (!auth) return { error: "Unauthorized", status: 401 as const }

  const membership = await getChatMembership(teamId, auth.userId, auth.isPlatformAdmin)
  if (!membership || membership.role === "family") {
    return { error: "Forbidden", status: 403 as const }
  }

  const poll = await (prisma as any).poll.findFirst({
    where: { id: pollId, teamId },
    select: { id: true, status: true },
  })
  if (!poll) return { error: "Poll not found", status: 404 as const }

  return { poll, auth }
}

/** PATCH /api/teams/[id]/polls/[pollId] — staff close/reopen voting, or edit content */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; pollId: string } }
) {
  try {
    const result = await authorizeStaff(params.id, params.pollId)
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    const parsed = patchSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Invalid action" },
        { status: 400 }
      )
    }

    if (parsed.data.action !== "edit") {
      const closing = parsed.data.action === "close"
      await (prisma as any).poll.update({
        where: { id: params.pollId },
        data: { status: closing ? "CLOSED" : "OPEN", closedAt: closing ? new Date() : null },
      })
      return NextResponse.json({ ok: true })
    }

    // ---- content edit ----
    const data = parsed.data
    const poll = await (prisma as any).poll.findUnique({
      where: { id: params.pollId },
      include: {
        questions: {
          orderBy: { order: "asc" },
          include: {
            options: {
              orderBy: { order: "asc" },
              include: { _count: { select: { votes: true } } },
            },
            _count: { select: { votes: true } },
          },
        },
      },
    })
    if (!poll) return NextResponse.json({ error: "Poll not found" }, { status: 404 })

    const totalVotes = poll.questions.reduce((sum: number, q: any) => sum + q._count.votes, 0)

    // Validate the whole plan before writing anything, then apply it in one
    // transaction so a mid-plan failure never leaves a half-edited poll.
    const writes: any[] = []

    if (data.title !== undefined || data.description !== undefined) {
      writes.push(
        (prisma as any).poll.update({
          where: { id: params.pollId },
          data: {
            ...(data.title !== undefined ? { title: data.title } : {}),
            ...(data.description !== undefined ? { description: data.description || null } : {}),
          },
        })
      )
    }

    if (data.questions) {
      const questionById = new Map(poll.questions.map((q: any) => [q.id, q]))
      for (const q of data.questions) {
        if (q.id && !questionById.has(q.id)) {
          return NextResponse.json(
            { error: "Unknown question — refresh and try again" },
            { status: 400 }
          )
        }
      }

      const incomingQuestionIds = new Set(
        data.questions.filter((q) => q.id).map((q) => q.id as string)
      )
      const removedQuestions = poll.questions.filter((q: any) => !incomingQuestionIds.has(q.id))
      const addedQuestions = data.questions.filter((q) => !q.id)

      if ((removedQuestions.length > 0 || addedQuestions.length > 0) && totalVotes > 0) {
        return NextResponse.json(
          {
            error:
              "Questions can't be added or removed once voting has started — edit the wording instead",
          },
          { status: 409 }
        )
      }
      for (const added of addedQuestions) {
        if (!added.prompt || !added.options) {
          return NextResponse.json(
            { error: "New questions need a prompt and at least 2 options" },
            { status: 400 }
          )
        }
      }

      for (const [qIndex, q] of data.questions.entries()) {
        if (!q.id) {
          // New question (only reachable on a zero-vote poll)
          writes.push(
            (prisma as any).pollQuestion.create({
              data: {
                pollId: params.pollId,
                prompt: q.prompt as string,
                allowMultiple: q.allowMultiple ?? false,
                order: qIndex,
                options: {
                  create: (q.options ?? []).map((o, oi) => ({ label: o.label, order: oi })),
                },
              },
            })
          )
          continue
        }

        const existing: any = questionById.get(q.id)
        writes.push(
          (prisma as any).pollQuestion.update({
            where: { id: q.id },
            data: { ...(q.prompt !== undefined ? { prompt: q.prompt } : {}), order: qIndex },
          })
        )

        if (q.options) {
          const optionById = new Map(existing.options.map((o: any) => [o.id, o]))
          for (const o of q.options) {
            if (o.id && !optionById.has(o.id)) {
              return NextResponse.json(
                { error: "Unknown option — refresh and try again" },
                { status: 400 }
              )
            }
          }
          const keptOptionIds = new Set(q.options.filter((o) => o.id).map((o) => o.id as string))
          const removedOptions = existing.options.filter((o: any) => !keptOptionIds.has(o.id))
          const votedRemoval = removedOptions.find((o: any) => o._count.votes > 0)
          if (votedRemoval) {
            return NextResponse.json(
              {
                error: `"${votedRemoval.label}" already has votes — voted options can be relabeled but not removed`,
              },
              { status: 409 }
            )
          }

          for (const [oIndex, o] of q.options.entries()) {
            if (o.id) {
              writes.push(
                (prisma as any).pollOption.update({
                  where: { id: o.id },
                  data: { label: o.label, order: oIndex },
                })
              )
            } else {
              writes.push(
                (prisma as any).pollOption.create({
                  data: { questionId: q.id, label: o.label, order: oIndex },
                })
              )
            }
          }
          if (removedOptions.length > 0) {
            writes.push(
              (prisma as any).pollOption.deleteMany({
                where: { id: { in: removedOptions.map((o: any) => o.id) } },
              })
            )
          }
        }
      }

      if (removedQuestions.length > 0) {
        writes.push(
          (prisma as any).pollQuestion.deleteMany({
            where: { id: { in: removedQuestions.map((q: any) => q.id) } },
          })
        )
      }
    }

    if (writes.length > 0) {
      await (prisma as any).$transaction(writes)
    }

    const fresh = await (prisma as any).poll.findUnique({
      where: { id: params.pollId },
      include: pollInclude,
    })
    return NextResponse.json({ ok: true, poll: serializePoll(fresh, result.auth.userId, true) })
  } catch (error) {
    console.error("Poll update error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/** DELETE /api/teams/[id]/polls/[pollId] — staff; cascades questions/votes */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string; pollId: string } }
) {
  try {
    const result = await authorizeStaff(params.id, params.pollId)
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    await (prisma as any).poll.delete({ where: { id: params.pollId } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Poll delete error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
