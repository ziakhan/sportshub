"use client"

import { useRef, type ReactNode } from "react"

/**
 * Stacked choice cards (2026-08-13) — one radio group where every option needs
 * a sentence to explain itself: which record to merge into, which payment
 * plan, which package. The onboarding role picker has used this shape since
 * the first build; this lifts it out so every screen gets the same one instead
 * of a fresh set of radios each time.
 *
 * Same radio-group contract as ChipGroup: one tab stop, arrows move the
 * choice, disabled options are skipped.
 */

export type ChoiceCardOption = {
  value: string
  title: string
  description?: ReactNode
  /** Short qualifier shown beside the title, e.g. "Most families". */
  badge?: string
  disabled?: boolean
}

export function ChoiceCardGroup({
  value,
  onChange,
  options,
  ariaLabel,
  className,
}: {
  value: string
  onChange: (value: string) => void
  options: ChoiceCardOption[]
  ariaLabel: string
  className?: string
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const selectedIndex = options.findIndex((o) => o.value === value)
  const firstEnabled = options.findIndex((o) => !o.disabled)

  const tabIndexOf = (i: number) => {
    if (options[i]?.disabled) return -1
    if (selectedIndex >= 0) return i === selectedIndex ? 0 : -1
    return i === firstEnabled ? 0 : -1
  }

  /** Next selectable option, wrapping. */
  function move(from: number, step: number) {
    const n = options.length
    for (let i = 1; i <= n; i++) {
      const idx = (((from + i * step) % n) + n) % n
      if (!options[idx].disabled) {
        onChange(options[idx].value)
        refs.current[idx]?.focus()
        return
      }
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, i: number) {
    switch (e.key) {
      case "ArrowDown":
      case "ArrowRight":
        e.preventDefault()
        move(i, 1)
        return
      case "ArrowUp":
      case "ArrowLeft":
        e.preventDefault()
        move(i, -1)
        return
      case "Home":
        e.preventDefault()
        move(-1, 1)
        return
      case "End":
        e.preventDefault()
        move(0, -1)
        return
      case " ":
      case "Spacebar":
      case "Enter":
        e.preventDefault()
        if (!options[i].disabled) onChange(options[i].value)
        return
    }
  }

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={`space-y-3 ${className ?? ""}`}
    >
      {options.map((o, i) => {
        const isSelected = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-disabled={o.disabled || undefined}
            disabled={o.disabled}
            tabIndex={tabIndexOf(i)}
            ref={(el) => {
              refs.current[i] = el
            }}
            onClick={() => !o.disabled && onChange(o.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={`flex w-full items-start gap-4 rounded-2xl border px-5 py-4 text-left transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-play-500 focus-visible:ring-offset-2 ${
              o.disabled
                ? "border-ink-100 bg-ink-50/60 cursor-not-allowed"
                : isSelected
                  ? "border-play-500 bg-play-50 cursor-pointer"
                  : "border-ink-200 hover:border-play-300 hover:bg-play-50/50 cursor-pointer bg-white"
            }`}
          >
            {/* Radio circle, same as the onboarding role picker */}
            <span
              className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-200 ${
                isSelected ? "border-play-500 bg-play-500" : "border-ink-300 bg-white"
              }`}
              aria-hidden="true"
            >
              {isSelected && <span className="h-2 w-2 rounded-full bg-white" />}
            </span>

            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span
                  className={`text-[16px] font-bold leading-6 ${
                    o.disabled ? "text-ink-400" : "text-ink-900"
                  }`}
                >
                  {o.title}
                </span>
                {o.badge && (
                  <span className="rounded-full bg-[#fef3c7] px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-[#78350f]">
                    {o.badge}
                  </span>
                )}
              </span>
              {o.description && (
                <span
                  className={`mt-1 block text-[13.5px] leading-5 ${
                    o.disabled ? "text-ink-400" : "text-ink-600"
                  }`}
                >
                  {o.description}
                </span>
              )}
            </span>
          </button>
        )
      })}
    </div>
  )
}
