import Link from "next/link"
import { AnimatedNumber } from "@/components/ui"
import type { CompletionChecklist } from "@/lib/onboarding/checklist"

/**
 * Dashboard "finish setup" card — the auto-surfaced companion to the top-nav
 * pill. Renders only while setup is incomplete; lists the still-to-do steps as
 * deep links so a member can pick up exactly where they left off.
 */
export function FinishSetupCard({ checklist }: { checklist: CompletionChecklist }) {
  if (!checklist.applicable || checklist.complete) return null

  const todo = checklist.steps.filter((s) => !s.done)
  if (todo.length === 0) return null

  return (
    <div className="reveal border-[color:var(--brand-line)] shadow-soft rounded-[30px] border bg-gradient-to-br from-[var(--brand-softer)] to-white p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-3 inline-flex rounded-full border border-[color:var(--brand-line)] bg-[var(--brand-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--brand-ink)]">
            Getting started
          </div>
          <h2 className="font-condensed text-ink-950 text-2xl font-bold uppercase tracking-wide">
            Finish setting up your account
          </h2>
          <p className="text-ink-600 mt-1 text-sm">
            You&apos;re {checklist.percent}% of the way there — a few steps left to get the most out
            of SportsHub.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-ink-100 h-2 w-32 overflow-hidden rounded-full">
            <div
              className="grow-x h-full rounded-full bg-[var(--brand)]"
              style={{ width: `${checklist.percent}%` }}
            />
          </div>
          <span className="font-condensed text-lg font-bold leading-none text-[color:var(--brand-ink)]">
            <AnimatedNumber value={checklist.percent} />%
          </span>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {todo.map((step, i) => (
          <Link
            key={step.key}
            href={step.href}
            className="reveal card-lift border-ink-100 group flex items-start gap-3 rounded-2xl border bg-white p-4 transition-colors hover:border-[color:var(--brand-line)] hover:bg-[var(--brand-softer)]"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <span className="border-ink-300 mt-0.5 block h-5 w-5 flex-shrink-0 rounded-full border-2 border-dashed transition-colors group-hover:border-[color:var(--brand)]" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-ink-900 text-sm font-semibold">{step.label}</span>
                {step.optional && (
                  <span className="text-ink-400 border-ink-200 rounded border px-1 text-[10px] font-medium uppercase">
                    Optional
                  </span>
                )}
              </div>
              {step.hint && <div className="text-ink-600 mt-0.5 text-sm">{step.hint}</div>}
            </div>
            <svg
              className="text-ink-300 mt-1 h-4 w-4 flex-shrink-0 transition-colors group-hover:text-[color:var(--brand-ink)]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m9 18 6-6-6-6" />
            </svg>
          </Link>
        ))}
      </div>
    </div>
  )
}
