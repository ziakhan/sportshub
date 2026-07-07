/**
 * Team polls — shared shapes for the poll API routes (engagement v1,
 * docs/engagement-features-plan.md). Membership mirrors team chat
 * (lib/teams/chat-access): staff create/close/delete, staff + rostered
 * families vote and read results.
 */

/** Prisma include used by every poll read — questions, options, votes. */
export const pollInclude = {
  createdBy: { select: { id: true, firstName: true, lastName: true } },
  questions: {
    include: {
      options: true,
      votes: {
        select: {
          userId: true,
          optionId: true,
          user: { select: { firstName: true, lastName: true } },
        },
      },
    },
  },
}

/**
 * Compact shape for a quick poll embedded in a chat message bubble —
 * single question, counts + the viewer's own picks (no names; the polls
 * page has the staff detail view).
 */
export function serializeChatPoll(poll: any, viewerId: string) {
  const question = [...poll.questions].sort((a: any, b: any) => a.order - b.order)[0]
  if (!question) return null
  const voters = new Set<string>(question.votes.map((v: any) => v.userId))
  const countByOption = new Map<string, number>()
  const mine = new Set<string>()
  for (const v of question.votes) {
    countByOption.set(v.optionId, (countByOption.get(v.optionId) ?? 0) + 1)
    if (v.userId === viewerId) mine.add(v.optionId)
  }
  return {
    id: poll.id,
    questionId: question.id,
    question: question.prompt,
    allowMultiple: question.allowMultiple,
    status: poll.status,
    voterCount: voters.size,
    options: [...question.options]
      .sort((a: any, b: any) => a.order - b.order)
      .map((o: any) => ({
        id: o.id,
        label: o.label,
        count: countByOption.get(o.id) ?? 0,
        mine: mine.has(o.id),
      })),
  }
}

/**
 * Aggregate a poll (loaded with pollInclude) for one viewer. Families see
 * counts and their own choices; staff additionally see voter names.
 */
export function serializePoll(poll: any, viewerId: string, isStaffView: boolean) {
  const votersByPoll = new Set<string>()
  const questions = [...poll.questions]
    .sort((a: any, b: any) => a.order - b.order)
    .map((q: any) => {
      const votersByOption = new Map<string, any[]>()
      const questionVoters = new Set<string>()
      for (const v of q.votes) {
        questionVoters.add(v.userId)
        votersByPoll.add(v.userId)
        const list = votersByOption.get(v.optionId) ?? []
        list.push(v)
        votersByOption.set(v.optionId, list)
      }
      return {
        id: q.id,
        prompt: q.prompt,
        allowMultiple: q.allowMultiple,
        voterCount: questionVoters.size,
        myAnswered: q.votes.some((v: any) => v.userId === viewerId),
        options: [...q.options]
          .sort((a: any, b: any) => a.order - b.order)
          .map((o: any) => {
            const votes = votersByOption.get(o.id) ?? []
            return {
              id: o.id,
              label: o.label,
              count: votes.length,
              mine: votes.some((v: any) => v.userId === viewerId),
              // Names are staff-only — families see counts, not who
              ...(isStaffView
                ? {
                    voters: votes.map((v: any) =>
                      [v.user.firstName, v.user.lastName].filter(Boolean).join(" ")
                    ),
                  }
                : {}),
            }
          }),
      }
    })

  return {
    id: poll.id,
    title: poll.title,
    description: poll.description,
    status: poll.status,
    createdAt: poll.createdAt,
    closedAt: poll.closedAt,
    createdBy: {
      id: poll.createdBy.id,
      name: [poll.createdBy.firstName, poll.createdBy.lastName].filter(Boolean).join(" "),
    },
    totalVoters: votersByPoll.size,
    questions,
  }
}
