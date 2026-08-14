"use client"

import { useEffect, useRef, useState } from "react"
import { CodeInput } from "@/components/family/link-code"

/**
 * The guardian ask on the Player profile step, rebuilt 2026-08-13 (owner: the
 * old block was long, and it made a kid answer a question the server can
 * answer itself).
 *
 * Four states, and the backend picks which one shows:
 *  IDLE     no birth date yet, so nothing has been checked. One line, one field.
 *  MATCH    /api/family/claim-check says a parent already made this profile.
 *           One sentence and one button. The kid is never shown a name or an
 *           email — the check answers one bit and nothing else.
 *  NO MATCH nobody has them yet, so ask for the email.
 *  CODE     they are sitting next to their parent and have the six characters.
 *
 * Everything here is skippable. Leaving it alone never blocks onboarding.
 */

export type GuardianMode = "email" | "claim" | "code"

export interface GuardianState {
  mode: GuardianMode
  email: string
  code: string
  /** claim-check said a parent-made profile exists for this name + year. */
  matched: boolean
  /** Year the check ran against, sent back as the autoClaim cross-check. */
  birthYear: number | null
}

export const EMPTY_GUARDIAN: GuardianState = {
  mode: "email",
  email: "",
  code: "",
  matched: false,
  birthYear: null,
}

/** Enter inside this block must never submit the profile form around it. */
function swallowEnter(e: React.KeyboardEvent) {
  if (e.key === "Enter") e.preventDefault()
}

function ShieldIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3 4.5 6v6c0 4.4 3.1 7.6 7.5 9 4.4-1.4 7.5-4.6 7.5-9V6L12 3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  )
}

const linkClass =
  "cursor-pointer rounded text-sm font-semibold text-play-700 underline decoration-play-300 underline-offset-2 transition-colors duration-200 hover:text-play-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-play-500 focus-visible:ring-offset-2"

const emailInputClass =
  "border-ink-200 text-ink-900 placeholder-ink-400 focus:border-play-500 focus:ring-play-500/20 mt-1 block min-h-[44px] w-full rounded-xl border bg-white px-3 py-2.5 text-sm shadow-sm transition duration-200 focus:outline-none focus:ring-2"

export function GuardianBlock({
  dateOfBirth,
  state,
  onChange,
  onCheckResult,
}: {
  dateOfBirth: string
  state: GuardianState
  onChange: (next: GuardianState) => void
  /** Reports the claim-check answer without carrying stale field state back. */
  onCheckResult: (matched: boolean, birthYear: number) => void
}) {
  const [checking, setChecking] = useState(false)
  /** Years already asked about — the endpoint allows 10 checks an hour. */
  const seen = useRef<Map<number, boolean>>(new Map())

  const year = Number(dateOfBirth?.slice(0, 4))
  const validYear = Number.isInteger(year) && year > 1900 && year <= new Date().getFullYear()

  useEffect(() => {
    if (!validYear) return
    const known = seen.current.get(year)
    if (known !== undefined) {
      onCheckResult(known, year)
      return
    }
    const timer = window.setTimeout(async () => {
      if (seen.current.has(year)) return
      seen.current.set(year, false)
      setChecking(true)
      try {
        const res = await fetch(`/api/family/claim-check?birthYear=${year}`)
        const data = await res.json().catch(() => ({}))
        const match = res.ok && data?.match === true
        seen.current.set(year, match)
        onCheckResult(match, year)
      } catch {
        // A check that never answered is the same as no match: the email path
        // still works, so there is nothing to tell them about.
        onCheckResult(false, year)
      } finally {
        setChecking(false)
      }
    }, 500)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, validYear])

  const set = (patch: Partial<GuardianState>) => onChange({ ...state, ...patch })

  // CODE — they have the six characters in front of them.
  if (state.mode === "code") {
    return (
      <section
        onKeyDown={swallowEnter}
        className="border-play-100 bg-play-50/60 rounded-2xl border p-4"
      >
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-ink-900 flex items-center gap-2 text-sm font-bold">
            <span className="text-play-700">
              <ShieldIcon />
            </span>
            Your parent&apos;s code
          </h3>
          <button type="button" className={linkClass} onClick={() => set({ mode: "email" })}>
            Use an email
          </button>
        </div>
        <div className="mt-2 max-w-[15rem]">
          <CodeInput
            id="guardian-link-code"
            label="Six characters"
            value={state.code}
            onChange={(v) => set({ code: v })}
          />
        </div>
        <p className="text-ink-600 mt-2 text-xs">We link your accounts the moment you finish.</p>
      </section>
    )
  }

  // MATCH — the server found a profile a parent already made.
  if (state.matched) {
    const askedToLink = state.mode === "claim"
    return (
      <section
        onKeyDown={swallowEnter}
        className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-ink-900 flex items-center gap-2 text-sm font-semibold">
            <span className="text-amber-700">
              <ShieldIcon />
            </span>
            {askedToLink
              ? "We will ask your parent to link you."
              : "Looks like a parent already added you to SportsHub"}
          </p>
          {askedToLink ? (
            <button type="button" className={linkClass} onClick={() => set({ mode: "email" })}>
              Use an email instead
            </button>
          ) : (
            <button
              type="button"
              onClick={() => set({ mode: "claim", email: "" })}
              className="min-h-[44px] cursor-pointer rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-amber-950 shadow-sm transition-colors duration-200 hover:bg-amber-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:ring-offset-2"
            >
              Ask to link
            </button>
          )}
        </div>
      </section>
    )
  }

  // IDLE (nothing checked yet) and NO MATCH share the email field.
  const checked = state.birthYear !== null && !checking
  return (
    <section
      onKeyDown={swallowEnter}
      className="border-play-100 bg-play-50/60 rounded-2xl border p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-ink-900 flex items-center gap-2 text-sm font-bold">
          <span className="text-play-700">
            <ShieldIcon />
          </span>
          Add your parent or guardian
        </h3>
        <button type="button" className={linkClass} onClick={() => set({ mode: "code" })}>
          Have a code?
        </button>
      </div>
      {checked && (
        <p className="text-ink-700 mt-1.5 text-[13px] leading-5">
          They approve payments and permissions, so add them now and skip a wait later.
        </p>
      )}
      <label htmlFor="guardian-email" className="sr-only">
        Parent or guardian email
      </label>
      <input
        id="guardian-email"
        type="email"
        autoComplete="off"
        value={state.email}
        onChange={(e) => set({ email: e.target.value })}
        placeholder="parent@example.com"
        className={emailInputClass}
      />
    </section>
  )
}
