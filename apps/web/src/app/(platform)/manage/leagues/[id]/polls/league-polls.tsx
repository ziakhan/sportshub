"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { PollCard } from "@/components/polls/poll-card"
import {
  seedSelections,
  type PollQuestionView,
  type PollView,
  type Selections,
} from "@/components/polls/poll-types"

/**
 * League-wide polls (three-tier polls ruling, owner 2026-07-24). Voting/
 * display reuses the shared PollCard. No chat-relay option — league polls
 * never post to team chats (owner: maybe later).
 */

interface DraftQuestion {
  prompt: string
  allowMultiple: boolean
  options: string[]
}

const emptyQuestion = (): DraftQuestion => ({ prompt: "", allowMultiple: false, options: ["", ""] })

export function LeaguePolls({ leagueId }: { leagueId: string }) {
  const [polls, setPolls] = useState<PollView[]>([])
  const [isStaff, setIsStaff] = useState(false)
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
        const res = await fetch(`/api/leagues/${leagueId}/polls`)
        if (!res.ok) throw new Error()
        const data = await res.json()
        if (!cancelled) {
          applyPolls(data.polls)
          setIsStaff(!!data.isStaff)
        }
      } catch {
        if (!cancelled) setError("Couldn't load polls. Refresh to try again.")
      } finally {
        if (!cancelled) setLoaded(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [leagueId, applyPolls])

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
      const res = await fetch(`/api/leagues/${leagueId}/polls/${poll.id}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setPolls((current) => current.map((p) => (p.id === poll.id ? data.poll : p)))
      setSelections((current) => ({ ...current, [poll.id]: seedSelections(data.poll) }))
    } catch (e: any) {
      setError(e?.message || "Couldn't record your vote. Try again.")
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
      const res = await fetch(`/api/leagues/${leagueId}/polls/${poll.id}`, {
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
      setError(e?.message || "Couldn't update the poll. Try again.")
    } finally {
      setBusyPoll(null)
    }
  }

  if (!loaded) {
    return <p className="text-ink-500 py-10 text-center text-sm">Loading polls…</p>
  }

  return (
    <div className="space-y-4">
      {error && <p className="rounded-xl bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}

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
          leagueId={leagueId}
          onCreated={(poll) => {
            setShowCreate(false)
            setPolls((current) => [poll, ...current])
            setSelections((current) => ({ ...current, [poll.id]: seedSelections(poll) }))
          }}
        />
      )}

      {polls.length === 0 && !showCreate && (
        <div className="border-ink-200 rounded-2xl border border-dashed bg-white px-6 py-12 text-center">
          <p className="text-ink-700 text-sm font-semibold">No league polls yet</p>
          <p className="text-ink-500 mt-1 text-sm">
            {isStaff
              ? "Ask the whole league something: playoff format, game-day rules, showcase interest."
              : "When your league posts a poll, it'll show up here."}
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
          onManage={isStaff ? (action) => managePoll(poll, action) : undefined}
        />
      ))}
    </div>
  )
}

function CreatePollForm({
  leagueId,
  onCreated,
}: {
  leagueId: string
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
      const res = await fetch(`/api/leagues/${leagueId}/polls`, {
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
      setError(e?.message || "Couldn't create the poll. Try again.")
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
          placeholder="Which playoff format should we use?"
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
          placeholder="Help us plan the season. Answers close Friday."
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
            placeholder="What should we ask the league?"
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
