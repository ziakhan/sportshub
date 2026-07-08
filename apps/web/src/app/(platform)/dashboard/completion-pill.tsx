"use client"

import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import type { ChecklistStep } from "@/lib/onboarding/checklist"

interface CompletionPillProps {
  percent: number
  steps: ChecklistStep[]
}

/**
 * Top-nav "Setup X%" ring. Visible until every required step is done; opens a
 * panel with the role-aware checklist (deep links straight into each flow).
 * Data-driven — see lib/onboarding/checklist.ts — so it disappears on its own
 * once the underlying records exist.
 */
export function CompletionPill({ percent, steps }: CompletionPillProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("keydown", handleEscape)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("keydown", handleEscape)
    }
  }, [])

  // Group steps by journey, preserving first-seen order.
  const groups: Array<{ name: string; steps: ChecklistStep[] }> = []
  for (const step of steps) {
    let g = groups.find((x) => x.name === step.group)
    if (!g) {
      g = { name: step.group, steps: [] }
      groups.push(g)
    }
    g.steps.push(step)
  }

  // Ring geometry
  const R = 9
  const C = 2 * Math.PI * R
  const dash = (Math.min(100, Math.max(0, percent)) / 100) * C

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="border-hoop-200 bg-hoop-50 hover:bg-hoop-100 text-hoop-700 flex items-center gap-2 rounded-2xl border px-2.5 py-2 text-sm font-semibold transition"
        aria-label={`Setup ${percent}% complete`}
        title="Finish setting up your account"
      >
        <span className="relative flex h-6 w-6 items-center justify-center">
          <svg className="h-6 w-6 -rotate-90" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r={R} fill="none" strokeWidth="3" className="stroke-hoop-200" />
            <circle
              cx="12"
              cy="12"
              r={R}
              fill="none"
              strokeWidth="3"
              strokeLinecap="round"
              className="stroke-hoop-500"
              strokeDasharray={`${dash} ${C}`}
            />
          </svg>
        </span>
        <span className="hidden md:inline">Setup {percent}%</span>
      </button>

      {open && (
        <div className="border-ink-100 shadow-panel absolute right-0 z-50 mt-3 w-80 overflow-hidden rounded-3xl border bg-white">
          <div className="border-ink-100 border-b px-5 py-4">
            <p className="text-ink-950 text-sm font-semibold">Finish setting up</p>
            <p className="text-ink-500 mt-0.5 text-xs">
              A few steps to get the most out of SportsHub.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <div className="bg-ink-100 h-2 flex-1 overflow-hidden rounded-full">
                <div
                  className="bg-hoop-500 h-full rounded-full transition-all"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <span className="text-ink-600 text-xs font-semibold tabular-nums">{percent}%</span>
            </div>
          </div>

          <div className="max-h-[60vh] overflow-y-auto py-1">
            {groups.map((group) => (
              <div key={group.name} className="py-1">
                <p className="text-ink-400 px-5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider">
                  {group.name}
                </p>
                {group.steps.map((step) => (
                  <StepRow key={step.key} step={step} onNavigate={() => setOpen(false)} />
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function StepRow({ step, onNavigate }: { step: ChecklistStep; onNavigate: () => void }) {
  const body = (
    <>
      <span className="mt-0.5 flex-shrink-0">
        {step.done ? (
          <span className="bg-hoop-500 flex h-5 w-5 items-center justify-center rounded-full text-white">
            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 6 9 17l-5-5" />
            </svg>
          </span>
        ) : (
          <span className="border-ink-300 block h-5 w-5 rounded-full border-2 border-dashed" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span
            className={`text-sm font-medium ${step.done ? "text-ink-400 line-through" : "text-ink-800"}`}
          >
            {step.label}
          </span>
          {step.optional && !step.done && (
            <span className="text-ink-400 border-ink-200 rounded border px-1 text-[10px] font-medium uppercase">
              Optional
            </span>
          )}
        </span>
        {!step.done && step.hint && (
          <span className="text-ink-500 mt-0.5 block text-xs">{step.hint}</span>
        )}
      </span>
    </>
  )

  if (step.done) {
    return <div className="flex items-start gap-3 px-5 py-2">{body}</div>
  }
  return (
    <Link
      href={step.href}
      onClick={onNavigate}
      className="hover:bg-ink-50 flex items-start gap-3 px-5 py-2 transition"
    >
      {body}
    </Link>
  )
}
