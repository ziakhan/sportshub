"use client"

import { BrandListbox } from "@/components/ui"

/**
 * Age-policy picker for program create/edit forms (owner 2026-07-23):
 * STRICT blocks out-of-age registrations, PREFERRED warns but allows,
 * OPEN skips the check. Renders with the standard form field styling.
 */

const OPTIONS: Array<{ value: string; label: string; hint: string }> = [
  {
    value: "STRICT",
    label: "Strict: only the age group can register",
    hint: "Players outside the age group are blocked at registration.",
  },
  {
    value: "PREFERRED",
    label: "Preferred: warn but allow",
    hint: "Families see a heads-up when a player is outside the age group, but can still register.",
  },
  {
    value: "OPEN",
    label: "Open: no age check",
    hint: "Anyone can register regardless of age.",
  },
]

export function AgePolicySelect({
  value,
  onChange,
  className,
}: {
  value: string
  onChange: (value: string) => void
  className?: string
}) {
  const current = OPTIONS.find((o) => o.value === value) ?? OPTIONS[1]
  return (
    <div>
      <label htmlFor="age-policy" className="block text-sm font-medium text-ink-800">
        Age policy
      </label>
      <div className="mt-1">
        <BrandListbox
          id="age-policy"
          ariaLabel="Age policy"
          value={current.value}
          onChange={onChange}
          className={className}
          options={OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
        />
      </div>
      <p className="mt-1 text-xs text-ink-500">{current.hint}</p>
    </div>
  )
}
