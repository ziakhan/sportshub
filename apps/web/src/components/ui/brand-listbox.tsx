"use client"

import { useCallback, useEffect, useId, useRef, useState } from "react"

/**
 * Branded listbox — the replacement for a native <select> (2026-08-13).
 *
 * Drop-in by design: string in, string out, same as the native element, so
 * swapping one is a one-line change in a form. The popover mirrors
 * DateTimePicker (absolute panel inside a relative wrapper, outside-click and
 * Escape to close) and adds the one thing that picker never needed: a list
 * long enough to run off the bottom of the screen, so it flips upward when
 * there is no room below.
 *
 * Keyboard follows the WAI-ARIA collapsible listbox pattern: the button opens
 * it, focus moves into the list, arrows and Home/End move the active option,
 * typing jumps to a label, Enter or Space commits, Escape returns to the
 * button with nothing changed.
 */

export type BrandListboxOption = {
  value: string
  label: string
  disabled?: boolean
}

/** How long a type-ahead buffer stays alive between keystrokes. */
const TYPEAHEAD_MS = 600

export function BrandListbox({
  value,
  onChange,
  options,
  placeholder = "Select…",
  ariaLabel,
  id,
  disabled = false,
  className,
  error = false,
}: {
  value: string
  onChange: (value: string) => void
  options: BrandListboxOption[]
  placeholder?: string
  ariaLabel?: string
  id?: string
  disabled?: boolean
  className?: string
  error?: boolean
}) {
  const reactId = useId()
  const listId = `${id ?? reactId}-listbox`
  const optionId = (index: number) => `${listId}-opt-${index}`

  const [open, setOpen] = useState(false)
  const [upward, setUpward] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)

  const wrapRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const typed = useRef({ buffer: "", at: 0 })

  const selectedIndex = options.findIndex((o) => o.value === value)
  const selected = selectedIndex >= 0 ? options[selectedIndex] : null

  /** First selectable option at or after `from`, walking `step` at a time. */
  const seek = useCallback(
    (from: number, step: number) => {
      const n = options.length
      if (n === 0) return -1
      for (let i = 0; i < n; i++) {
        const idx = (((from + i * step) % n) + n) % n
        if (!options[idx].disabled) return idx
      }
      return -1
    },
    [options]
  )

  const close = useCallback((refocus = true) => {
    setOpen(false)
    if (refocus) buttonRef.current?.focus()
  }, [])

  function openList(startAt: "selected" | "first" | "last") {
    if (disabled) return
    // Flip upward when the panel (max-h-64 + margin) would fall off screen.
    const rect = buttonRef.current?.getBoundingClientRect()
    if (rect) {
      const below = window.innerHeight - rect.bottom
      setUpward(below < 280 && rect.top > below)
    }
    const start =
      startAt === "selected" && selectedIndex >= 0
        ? selectedIndex
        : startAt === "last"
          ? seek(options.length - 1, -1)
          : seek(0, 1)
    setActiveIndex(start)
    setOpen(true)
  }

  // Outside click + Escape, same handling as the date picker popover.
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [open])

  // Focus the list when it opens so arrows work without a second tab press.
  useEffect(() => {
    if (open) listRef.current?.focus()
  }, [open])

  // Keep the active option in view while arrowing through a long list.
  useEffect(() => {
    if (!open || activeIndex < 0) return
    const node = document.getElementById(optionId(activeIndex))
    node?.scrollIntoView({ block: "nearest" })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeIndex])

  function commit(index: number) {
    const option = options[index]
    if (!option || option.disabled) return
    onChange(option.value)
    close()
  }

  function onTriggerKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
      e.preventDefault()
      openList("selected")
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      openList("last")
    } else if (e.key === "Home") {
      e.preventDefault()
      openList("first")
    } else if (e.key === "End") {
      e.preventDefault()
      openList("last")
    }
  }

  function onListKeyDown(e: React.KeyboardEvent<HTMLUListElement>) {
    switch (e.key) {
      case "Escape":
        e.preventDefault()
        close()
        return
      case "Tab":
        setOpen(false)
        return
      case "ArrowDown":
        e.preventDefault()
        setActiveIndex((i) => seek(i < 0 ? 0 : i + 1, 1))
        return
      case "ArrowUp":
        e.preventDefault()
        setActiveIndex((i) => seek(i < 0 ? options.length - 1 : i - 1, -1))
        return
      case "Home":
        e.preventDefault()
        setActiveIndex(seek(0, 1))
        return
      case "End":
        e.preventDefault()
        setActiveIndex(seek(options.length - 1, -1))
        return
      case "Enter":
      case " ":
      case "Spacebar":
        e.preventDefault()
        commit(activeIndex)
        return
    }

    // Type-ahead: single printable characters build a short prefix.
    if (e.key.length !== 1 || e.altKey || e.ctrlKey || e.metaKey) return
    const now = Date.now()
    typed.current.buffer = now - typed.current.at > TYPEAHEAD_MS ? e.key : typed.current.buffer + e.key
    typed.current.at = now
    const prefix = typed.current.buffer.toLowerCase()
    const from = activeIndex < 0 ? 0 : activeIndex
    for (let i = 1; i <= options.length; i++) {
      const idx = (from + i) % options.length
      const o = options[idx]
      if (!o.disabled && o.label.toLowerCase().startsWith(prefix)) {
        setActiveIndex(idx)
        return
      }
    }
    // Repeating one letter should also match the option you are already on.
    if (options[from] && !options[from].disabled && options[from].label.toLowerCase().startsWith(prefix)) {
      setActiveIndex(from)
    }
  }

  const triggerBorder = error
    ? "border-hoop-400 focus-visible:border-hoop-500 focus-visible:ring-hoop-200"
    : "border-ink-200 hover:border-ink-300 focus-visible:border-play-500 focus-visible:ring-play-400"

  return (
    <div className={`relative ${className ?? "w-full"}`} ref={wrapRef}>
      <button
        type="button"
        id={id}
        ref={buttonRef}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        onClick={() => (open ? close() : openList("selected"))}
        onKeyDown={onTriggerKeyDown}
        className={`flex min-h-[44px] w-full cursor-pointer items-center justify-between gap-2 rounded-xl border bg-white px-3 py-2.5 text-left text-sm text-ink-900 shadow-sm transition duration-200 focus:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:bg-ink-50 disabled:text-ink-400 ${triggerBorder}`}
      >
        <span className={`truncate ${selected ? "" : "text-ink-500"}`}>
          {selected ? selected.label : placeholder}
        </span>
        <svg
          className={`text-ink-400 h-4 w-4 shrink-0 motion-safe:transition-transform motion-safe:duration-200 ${
            open ? "rotate-180" : ""
          }`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <ul
          id={listId}
          ref={listRef}
          role="listbox"
          tabIndex={-1}
          aria-label={ariaLabel}
          aria-activedescendant={activeIndex >= 0 ? optionId(activeIndex) : undefined}
          onKeyDown={onListKeyDown}
          className={`border-ink-200 shadow-panel absolute z-50 max-h-64 w-full overflow-auto rounded-xl border bg-white p-1 focus:outline-none ${
            upward ? "bottom-full mb-2" : "top-full mt-2"
          }`}
        >
          {options.length === 0 && (
            <li className="text-ink-500 px-3 py-2.5 text-sm">Nothing to choose from</li>
          )}
          {options.map((o, i) => {
            const isSelected = o.value === value
            const isActive = i === activeIndex
            return (
              <li
                key={o.value}
                id={optionId(i)}
                role="option"
                aria-selected={isSelected}
                aria-disabled={o.disabled || undefined}
                onClick={() => commit(i)}
                onMouseMove={() => !o.disabled && setActiveIndex(i)}
                className={`flex min-h-[44px] items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-sm transition-colors duration-150 ${
                  o.disabled
                    ? "text-ink-300 cursor-not-allowed"
                    : `cursor-pointer ${isActive ? "bg-play-50 text-ink-950" : "text-ink-800"}`
                } ${isSelected && !o.disabled ? "font-semibold" : ""}`}
              >
                <span className="truncate">{o.label}</span>
                {isSelected && (
                  <svg
                    className="h-4 w-4 shrink-0 text-[#f59e0b]"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M4 12.5l5 5L20 6.5" />
                  </svg>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
