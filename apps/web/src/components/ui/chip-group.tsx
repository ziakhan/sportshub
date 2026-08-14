"use client"

import { useRef } from "react"

/**
 * Segmented chips for short, fixed lists (2026-08-13) — gender, position,
 * certification level, age band. Anything with three to six known answers is
 * faster to read as chips than to open as a dropdown, and on a phone it saves
 * the whole native picker sheet.
 *
 * It is a real radio group: one tab stop for the whole set, arrows move the
 * choice, and `aria-checked` carries the state. `allowClear` exists because
 * plenty of these fields are optional and a radio group with no "none" option
 * is otherwise a one-way door.
 */

export type ChipOption = {
  value: string
  label: string
}

export function ChipGroup({
  value,
  onChange,
  options,
  ariaLabel,
  name,
  className,
  allowClear = false,
}: {
  value: string
  onChange: (value: string) => void
  options: ChipOption[]
  ariaLabel: string
  /** Renders a hidden input so the group can post inside a plain form. */
  name?: string
  className?: string
  /** Clicking the chosen chip again clears the field. */
  allowClear?: boolean
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const selectedIndex = options.findIndex((o) => o.value === value)

  /** The single tab stop: the chosen chip, or the first one if none is. */
  const tabIndexOf = (i: number) => (selectedIndex >= 0 ? (i === selectedIndex ? 0 : -1) : i === 0 ? 0 : -1)

  function move(from: number, step: number) {
    const n = options.length
    if (n === 0) return
    const next = (((from + step) % n) + n) % n
    onChange(options[next].value)
    refs.current[next]?.focus()
  }

  function pick(i: number) {
    const option = options[i]
    if (!option) return
    onChange(allowClear && option.value === value ? "" : option.value)
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, i: number) {
    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown":
        e.preventDefault()
        move(selectedIndex < 0 ? i - 1 : i, 1)
        return
      case "ArrowLeft":
      case "ArrowUp":
        e.preventDefault()
        move(selectedIndex < 0 ? i + 1 : i, -1)
        return
      case "Home":
        e.preventDefault()
        onChange(options[0].value)
        refs.current[0]?.focus()
        return
      case "End":
        e.preventDefault()
        onChange(options[options.length - 1].value)
        refs.current[options.length - 1]?.focus()
        return
      case " ":
      case "Spacebar":
      case "Enter":
        e.preventDefault()
        pick(i)
        return
    }
  }

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={`flex flex-wrap gap-2 ${className ?? ""}`}
    >
      {options.map((o, i) => {
        const isSelected = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            tabIndex={tabIndexOf(i)}
            ref={(el) => {
              refs.current[i] = el
            }}
            onClick={() => pick(i)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={`inline-flex min-h-[44px] cursor-pointer items-center rounded-full border px-4 py-2 text-sm font-semibold transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-play-500 focus-visible:ring-offset-2 ${
              isSelected
                ? "border-play-600 bg-play-600 text-white shadow-sm"
                : "border-ink-200 hover:border-play-300 hover:bg-play-50/50 bg-white text-ink-700"
            }`}
          >
            {o.label}
          </button>
        )
      })}
      {name && <input type="hidden" name={name} value={value} />}
    </div>
  )
}
