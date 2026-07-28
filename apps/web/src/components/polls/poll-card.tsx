"use client"

import { format } from "date-fns"
import type { PollQuestionView, PollView, Selections } from "./poll-types"

/**
 * Shared poll display + voting UI — three-tier polls ruling (owner
 * 2026-07-24). Extracted out of the team polls page so club and league
 * polls "reuse the existing vote flow/components" instead of forking the
 * markup. Behavior is unchanged for the team page, which now imports this.
 */

export function PollCard({
  poll,
  isStaff,
  busy,
  selections,
  dirty,
  onToggle,
  onVote,
  onManage,
  onEdit,
  scopeLabel,
}: {
  poll: PollView
  isStaff: boolean
  busy: boolean
  selections: Selections
  dirty: boolean
  onToggle: (question: PollQuestionView, optionId: string) => void
  onVote: () => void
  onManage?: (action: "close" | "reopen" | "delete") => void
  onEdit?: () => void
  /** Optional small badge, e.g. the team name a club poll was relayed to. */
  scopeLabel?: string
}) {
  const open = poll.status === "OPEN"
  const answeredAll = poll.questions.every((q) => q.myAnswered)

  return (
    <div className="border-ink-100 rounded-2xl border bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-ink-900 truncate text-base font-bold">{poll.title}</h3>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                open ? "bg-court-50 text-court-700" : "bg-ink-100 text-ink-500"
              }`}
            >
              {open ? "Open" : "Closed"}
            </span>
            {scopeLabel && (
              <span className="bg-play-50 text-play-700 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
                {scopeLabel}
              </span>
            )}
          </div>
          <p className="text-ink-400 mt-0.5 text-xs">
            {poll.createdBy.name} · {format(new Date(poll.createdAt), "MMM d")} ·{" "}
            {poll.totalVoters} {poll.totalVoters === 1 ? "vote" : "votes"}
          </p>
          {poll.description && <p className="text-ink-600 mt-2 text-sm">{poll.description}</p>}
        </div>
        {isStaff && onManage && (
          <div className="flex shrink-0 items-center gap-1.5">
            {onEdit && (
              <button
                onClick={onEdit}
                disabled={busy}
                className="border-ink-200 text-ink-600 hover:bg-ink-50 rounded-lg border px-2.5 py-1 text-xs font-semibold disabled:opacity-50"
              >
                Edit
              </button>
            )}
            <button
              onClick={() => onManage(open ? "close" : "reopen")}
              disabled={busy}
              className="border-ink-200 text-ink-600 hover:bg-ink-50 rounded-lg border px-2.5 py-1 text-xs font-semibold disabled:opacity-50"
            >
              {open ? "Close" : "Reopen"}
            </button>
            <button
              onClick={() => onManage("delete")}
              disabled={busy}
              className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              Delete
            </button>
          </div>
        )}
      </div>

      <div className="mt-4 space-y-5">
        {poll.questions.map((question) => (
          <QuestionBlock
            key={question.id}
            question={question}
            open={open}
            isStaff={isStaff}
            chosen={new Set(selections[question.id] ?? [])}
            onToggle={(optionId) => onToggle(question, optionId)}
          />
        ))}
      </div>

      {open && (
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-ink-400 text-xs">
            {answeredAll
              ? "You've voted. Pick different options to change your answer."
              : "Tap an option to choose, then submit."}
          </p>
          <button
            onClick={onVote}
            disabled={busy || !dirty}
            className="bg-play-600 hover:bg-play-700 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            {busy ? "Saving…" : answeredAll ? "Update Vote" : "Vote"}
          </button>
        </div>
      )}
    </div>
  )
}

export function QuestionBlock({
  question,
  open,
  isStaff,
  chosen,
  onToggle,
}: {
  question: PollQuestionView
  open: boolean
  isStaff: boolean
  chosen: Set<string>
  onToggle: (optionId: string) => void
}) {
  const maxCount = Math.max(1, ...question.options.map((o) => o.count))

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-ink-800 text-sm font-semibold">{question.prompt}</p>
        <p className="text-ink-400 shrink-0 text-[11px]">
          {question.allowMultiple ? "Pick any" : "Pick one"} · {question.voterCount} voted
        </p>
      </div>
      <div className="mt-2 space-y-1.5">
        {question.options.map((option) => {
          const selected = chosen.has(option.id)
          const share =
            question.voterCount > 0 ? Math.round((option.count / question.voterCount) * 100) : 0
          return (
            <button
              key={option.id}
              onClick={() => onToggle(option.id)}
              disabled={!open}
              className={`relative block w-full overflow-hidden rounded-xl border px-3 py-2 text-left text-sm transition ${
                selected
                  ? "border-play-400 ring-play-200 ring-1"
                  : "border-ink-100 hover:border-ink-300"
              } ${open ? "cursor-pointer" : "cursor-default"}`}
            >
              {/* Result fill — width tracks the leading option so bars read relative */}
              <span
                className={`absolute inset-y-0 left-0 ${selected ? "bg-play-100" : "bg-ink-50"}`}
                style={{ width: `${(option.count / maxCount) * 100}%` }}
                aria-hidden
              />
              <span className="relative flex items-center justify-between gap-2">
                <span className="text-ink-800 min-w-0 truncate">
                  {option.label}
                  {option.mine && (
                    <span className="text-play-600 ml-1.5 text-xs font-semibold">✓ your pick</span>
                  )}
                </span>
                <span className="text-ink-500 shrink-0 text-xs font-semibold">
                  {option.count} · {share}%
                </span>
              </span>
              {isStaff && option.voters && option.voters.length > 0 && (
                <span className="text-ink-400 relative mt-0.5 block truncate text-[11px]">
                  {option.voters.join(", ")}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
