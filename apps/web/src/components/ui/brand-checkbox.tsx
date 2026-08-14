"use client"

import { useId, type ReactNode } from "react"

/**
 * Branded checkbox (2026-08-13). A real <input type="checkbox">, kept in the
 * accessibility tree and in the tab order, with the OS box swapped for a brand
 * one. Screen readers and form libraries see nothing unusual; only the paint
 * changes.
 *
 * The label / sub-label split follows the adult attestation in onboarding: the
 * commitment on line one, the reason it is being asked on line two.
 */

export function BrandCheckbox({
  checked,
  onChange,
  label,
  subLabel,
  id,
  className,
  disabled = false,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: ReactNode
  subLabel?: ReactNode
  id?: string
  className?: string
  disabled?: boolean
}) {
  const reactId = useId()
  const inputId = id ?? `${reactId}-checkbox`

  return (
    <label
      htmlFor={inputId}
      className={`flex min-h-[44px] items-start gap-3 rounded-xl border p-3.5 transition-colors duration-200 ${
        disabled
          ? "border-ink-100 bg-ink-50/60 cursor-not-allowed"
          : checked
            ? "border-play-200 bg-play-50/70 cursor-pointer"
            : "border-ink-200 hover:border-play-300 hover:bg-play-50/40 cursor-pointer bg-white"
      } ${className ?? ""}`}
    >
      <input
        id={inputId}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border-2 transition-colors duration-200 peer-focus-visible:ring-2 peer-focus-visible:ring-play-500 peer-focus-visible:ring-offset-2 ${
          checked
            ? disabled
              ? "border-ink-300 bg-ink-300"
              : "border-play-600 bg-play-600"
            : "border-ink-300 bg-white"
        }`}
      >
        <svg
          className={`h-3 w-3 text-white transition-opacity duration-150 ${
            checked ? "opacity-100" : "opacity-0"
          }`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 12.5l5 5L20 6.5" />
        </svg>
      </span>

      <span className="min-w-0 flex-1">
        <span
          className={`block text-sm font-semibold leading-5 ${
            disabled ? "text-ink-400" : "text-ink-900"
          }`}
        >
          {label}
        </span>
        {subLabel && (
          <span
            className={`mt-1 block text-[13px] leading-5 ${
              disabled ? "text-ink-400" : "text-ink-600"
            }`}
          >
            {subLabel}
          </span>
        )}
      </span>
    </label>
  )
}
