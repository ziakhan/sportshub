"use client"

/**
 * Age-policy picker for program create/edit forms (owner 2026-07-23):
 * STRICT blocks out-of-age registrations, PREFERRED warns but allows,
 * OPEN skips the check. Renders with the standard form field styling.
 */

const OPTIONS: Array<{ value: string; label: string; hint: string }> = [
  {
    value: "STRICT",
    label: "Strict — only the age group can register",
    hint: "Players outside the age group are blocked at registration.",
  },
  {
    value: "PREFERRED",
    label: "Preferred — warn but allow",
    hint: "Families see a heads-up when a player is outside the age group, but can still register.",
  },
  {
    value: "OPEN",
    label: "Open — no age check",
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
      <select
        id="age-policy"
        value={current.value}
        onChange={(e) => onChange(e.target.value)}
        className={
          className ??
          "mt-1 block w-full rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-ink-900 shadow-sm focus:border-[color:var(--brand)] focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-line)]"
        }
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <p className="mt-1 text-xs text-ink-500">{current.hint}</p>
    </div>
  )
}
