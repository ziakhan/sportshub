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
    <div className="mt-1.5 min-w-[240px] space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="bg-energy-soft text-energy-ink flex h-6 w-6 shrink-0 items-center justify-center rounded-md">
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
            <rect x="1.5" y="9" width="3" height="5.5" rx="0.75" />
            <rect x="6.5" y="5" width="3" height="9.5" rx="0.75" />
            <rect x="11.5" y="1.5" width="3" height="13" rx="0.75" />
          </svg>
        </span>
        <p className="flex-1 text-[15px] font-extrabold leading-snug">{poll.question}</p>
        {!open && (
          <span className="bg-ink-200 text-ink-600 shrink-0 rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide">
            Closed
          </span>
        )}
      </div>
      {poll.options.map((option) => {
        const share = poll.voterCount > 0 ? Math.round((option.count / poll.voterCount) * 100) : 0
        const leading = !open && option.count === maxCount && option.count > 0
        return (
          <button
            key={option.id}
            onClick={() => tap(option.id)}
            disabled={!open || busy}
            className={`relative block w-full overflow-hidden rounded-xl border-[1.5px] px-3 py-2 text-left text-sm transition ${
              option.mine
                ? "border-energy"
                : leading
                  ? "border-highlight"
                  : "border-ink-200"
            } ${open ? "hover:border-ink-400 cursor-pointer" : "cursor-default"}`}
          >
            <span
              className={`absolute inset-y-0 left-0 transition-[width] duration-300 ${
                option.mine ? "bg-energy-soft" : leading ? "bg-highlight-soft" : "bg-ink-100/70"
              }`}
              style={{ width: `${(option.count / maxCount) * 100}%` }}
              aria-hidden
            />
            <span className="relative flex items-center gap-2">
              {option.mine && (
                <span className="bg-energy text-energy-on flex h-[17px] w-[17px] shrink-0 items-center justify-center rounded-full text-[10px] font-black">
                  ✓
                </span>
              )}
              {leading && !option.mine && <span aria-hidden>🏆</span>}
              <span className="text-ink-900 min-w-0 flex-1 truncate font-semibold">
                {option.label}
              </span>
              <span
                className={`shrink-0 text-[13px] font-extrabold tabular-nums ${
                  option.mine ? "text-energy-ink" : "text-ink-500"
                }`}
              >
                {option.count} · {share}%
              </span>
            </span>
          </button>
        )
      })}
      <p className="text-ink-500 text-[12px]">
        {poll.voterCount} {poll.voterCount === 1 ? "vote" : "votes"}
        {poll.allowMultiple ? " · multiple choices allowed" : ""}
        {open ? " · tap to vote" : ""}
      </p>
    </div>
  )
}
