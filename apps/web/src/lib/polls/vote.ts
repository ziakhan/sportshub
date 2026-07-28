import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { pollInclude, serializePoll } from "@/lib/teams/polls"

/**
 * Shared vote-submission core — three-tier polls ruling (owner 2026-07-24).
 * Extracted from `api/teams/[id]/polls/[pollId]/vote` (left untouched and
 * still the team-scope entry point) so the new club/league vote routes
 * reuse the exact same validate-then-replace logic instead of forking it.
 */

export const voteSchema = z.object({
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

export type VoteInput = z.infer<typeof voteSchema>

export type PollVoteResult =
  | { ok: true; poll: ReturnType<typeof serializePoll> }
  | { ok: false; status: number; error: string }

/** Submit (or replace) one voter's answers on an already-authorized poll. */
export async function submitPollVote(
  pollId: string,
  userId: string,
  data: VoteInput,
  isStaffView: boolean
): Promise<PollVoteResult> {
  const poll = await (prisma as any).poll.findUnique({
    where: { id: pollId },
    select: {
      id: true,
      status: true,
      questions: { select: { id: true, allowMultiple: true, options: { select: { id: true } } } },
    },
  })
  if (!poll) return { ok: false, status: 404, error: "Poll not found" }
  if (poll.status !== "OPEN") return { ok: false, status: 400, error: "This poll is closed" }

  const questionById = new Map<string, { allowMultiple: boolean; optionIds: Set<string> }>(
    poll.questions.map((q: any) => [
      q.id,
      { allowMultiple: q.allowMultiple, optionIds: new Set(q.options.map((o: any) => o.id)) },
    ])
  )

  const cleaned: Array<{ questionId: string; optionIds: string[] }> = []
  const seenQuestions = new Set<string>()
  for (const answer of data.answers) {
    const question = questionById.get(answer.questionId)
    if (!question) return { ok: false, status: 400, error: "Unknown question" }
    if (seenQuestions.has(answer.questionId)) {
      return { ok: false, status: 400, error: "Duplicate question in submission" }
    }
    seenQuestions.add(answer.questionId)

    const optionIds = [...new Set(answer.optionIds)]
    if (optionIds.some((id) => !question.optionIds.has(id))) {
      return { ok: false, status: 400, error: "Unknown option" }
    }
    if (!question.allowMultiple && optionIds.length > 1) {
      return { ok: false, status: 400, error: "This question allows only one choice" }
    }
    cleaned.push({ questionId: answer.questionId, optionIds })
  }

  await (prisma as any).$transaction(async (tx: any) => {
    for (const answer of cleaned) {
      await tx.pollVote.deleteMany({ where: { questionId: answer.questionId, userId } })
      await tx.pollVote.createMany({
        data: answer.optionIds.map((optionId) => ({
          questionId: answer.questionId,
          optionId,
          userId,
        })),
      })
    }
  })

  const updated = await (prisma as any).poll.findUnique({ where: { id: pollId }, include: pollInclude })
  return { ok: true, poll: serializePoll(updated, userId, isStaffView) }
}
