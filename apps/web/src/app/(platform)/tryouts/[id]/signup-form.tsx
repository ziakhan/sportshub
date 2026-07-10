"use client"

import { useState } from "react"
import type { ReactNode } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import Link from "next/link"
import { formatCurrency } from "@/lib/countries"
import { tryoutSignupSchema, type TryoutSignupFormData } from "@/lib/validations/tryout-signup"
import { Button, PanelHeader } from "@/components/ui"

interface Player {
  id: string
  firstName: string
  lastName: string
  dateOfBirth: string | Date
  gender: string
}

interface ExistingSignup {
  id: string
  playerName: string
  status: string
}

interface SignupFormProps {
  tryoutId: string
  tryoutFee: number
  currency?: string
  tryoutLocation: string
  tryoutDate: string
  players: Player[]
  existingSignups: ExistingSignup[]
}

export function SignupForm({
  tryoutId,
  tryoutFee,
  currency,
  tryoutLocation,
  tryoutDate,
  players,
  existingSignups,
}: SignupFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Kept outside react-hook-form: the shared zod schema would strip unknown
  // keys via the resolver, so the checkbox is merged into the POST body.
  const [marketingConsent, setMarketingConsent] = useState(false)
  const [success, setSuccess] = useState<{
    playerName: string
    status: string
  } | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<TryoutSignupFormData>({
    resolver: zodResolver(tryoutSignupSchema),
  })
  const labelClass = "block text-sm font-medium text-ink-800"
  const inputClass =
    "mt-1 block w-full rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-ink-900 shadow-sm focus:border-[color:var(--brand)] focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-line)]"

  // Filter out players who are already signed up
  const signedUpNames = new Set(existingSignups.map((s) => s.playerName))
  const availablePlayers = players.filter((p) => !signedUpNames.has(`${p.firstName} ${p.lastName}`))

  const onSubmit = async (data: TryoutSignupFormData) => {
    setIsSubmitting(true)
    setError(null)

    try {
      const res = await fetch(`/api/tryouts/${tryoutId}/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, marketingConsent }),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || "Failed to sign up")
      }

      const signup = await res.json()
      setSuccess({
        playerName: signup.playerName,
        status: signup.status,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsSubmitting(false)
    }
  }

  // Show success state
  if (success) {
    return (
      <div className="space-y-4">
        <div className="rounded-md border border-green-200 bg-green-50 p-4">
          <h3 className="mb-2 font-semibold text-green-800">
            {success.status === "CONFIRMED" ? "You're confirmed!" : "Signup registered!"}
          </h3>
          <p className="text-court-700 text-sm">
            {success.status === "CONFIRMED" ? (
              <>
                <strong>{success.playerName}</strong> is confirmed for this tryout. See you at{" "}
                {tryoutLocation} on {tryoutDate}.
              </>
            ) : (
              <>
                <strong>{success.playerName}</strong> has been registered. Payment of{" "}
                <strong>{formatCurrency(tryoutFee, currency)}</strong> will be required when payment processing is available.
              </>
            )}
          </p>
        </div>
        <Link
          href="/dashboard"
          className="block text-center text-sm font-medium text-[color:var(--brand-ink)] transition hover:opacity-80"
        >
          View in Dashboard &rarr;
        </Link>
      </div>
    )
  }

  // Show existing signups
  if (existingSignups.length > 0 && availablePlayers.length === 0 && players.length > 0) {
    return (
      <div className="space-y-4">
        <div className="border-hoop-200 bg-hoop-50 rounded-xl border p-4">
          <h3 className="text-hoop-800 mb-2 font-semibold">Already Signed Up</h3>
          <p className="text-sm text-orange-700">
            All your players are already signed up for this tryout.
          </p>
        </div>
        <ul className="space-y-2">
          {existingSignups.map((signup) => (
            <li
              key={signup.id}
              className="border-court-100 bg-court-50 flex items-center justify-between rounded-xl border p-3 text-sm"
            >
              <span className="text-ink-900 font-medium">{signup.playerName}</span>
              <span
                className={signup.status === "CONFIRMED" ? "text-green-600" : "text-yellow-600"}
              >
                {signup.status}
              </span>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  // No players registered — prompt to add one
  if (players.length === 0) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-4">
          <h3 className="mb-2 font-semibold text-yellow-800">Add a Player First</h3>
          <p className="text-hoop-700 text-sm">
            You need to add a player before signing up for a tryout.
          </p>
        </div>
        <Button href={`/players/add?redirect=/tryouts/${tryoutId}`} block size="lg" icon={ICONS.plus}>
          Add a Player
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <PanelHeader title="Sign Up a Player" />

      {existingSignups.length > 0 && (
        <div className="border-court-100 bg-court-50 rounded-xl border p-3">
          <p className="text-ink-500 mb-2 text-xs font-medium">Already signed up:</p>
          {existingSignups.map((signup) => (
            <div key={signup.id} className="text-ink-700 text-sm">
              {signup.playerName} ({signup.status})
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="border-hoop-200 bg-hoop-50 text-hoop-700 rounded-xl border p-3 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label htmlFor="playerId" className={labelClass}>
            Select Player <span className="text-red-500">*</span>
          </label>
          <select {...register("playerId")} id="playerId" className={inputClass}>
            <option value="">Choose a player...</option>
            {availablePlayers.map((player) => (
              <option key={player.id} value={player.id}>
                {player.firstName} {player.lastName}
              </option>
            ))}
          </select>
          {errors.playerId && (
            <p className="mt-1 text-sm text-red-600">{errors.playerId.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="notes" className={labelClass}>
            Notes <span className="text-ink-400">(optional)</span>
          </label>
          <textarea
            {...register("notes")}
            id="notes"
            rows={3}
            className={inputClass}
            placeholder="Any additional info for the club..."
          />
          {errors.notes && <p className="mt-1 text-sm text-red-600">{errors.notes.message}</p>}
        </div>

        {tryoutFee > 0 && (
          <p className="text-ink-500 text-xs">
            This tryout requires a {formatCurrency(tryoutFee, currency)} fee. Payment processing will be available soon. Your
            signup will be marked as pending until payment is completed.
          </p>
        )}

        <label className="flex items-start gap-2 text-sm text-ink-600">
          <input
            type="checkbox"
            checked={marketingConsent}
            onChange={(e) => setMarketingConsent(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-ink-300"
          />
          <span>Email me about future programs from this club</span>
        </label>

        <Button type="submit" disabled={isSubmitting} block size="lg" icon={ICONS.check}>
          {isSubmitting
            ? "Signing up..."
            : tryoutFee === 0
              ? "Sign Up (Free)"
              : `Sign Up (${formatCurrency(tryoutFee, currency)})`}
        </Button>
      </form>
    </div>
  )
}

/** Inline SVG icons (the Button kit sizes them). */
const ICONS: Record<string, ReactNode> = {
  plus: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
}
