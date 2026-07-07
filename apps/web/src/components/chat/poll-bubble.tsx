"use client"

import { useState } from "react"

/**
 * Quick poll inside a chat bubble — WhatsApp-style. Tap an option to vote
 * (single-choice taps switch; multi-choice taps toggle); bars show live
 * results relative to the leading option. Shared by the team chat page and
 * the floating chat dock.
 */

export interface ChatPollData {
  id: string
  questionId: string
  question: string
  allowMultiple: boolean
  status: "OPEN" | "CLOSED"
  voterCount: number
  options: Array<{ id: string; label: string; count: number; mine: boolean }>
}

/** The vote endpoint returns the full poll shape; fold it back to chat shape */
export function toChatPoll(poll: any): ChatPollData | null {
  const question = poll?.questions?.[0]
  if (!question) return null
  return {
    id: poll.id,
    questionId: question.id,
    question: question.prompt,
    allowMultiple: question.allowMultiple,
    status: poll.status,
    voterCount: question.voterCount,
    options: question.options.map((o: any) => ({
      id: o.id,
      label: o.label,
      count: o.count,
      mine: o.mine,
    })),
  }
}

export function PollBubble({
  teamId,
  poll,
  onUpdate,
}: {
  teamId: string
  poll: ChatPollData
  onUpdate: (poll: ChatPollData) => void
}) {
  const [busy, setBusy] = useState(false)
  const open = poll.status === "OPEN"
  const maxCount = Math.max(1, ...poll.options.map((o) => o.count))

  async function tap(optionId: string) {
    if (!open || busy) return
    let optionIds: string[]
    if (poll.allowMultiple) {
      const mine = new Set(poll.options.filter((o) => o.mine).map((o) => o.id))
      if (mine.has(optionId)) mine.delete(optionId)
      else mine.add(optionId)
      if (mine.size === 0) return // keep at least one choice once voted
      optionIds = [...mine]
    } else {
      if (poll.options.find((o) => o.id === optionId)?.mine) return // already my pick
      optionIds = [optionId]
    }
    setBusy(true)
    try {
      const res = await fetch(`/api/teams/${teamId}/polls/${poll.id}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: [{ questionId: poll.questionId, optionIds }] }),
      })
      if (!res.ok) return
      const updated = toChatPoll((await res.json()).poll)
      if (updated) onUpdate(updated)
    } catch {
      // transient — the next chat poll cycle refreshes counts anyway
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-1 space-y-1">
      <p className="text-[13px] font-semibold">
        📊 {poll.question}
        {!open && (
          <span className="bg-ink-200 text-ink-600 ml-1.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase">
            Closed
          </span>
        )}
      </p>
      {poll.options.map((option) => {
        const share = poll.voterCount > 0 ? Math.round((option.count / poll.voterCount) * 100) : 0
        return (
          <button
            key={option.id}
            onClick={() => tap(option.id)}
            disabled={!open || busy}
            className={`relative block w-full overflow-hidden rounded-lg border px-2.5 py-1.5 text-left text-xs transition ${
              option.mine ? "border-play-400" : "border-ink-200"
            } ${open ? "cursor-pointer hover:border-ink-400" : "cursor-default"}`}
          >
            <span
              className={`absolute inset-y-0 left-0 ${option.mine ? "bg-play-100" : "bg-ink-100/70"}`}
              style={{ width: `${(option.count / maxCount) * 100}%` }}
              aria-hidden
            />
            <span className="relative flex items-center justify-between gap-2">
              <span className="text-ink-800 min-w-0 truncate">
                {option.mine ? "✓ " : ""}
                {option.label}
              </span>
              <span className="text-ink-500 shrink-0 font-semibold">
                {option.count} · {share}%
              </span>
            </span>
          </button>
        )
      })}
      <p className="text-ink-400 text-[10px]">
        {poll.voterCount} {poll.voterCount === 1 ? "vote" : "votes"}
        {poll.allowMultiple ? " · multiple choices allowed" : ""}
        {open ? " · tap to vote" : ""}
      </p>
    </div>
  )
}
