"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { format } from "date-fns"

interface PollOptionView {
  id: string
  label: string
  count: number
  mine: boolean
  voters?: string[]
}

interface PollQuestionView {
  id: string
  prompt: string
  allowMultiple: boolean
  voterCount: number
  myAnswered: boolean
  options: PollOptionView[]
}

interface PollView {
  id: string
  title: string
  description: string | null
  status: "OPEN" | "CLOSED"
  createdAt: string
  createdBy: { id: string; name: string }
  totalVoters: number
  questions: PollQuestionView[]
}

interface DraftQuestion {
  prompt: string
  allowMultiple: boolean
  options: string[]
}

const emptyQuestion = (): DraftQuestion => ({ prompt: "", allowMultiple: false, options: ["", ""] })

/** questionId -> chosen optionIds, seeded from the viewer's recorded votes */
type Selections = Record<string, string[]>

function seedSelections(poll: PollView): Selections {
  const out: Selections = {}
  for (const q of poll.questions) {
    out[q.id] = q.options.filter((o) => o.mine).map((o) => o.id)
  }
  return out
}

export function TeamPolls({ teamId, isStaff }: { teamId: string; isStaff: boolean }) {
  const [polls, setPolls] = useState<PollView[]>([])
  const [selections, setSelections] = useState<Record<string, Selections>>({})
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busyPoll, setBusyPoll] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  const applyPolls = useCallback((list: PollView[]) => {
    setPolls(list)
    setSelections(Object.fromEntries(list.map((p) => [p.id, seedSelections(p)])))
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/teams/${teamId}/polls`)
        if (!res.ok) throw new Error()
        const data = await res.json()
        if (!cancelled) applyPolls(data.polls)
      } catch {
        if (!cancelled) setError("Couldn't load polls — refresh to try again.")
      } finally {
        if (!cancelled) setLoaded(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [teamId, applyPolls])

  function toggleChoice(poll: PollView, question: PollQuestionView, optionId: string) {
    if (poll.status !== "OPEN") return
    setSelections((current) => {
      const forPoll = { ...(current[poll.id] ?? {}) }
      const chosen = new Set(forPoll[question.id] ?? [])
      if (question.allowMultiple) {
        if (chosen.has(optionId)) chosen.delete(optionId)
        else chosen.add(optionId)
      } else {
        chosen.clear()
        chosen.add(optionId)
      }
      forPoll[question.id] = [...chosen]
      return { ...current, [poll.id]: forPoll }
    })
  }

  function isDirty(poll: PollView): boolean {
    const forPoll = selections[poll.id] ?? {}
    return poll.questions.some((q) => {
      const recorded = q.options
        .filter((o) => o.mine)
        .map((o) => o.id)
        .sort()
      const chosen = [...(forPoll[q.id] ?? [])].sort()
      return chosen.length > 0 && JSON.stringify(recorded) !== JSON.stringify(chosen)
    })
  }

  async function submitVote(poll: PollView) {
    const forPoll = selections[poll.id] ?? {}
    const answers = poll.questions
      .map((q) => ({ questionId: q.id, optionIds: forPoll[q.id] ?? [] }))
      .filter((a) => a.optionIds.length > 0)
    if (answers.length === 0) return
    setBusyPoll(poll.id)
    setError(null)
    try {
      const res = await fetch(`/api/teams/${teamId}/polls/${poll.id}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setPolls((current) => current.map((p) => (p.id === poll.id ? data.poll : p)))
      setSelections((current) => ({ ...current, [poll.id]: seedSelections(data.poll) }))
    } catch (e: any) {
      setError(e?.message || "Couldn't record your vote — try again.")
    } finally {
      setBusyPoll(null)
    }
  }

  async function managePoll(poll: PollView, action: "close" | "reopen" | "delete") {
    if (action === "delete" && !window.confirm(`Delete "${poll.title}" and all its votes?`)) {
      return
    }
    setBusyPoll(poll.id)
    setError(null)
    try {
      const res = await fetch(`/api/teams/${teamId}/polls/${poll.id}`, {
        method: action === "delete" ? "DELETE" : "PATCH",
        headers: { "Content-Type": "application/json" },
        ...(action !== "delete" ? { body: JSON.stringify({ action }) } : {}),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      if (action === "delete") {
        setPolls((current) => current.filter((p) => p.id !== poll.id))
      } else {
        setPolls((current) =>
          current.map((p) =>
            p.id === poll.id ? { ...p, status: action === "close" ? "CLOSED" : "OPEN" } : p
          )
        )
      }
    } catch (e: any) {
      setError(e?.message || "Couldn't update the poll — try again.")
    } finally {
      setBusyPoll(null)
    }
  }

  if (!loaded) {
    return <p className="text-ink-500 py-10 text-center text-sm">Loading polls…</p>
  }

  return (
    <div className="space-y-4">
      {error && (
        <p className="rounded-xl bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>
      )}

      {isStaff && (
        <div className="flex justify-end">
          <button
            onClick={() => setShowCreate((v) => !v)}
            className="bg-play-600 hover:bg-play-700 rounded-xl px-4 py-2 text-sm font-semibold text-white"
          >
            {showCreate ? "Cancel" : "New Poll"}
          </button>
        </div>
      )}

      {isStaff && showCreate && (
        <CreatePollForm
          teamId={teamId}
          onCreated={(poll) => {
            setShowCreate(false)
            setPolls((current) => [poll, ...current])
            setSelections((current) => ({ ...current, [poll.id]: seedSelections(poll) }))
          }}
        />
      )}

      {polls.length === 0 && !showCreate && (
        <div className="border-ink-200 rounded-2xl border border-dashed bg-white px-6 py-12 text-center">
          <p className="text-ink-700 text-sm font-semibold">No polls yet</p>
          <p className="text-ink-500 mt-1 text-sm">
            {isStaff
              ? "Ask the team something — tournament interest, practice times, jersey colors."
              : "When your coach or club posts a poll, it'll show up here."}
          </p>
        </div>
      )}

      {polls.map((poll) => (
        <PollCard
          key={poll.id}
          poll={poll}
          isStaff={isStaff}
          busy={busyPoll === poll.id}
          selections={selections[poll.id] ?? {}}
          dirty={isDirty(poll)}
          onToggle={(q, optionId) => toggleChoice(poll, q, optionId)}
          onVote={() => submitVote(poll)}
          onManage={(action) => managePoll(poll, action)}
        />
      ))}
    </div>
  )
}

function PollCard({
  poll,
  isStaff,
  busy,
  selections,
  dirty,
  onToggle,
  onVote,
  onManage,
}: {
  poll: PollView
  isStaff: boolean
  busy: boolean
  selections: Selections
  dirty: boolean
  onToggle: (question: PollQuestionView, optionId: string) => void
  onVote: () => void
  onManage: (action: "close" | "reopen" | "delete") => void
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
          </div>
          <p className="text-ink-400 mt-0.5 text-xs">
            {poll.createdBy.name} · {format(new Date(poll.createdAt), "MMM d")} ·{" "}
            {poll.totalVoters} {poll.totalVoters === 1 ? "vote" : "votes"}
          </p>
          {poll.description && <p className="text-ink-600 mt-2 text-sm">{poll.description}</p>}
        </div>
        {isStaff && (
          <div className="flex shrink-0 items-center gap-1.5">
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
              ? "You've voted — pick different options to change your answer."
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

function QuestionBlock({
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

function CreatePollForm({
  teamId,
  onCreated,
}: {
  teamId: string
  onCreated: (poll: PollView) => void
}) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [questions, setQuestions] = useState<DraftQuestion[]>([emptyQuestion()])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const valid = useMemo(
    () =>
      title.trim().length > 0 &&
      questions.length > 0 &&
      questions.every(
        (q) => q.prompt.trim().length > 0 && q.options.filter((o) => o.trim()).length >= 2
      ),
    [title, questions]
  )

  function patchQuestion(index: number, patch: Partial<DraftQuestion>) {
    setQuestions((current) => current.map((q, i) => (i === index ? { ...q, ...patch } : q)))
  }

  async function submit() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/teams/${teamId}/polls`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          questions: questions.map((q) => ({
            prompt: q.prompt.trim(),
            allowMultiple: q.allowMultiple,
            options: q.options.map((o) => o.trim()).filter(Boolean),
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      onCreated(data.poll)
    } catch (e: any) {
      setError(e?.message || "Couldn't create the poll — try again.")
    } finally {
      setSaving(false)
    }
  }

  const inputClass =
    "border-ink-200 focus:border-play-400 w-full rounded-xl border px-3 py-2 text-sm outline-none"

  return (
    <div className="border-ink-100 space-y-4 rounded-2xl border bg-white p-5 shadow-sm">
      <div>
        <label className="text-ink-700 mb-1 block text-xs font-semibold">Title</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={150}
          placeholder="Tournament plans for August"
          className={inputClass}
        />
      </div>
      <div>
        <label className="text-ink-700 mb-1 block text-xs font-semibold">
          Description <span className="text-ink-400 font-normal">(optional)</span>
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={1000}
          rows={2}
          placeholder="Help us plan the summer — answers close Friday."
          className={inputClass}
        />
      </div>

      {questions.map((question, qi) => (
        <div key={qi} className="border-ink-100 bg-ink-50/50 space-y-2 rounded-xl border p-3">
          <div className="flex items-center justify-between gap-2">
            <label className="text-ink-700 text-xs font-semibold">Question {qi + 1}</label>
            <div className="flex items-center gap-3">
              <label className="text-ink-500 flex items-center gap-1.5 text-xs">
                <input
                  type="checkbox"
                  checked={question.allowMultiple}
                  onChange={(e) => patchQuestion(qi, { allowMultiple: e.target.checked })}
                />
                Allow multiple choices
              </label>
              {questions.length > 1 && (
                <button
                  onClick={() => setQuestions((current) => current.filter((_, i) => i !== qi))}
                  className="text-xs font-semibold text-red-500 hover:text-red-700"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
          <input
            value={question.prompt}
            onChange={(e) => patchQuestion(qi, { prompt: e.target.value })}
            maxLength={300}
            placeholder="Which tournaments should we enter?"
            className={inputClass}
          />
          <div className="space-y-1.5">
            {question.options.map((option, oi) => (
              <div key={oi} className="flex items-center gap-2">
                <input
                  value={option}
                  onChange={(e) =>
                    patchQuestion(qi, {
                      options: question.options.map((o, i) => (i === oi ? e.target.value : o)),
                    })
                  }
                  maxLength={100}
                  placeholder={`Option ${oi + 1}`}
                  className={inputClass}
                />
                {question.options.length > 2 && (
                  <button
                    onClick={() =>
                      patchQuestion(qi, { options: question.options.filter((_, i) => i !== oi) })
                    }
                    className="text-ink-400 hover:text-red-500 shrink-0 text-lg leading-none"
                    aria-label="Remove option"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            {question.options.length < 12 && (
              <button
                onClick={() => patchQuestion(qi, { options: [...question.options, ""] })}
                className="text-play-600 hover:text-play-700 text-xs font-semibold"
              >
                + Add option
              </button>
            )}
          </div>
        </div>
      ))}

      <div className="flex items-center justify-between gap-3">
        {questions.length < 10 ? (
          <button
            onClick={() => setQuestions((current) => [...current, emptyQuestion()])}
            className="text-play-600 hover:text-play-700 text-xs font-semibold"
          >
            + Add another question
          </button>
        ) : (
          <span />
        )}
        <button
          onClick={submit}
          disabled={!valid || saving}
          className="bg-play-600 hover:bg-play-700 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          {saving ? "Publishing…" : "Publish Poll"}
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
