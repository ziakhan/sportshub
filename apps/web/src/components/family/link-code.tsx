"use client"

import { useCallback, useState } from "react"
import { ChoiceCardGroup } from "@/components/ui"

/**
 * The one code input and the one redeem call (parent-child linking arc,
 * 2026-08-13). Onboarding asks for a code, the dashboard nudge asks for a
 * code, and a family-settings screen will ask for it next; all three share
 * this so the field, the uppercasing, the generic failure sentence and the
 * merge follow-up stay identical wherever the ask appears.
 *
 * Backend contract (apps/web/src/app/api/family/link-code/redeem/route.ts):
 *   POST { code }
 *   200 { linked: true, playerId, direction, mergeCandidate?: { id, name } }
 *   400 { error: "That code did not work. Check it and try again." }
 * Every failure is the same sentence on purpose, so this never invents one.
 */

export const CODE_LENGTH = 6

export type MergeCandidate = { id: string; name: string }

export type RedeemResult = {
  linked: true
  playerId: string
  direction: string
  mergeCandidate?: MergeCandidate
}

/** Strip everything the code alphabet does not use and cap the length. */
export function normalizeTypedCode(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, CODE_LENGTH)
}

export function CodeInput({
  value,
  onChange,
  id = "family-link-code",
  label = "Your parent's code",
  disabled = false,
  autoFocus = false,
}: {
  value: string
  onChange: (v: string) => void
  id?: string
  label?: string
  disabled?: boolean
  autoFocus?: boolean
}) {
  return (
    <div>
      <label htmlFor={id} className="text-ink-800 block text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        type="text"
        inputMode="text"
        autoCapitalize="characters"
        autoComplete="one-time-code"
        spellCheck={false}
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus={autoFocus}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(normalizeTypedCode(e.target.value))}
        placeholder="K7M2QX"
        maxLength={CODE_LENGTH}
        className="border-ink-200 text-ink-950 placeholder-ink-300 focus:border-play-500 focus:ring-play-500/20 mt-1 block min-h-[44px] w-full rounded-xl border bg-white px-3 py-2.5 font-mono text-lg font-bold uppercase tracking-[0.3em] shadow-sm transition duration-200 focus:outline-none focus:ring-2 disabled:bg-ink-50"
      />
    </div>
  )
}

/** Redeem state machine, shared by every surface that offers the code path. */
export function useRedeemCode() {
  const [code, setCodeRaw] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<RedeemResult | null>(null)

  const setCode = useCallback((v: string) => {
    setCodeRaw(normalizeTypedCode(v))
    setError(null)
  }, [])

  const redeem = useCallback(async (): Promise<RedeemResult | null> => {
    const trimmed = normalizeTypedCode(code)
    if (trimmed.length < 4) {
      setError("That code did not work. Check it and try again.")
      return null
    }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/family/link-code/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: trimmed }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || "That code did not work. Check it and try again.")
        return null
      }
      setResult(data as RedeemResult)
      return data as RedeemResult
    } catch {
      setError("That code did not work. Check it and try again.")
      return null
    } finally {
      setBusy(false)
    }
  }, [code])

  const reset = useCallback(() => {
    setCodeRaw("")
    setError(null)
    setResult(null)
  }, [])

  return { code, setCode, busy, error, result, redeem, reset }
}

/**
 * The merge a link offers but never applies on its own.
 *
 * ⚠ Contract note (verified against apps/web/src/app/api/family/merge/route.ts):
 * the merge endpoint requires the SURVIVING row to belong to the caller
 * (`target.parentId !== session.userId → 403`). After a kid redeems their
 * parent's code both rows belong to the PARENT, so a kid tapping this gets the
 * 403. We still offer the choice, because saying "keep them together" is the
 * decision worth capturing, and we answer a refusal with the truth: the parent
 * finishes it. Nothing here can block the screen it sits on.
 */
export function MergeOffer({
  sourcePlayerId,
  candidate,
  onDone,
}: {
  sourcePlayerId: string
  candidate: MergeCandidate
  onDone: () => void
}) {
  const [choice, setChoice] = useState("")
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  async function apply() {
    // Once we've told them the parent finishes it, the button just leaves.
    if (note || choice !== "merge") {
      onDone()
      return
    }
    setBusy(true)
    try {
      const res = await fetch("/api/family/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourcePlayerId, targetPlayerId: candidate.id }),
      })
      if (res.ok) {
        onDone()
        return
      }
      // A refusal here is normal when the kid is the one asking: the rows are
      // the parent's to join. Say that plainly and move on.
      setNote("Saved. Your parent finishes joining the two profiles from their account.")
    } catch {
      setNote("Saved. Your parent finishes joining the two profiles from their account.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-ink-700 text-sm">
        There is already a profile for you under your parent&apos;s account.
      </p>
      <ChoiceCardGroup
        ariaLabel="What to do with the other profile"
        value={choice}
        onChange={setChoice}
        options={[
          {
            value: "merge",
            title: "Keep everything on one profile",
            description: "Your stats and teams stay together in one place.",
            badge: "Most families",
          },
          {
            value: "separate",
            title: "Keep them separate",
            description: "Leave the other profile as it is.",
          },
        ]}
      />
      {note && <p className="text-ink-600 text-sm">{note}</p>}
      <button
        type="button"
        disabled={busy || !choice}
        onClick={() => void apply()}
        className="bg-play-600 hover:bg-play-700 disabled:bg-ink-300 min-h-[44px] w-full cursor-pointer rounded-xl px-4 py-3 font-semibold text-white shadow-sm transition-colors duration-200 disabled:cursor-not-allowed"
      >
        {busy ? "Saving..." : "Continue"}
      </button>
    </div>
  )
}
