"use client"

import { useState } from "react"
import {
  QUESTION_TYPE_LABELS,
  type ApplicationQuestion,
  type QuestionType,
} from "@/lib/registration/questions"

const inputCls =
  "rounded-lg border border-ink-200 px-2 py-1.5 text-sm text-ink-900 focus:border-play-500 focus:outline-none focus:ring-2 focus:ring-play-500/20"

/**
 * Structured question editor (owner 2026-07-31): every question is defined
 * — label, input type, options for choice types, required flag. Shared by
 * the org rulebook editor and the league registration settings.
 */
export function QuestionBuilder({
  value,
  onChange,
}: {
  value: ApplicationQuestion[]
  onChange: (next: ApplicationQuestion[]) => void
}) {
  const update = (idx: number, patch: Partial<ApplicationQuestion>) =>
    onChange(value.map((q, i) => (i === idx ? { ...q, ...patch } : q)))
  const remove = (idx: number) => onChange(value.filter((_, i) => i !== idx))
  const move = (idx: number, dir: -1 | 1) => {
    const target = idx + dir
    if (target < 0 || target >= value.length) return
    const next = [...value]
    ;[next[idx], next[target]] = [next[target], next[idx]]
    onChange(next)
  }

  return (
    <div className="space-y-2">
      {value.length === 0 && (
        <p className="text-ink-400 text-xs">No questions yet — add the first one below.</p>
      )}
      {value.map((q, idx) => (
        <div key={idx} className="border-ink-100 rounded-xl border bg-white p-2.5">
          <div className="flex items-start gap-2">
            <span className="text-ink-300 w-4 pt-2 text-right font-mono text-xs">{idx + 1}.</span>
            <div className="min-w-0 flex-1 space-y-1.5">
              <input
                value={q.label}
                onChange={(e) => update(idx, { label: e.target.value })}
                placeholder="The question, e.g. Why do you want to join this league?"
                className={inputCls + " w-full"}
              />
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={q.type}
                  onChange={(e) => {
                    const type = e.target.value as QuestionType
                    update(idx, {
                      type,
                      options: type === "single" || type === "multi" ? q.options : [],
                    })
                  }}
                  className={inputCls}
                  aria-label="Answer type"
                >
                  {(Object.keys(QUESTION_TYPE_LABELS) as QuestionType[]).map((t) => (
                    <option key={t} value={t}>
                      {QUESTION_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
                <label className="text-ink-600 flex items-center gap-1 text-xs">
                  <input
                    type="checkbox"
                    checked={q.required}
                    onChange={(e) => update(idx, { required: e.target.checked })}
                  />
                  Required
                </label>
                <span className="flex-1" />
                <button onClick={() => move(idx, -1)} disabled={idx === 0} className="text-ink-400 hover:text-ink-700 text-xs disabled:opacity-30" aria-label="Move up">↑</button>
                <button onClick={() => move(idx, 1)} disabled={idx === value.length - 1} className="text-ink-400 hover:text-ink-700 text-xs disabled:opacity-30" aria-label="Move down">↓</button>
                <button onClick={() => remove(idx)} className="hover:text-hoop-700 text-xs text-red-500">
                  Remove
                </button>
              </div>
              {(q.type === "single" || q.type === "multi") && (
                <OptionsEditor
                  options={q.options}
                  onChange={(options) => update(idx, { options })}
                />
              )}
            </div>
          </div>
        </div>
      ))}
      <button
        onClick={() =>
          onChange([...value, { label: "", type: "long_text", options: [], required: true }])
        }
        className="text-play-700 text-xs font-semibold hover:underline"
      >
        + Add question
      </button>
    </div>
  )
}

function OptionsEditor({
  options,
  onChange,
}: {
  options: string[]
  onChange: (next: string[]) => void
}) {
  const [draft, setDraft] = useState("")
  const add = () => {
    const v = draft.trim()
    if (!v || options.includes(v)) return
    onChange([...options, v])
    setDraft("")
  }
  return (
    <div className="bg-ink-50/60 rounded-lg p-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {options.map((opt) => (
          <button
            key={opt}
            onClick={() => onChange(options.filter((o) => o !== opt))}
            className="bg-white border-ink-200 text-ink-700 hover:border-hoop-300 rounded-full border px-2.5 py-1 text-xs"
            title="Remove option"
          >
            {opt} ×
          </button>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              add()
            }
          }}
          placeholder="Add option + Enter"
          className={inputCls + " w-40"}
        />
        <button onClick={add} className="text-play-700 text-xs font-semibold hover:underline">
          Add
        </button>
      </div>
      {options.length === 0 && (
        <p className="text-amber-600 mt-1 text-[11px]">Choice questions need at least one option.</p>
      )}
    </div>
  )
}
