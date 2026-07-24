"use client"

import Link from "next/link"
import { useState } from "react"
import { PollCard } from "@/components/polls/poll-card"
import {
  seedSelections,
  type PollQuestionView,
  type PollView,
  type Selections,
} from "@/components/polls/poll-types"

/**
 * The findable poll surface (three-tier polls ruling, owner 2026-07-24):
 * every OPEN poll the viewer can see across all three scopes — their teams,
 * their clubs, and their leagues — in one place, with voting wired straight
 * to the right scope's vote endpoint. Team polls also have their own full
 * page (`/teams/[id]/polls`); club/league polls have no other family-facing
 * surface, since their manage tabs live in the staff-only workspace.
 */

export interface ScopedPollView {
  scope: "team" | "club" | "league"
  scopeId: string
  scopeName: string
  /** Staff-only "manage this poll" link into the owning workspace tab. */
  scopeHref: string
  isStaff: boolean
  poll: PollView
}

function voteUrl(item: ScopedPollView): string {
  if (item.scope === "team") return `/api/teams/${item.scopeId}/polls/${item.poll.id}/vote`
  if (item.scope === "club") return `/api/clubs/${item.scopeId}/polls/${item.poll.id}/vote`
  return `/api/leagues/${item.scopeId}/polls/${item.poll.id}/vote`
}

export function AllPollsClient({ initial }: { initial: ScopedPollView[] }) {
  const [items, setItems] = useState(initial)
  const [selections, setSelections] = useState<Record<string, Selections>>(
    Object.fromEntries(initial.map((i) => [i.poll.id, seedSelections(i.poll)]))
  )
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function toggle(item: ScopedPollView, question: PollQuestionView, optionId: string) {
    if (item.poll.status !== "OPEN") return
    setSelections((current) => {
      const forPoll = { ...(current[item.poll.id] ?? {}) }
      const chosen = new Set(forPoll[question.id] ?? [])
      if (question.allowMultiple) {
        if (chosen.has(optionId)) chosen.delete(optionId)
        else chosen.add(optionId)
      } else {
        chosen.clear()
        chosen.add(optionId)
      }
      forPoll[question.id] = [...chosen]
      return { ...current, [item.poll.id]: forPoll }
    })
  }

  function isDirty(item: ScopedPollView): boolean {
    const forPoll = selections[item.poll.id] ?? {}
    return item.poll.questions.some((q) => {
      const recorded = q.options
        .filter((o) => o.mine)
        .map((o) => o.id)
        .sort()
      const chosen = [...(forPoll[q.id] ?? [])].sort()
      return chosen.length > 0 && JSON.stringify(recorded) !== JSON.stringify(chosen)
    })
  }

  async function submitVote(item: ScopedPollView) {
    const forPoll = selections[item.poll.id] ?? {}
    const answers = item.poll.questions
      .map((q) => ({ questionId: q.id, optionIds: forPoll[q.id] ?? [] }))
      .filter((a) => a.optionIds.length > 0)
    if (answers.length === 0) return
    setBusy(item.poll.id)
    setError(null)
    try {
      const res = await fetch(voteUrl(item), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setItems((current) =>
        current.map((i) => (i.poll.id === item.poll.id ? { ...i, poll: data.poll } : i))
      )
      setSelections((current) => ({ ...current, [item.poll.id]: seedSelections(data.poll) }))
    } catch (e: any) {
      setError(e?.message || "Couldn't record your vote. Try again.")
    } finally {
      setBusy(null)
    }
  }

  if (items.length === 0) {
    return (
      <div className="border-ink-200 rounded-2xl border border-dashed bg-white px-6 py-12 text-center">
        <p className="text-ink-700 text-sm font-semibold">No open polls right now</p>
        <p className="text-ink-500 mt-1 text-sm">
          Polls from your teams, clubs, and leagues will show up here.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && <p className="rounded-xl bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}
      {items.map((item) => (
        <div key={item.poll.id} className="space-y-1.5">
          <PollCard
            poll={item.poll}
            isStaff={item.isStaff}
            busy={busy === item.poll.id}
            selections={selections[item.poll.id] ?? {}}
            dirty={isDirty(item)}
            onToggle={(q, optionId) => toggle(item, q, optionId)}
            onVote={() => submitVote(item)}
            scopeLabel={item.scopeName}
          />
          {item.isStaff && (
            <Link
              href={item.scopeHref}
              className="text-play-600 hover:text-play-700 inline-block pl-1 text-xs font-semibold"
            >
              Manage this poll →
            </Link>
          )}
        </div>
      ))}
    </div>
  )
}
