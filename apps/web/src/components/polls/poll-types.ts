/**
 * Shared poll view shapes — three-tier polls ruling (owner 2026-07-24).
 * Matches `serializePoll()` (lib/teams/polls.ts), which every scope's list
 * and vote API returns unchanged regardless of teamId/tenantId/leagueId.
 */

export interface PollOptionView {
  id: string
  label: string
  count: number
  mine: boolean
  voters?: string[]
}

export interface PollQuestionView {
  id: string
  prompt: string
  allowMultiple: boolean
  voterCount: number
  myAnswered: boolean
  options: PollOptionView[]
}

export interface PollView {
  id: string
  title: string
  description: string | null
  status: "OPEN" | "CLOSED"
  createdAt: string
  createdBy: { id: string; name: string }
  totalVoters: number
  questions: PollQuestionView[]
}

/** questionId -> chosen optionIds, seeded from the viewer's recorded votes */
export type Selections = Record<string, string[]>

export function seedSelections(poll: PollView): Selections {
  const out: Selections = {}
  for (const q of poll.questions) {
    out[q.id] = q.options.filter((o) => o.mine).map((o) => o.id)
  }
  return out
}
