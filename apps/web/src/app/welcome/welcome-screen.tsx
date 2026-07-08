"use client"

import { useEffect } from "react"
import Link from "next/link"
import type { ChecklistStep } from "@/lib/onboarding/checklist"
import { ONBOARDING_DISMISS_COOKIE, ONBOARDING_DISMISS_MAX_AGE } from "@/lib/onboarding/constants"

interface WelcomeScreenProps {
  firstName: string | null
  percent: number
  steps: ChecklistStep[]
  landingHref: string
}

/**
 * First-run soft gate. Shown once, right after signup, via /post-login. It
 * lists the same data-driven checklist as the top-nav pill, but full-screen —
 * a friendly "here's how to finish setting up" with a clear escape hatch.
 * Dismissing is one click ("Skip for now"); either way the cookie is set on
 * mount so we never interrupt again.
 */
export function WelcomeScreen({ firstName, percent, steps, landingHref }: WelcomeScreenProps) {
  useEffect(() => {
    document.cookie = `${ONBOARDING_DISMISS_COOKIE}=1; path=/; max-age=${ONBOARDING_DISMISS_MAX_AGE}; samesite=lax`
  }, [])

  const todo = steps.filter((s) => !s.done)
  const nextStep = todo.find((s) => !s.optional) ?? todo[0] ?? null

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

  return (
    <div className="bg-ink-50 flex min-h-screen items-center justify-center p-4 sm:p-6">
      <div className="border-ink-100 shadow-panel w-full max-w-2xl overflow-hidden rounded-[32px] border bg-white">
        <div className="from-hoop-500 to-hoop-600 bg-gradient-to-br px-8 py-8 text-white">
          <div className="mb-3 inline-flex rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em]">
            Welcome to SportsHub
          </div>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">
            {firstName ? `Welcome, ${firstName}!` : "Welcome!"}
          </h1>
          <p className="mt-1 text-sm text-white/90">
            You&apos;re all signed up. A few quick steps and you&apos;ll be fully set up.
          </p>
          <div className="mt-4 flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/25">
              <div
                className="h-full rounded-full bg-white transition-all"
                style={{ width: `${percent}%` }}
              />
            </div>
            <span className="text-sm font-bold tabular-nums">{percent}%</span>
          </div>
        </div>

        <div className="max-h-[46vh] overflow-y-auto px-4 py-3 sm:px-6">
          {groups.map((group) => (
            <div key={group.name} className="py-1">
              <p className="text-ink-400 px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider">
                {group.name}
              </p>
              {group.steps.map((step) => (
                <StepRow key={step.key} step={step} />
              ))}
            </div>
          ))}
        </div>

        <div className="border-ink-100 flex flex-col-reverse gap-3 border-t px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href={landingHref}
            className="text-ink-500 hover:text-ink-800 text-sm font-medium transition"
          >
            Skip for now
          </Link>
          {nextStep ? (
            <Link
              href={nextStep.href}
              className="bg-hoop-500 shadow-soft hover:bg-hoop-600 inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold text-white transition"
            >
              Start with: {nextStep.label}
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="m9 18 6-6-6-6" />
              </svg>
            </Link>
          ) : (
            <Link
              href={landingHref}
              className="bg-hoop-500 hover:bg-hoop-600 inline-flex items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold text-white transition"
            >
              Continue
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

function StepRow({ step }: { step: ChecklistStep }) {
  const inner = (
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
          <span className={`text-sm font-medium ${step.done ? "text-ink-400 line-through" : "text-ink-800"}`}>
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
      {!step.done && (
        <svg
          className="text-ink-300 mt-1 h-4 w-4 flex-shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m9 18 6-6-6-6" />
        </svg>
      )}
    </>
  )

  if (step.done) {
    return <div className="flex items-start gap-3 rounded-2xl px-2 py-2">{inner}</div>
  }
  return (
    <Link href={step.href} className="hover:bg-ink-50 flex items-start gap-3 rounded-2xl px-2 py-2 transition">
      {inner}
    </Link>
  )
}
