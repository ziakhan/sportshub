import { apiJson } from "@/lib/api"

/**
 * Native twin of apps/web's polls/poll-types.ts + all-polls-client.tsx — the
 * findable poll surface (three-tier polls ruling, owner 2026-07-24): every
 * OPEN poll the viewer can see across their teams, clubs and leagues, served
 * in one list by GET /api/mobile/polls. Voting posts straight to the scope's
 * existing vote endpoint (team/club/league) — no separate native vote route.
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

export type PollScope = "team" | "club" | "league"

export interface ScopedPollItem {
  scope: PollScope
  scopeId: string
  scopeName: string
  isStaff: boolean
  poll: PollView
}

export async function fetchMyPolls(): Promise<ScopedPollItem[]> {
  const data = await apiJson<{ items: ScopedPollItem[] }>("/api/mobile/polls")
  return data.items
}

/** The scope-specific vote endpoint — same one the web all-polls-client uses. */
export function pollVoteUrl(item: Pick<ScopedPollItem, "scope" | "scopeId">, pollId: string): string {
  if (item.scope === "team") return `/api/teams/${item.scopeId}/polls/${pollId}/vote`
  if (item.scope === "club") return `/api/clubs/${item.scopeId}/polls/${pollId}/vote`
  return `/api/leagues/${item.scopeId}/polls/${pollId}/vote`
}

export type Selections = Record<string, string[]>

export function seedSelections(poll: PollView): Selections {
  const out: Selections = {}
  for (const q of poll.questions) {
    out[q.id] = q.options.filter((o) => o.mine).map((o) => o.id)
  }
  return out
}

export function scopeLabel(scope: PollScope): string {
  return scope === "team" ? "Team" : scope === "club" ? "Club" : "League"
}
