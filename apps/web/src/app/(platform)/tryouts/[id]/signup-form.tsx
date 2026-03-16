"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import Link from "next/link"
import {
  tryoutSignupSchema,
  type TryoutSignupFormData,
} from "@/lib/validations/tryout-signup"

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
  tryoutLocation: string
  tryoutDate: string
  players: Player[]
  existingSignups: ExistingSignup[]
}

export function SignupForm({
  tryoutId,
  tryoutFee,
  tryoutLocation,
  tryoutDate,
  players,
  existingSignups,
}: SignupFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
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

  // Filter out players who are already signed up
  const signedUpNames = new Set(existingSignups.map((s) => s.playerName))
  const availablePlayers = players.filter(
    (p) => !signedUpNames.has(`${p.firstName} ${p.lastName}`)
  )

  const onSubmit = async (data: TryoutSignupFormData) => {
    setIsSubmitting(true)
    setError(null)

    try {
      const res = await fetch(`/api/tryouts/${tryoutId}/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
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
        <div className="rounded-md bg-green-50 border border-green-200 p-4">
          <h3 className="font-semibold text-green-800 mb-2">
            {success.status === "CONFIRMED"
              ? "You're confirmed!"
              : "Signup registered!"}
          </h3>
          <p className="text-sm text-green-700">
            {success.status === "CONFIRMED" ? (
              <>
                <strong>{success.playerName}</strong> is confirmed for this
                tryout. See you at {tryoutLocation} on {tryoutDate}.
              </>
            ) : (
              <>
                <strong>{success.playerName}</strong> has been registered.
                Payment of <strong>${tryoutFee}</strong> will be required when
                payment processing is available.
              </>
            )}
          </p>
        </div>
        <Link
          href="/dashboard"
          className="block text-center text-sm font-medium text-blue-600 hover:text-blue-700"
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
        <div className="rounded-md bg-blue-50 border border-blue-200 p-4">
          <h3 className="font-semibold text-blue-800 mb-2">Already Signed Up</h3>
          <p className="text-sm text-blue-700">
            All your players are already signed up for this tryout.
          </p>
        </div>
        <ul className="space-y-2">
          {existingSignups.map((signup) => (
            <li
              key={signup.id}
              className="flex items-center justify-between rounded-md bg-gray-50 p-3 text-sm"
            >
              <span className="font-medium text-gray-900">
                {signup.playerName}
              </span>
              <span
                className={
                  signup.status === "CONFIRMED"
                    ? "text-green-600"
                    : "text-yellow-600"
                }
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
        <div className="rounded-md bg-yellow-50 border border-yellow-200 p-4">
          <h3 className="font-semibold text-yellow-800 mb-2">
            Add a Player First
          </h3>
          <p className="text-sm text-yellow-700">
            You need to add a player before signing up for a tryout.
          </p>
        </div>
        <Link
          href={`/players/add?redirect=/tryouts/${tryoutId}`}
          className="block w-full rounded-md bg-blue-600 px-4 py-3 text-center font-semibold text-white hover:bg-blue-700"
        >
          Add a Player
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-gray-900">Sign Up a Player</h3>

      {existingSignups.length > 0 && (
        <div className="rounded-md bg-gray-50 p-3">
          <p className="mb-2 text-xs font-medium text-gray-500">
            Already signed up:
          </p>
          {existingSignups.map((signup) => (
            <div
              key={signup.id}
              className="text-sm text-gray-700"
            >
              {signup.playerName} ({signup.status})
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label
            htmlFor="playerId"
            className="block text-sm font-medium text-gray-700"
          >
            Select Player <span className="text-red-500">*</span>
          </label>
          <select
            {...register("playerId")}
            id="playerId"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Choose a player...</option>
            {availablePlayers.map((player) => (
              <option key={player.id} value={player.id}>
                {player.firstName} {player.lastName}
              </option>
            ))}
          </select>
          {errors.playerId && (
            <p className="mt-1 text-sm text-red-600">
              {errors.playerId.message}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="notes"
            className="block text-sm font-medium text-gray-700"
          >
            Notes <span className="text-gray-400">(optional)</span>
          </label>
          <textarea
            {...register("notes")}
            id="notes"
            rows={3}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="Any additional info for the club..."
          />
          {errors.notes && (
            <p className="mt-1 text-sm text-red-600">
              {errors.notes.message}
            </p>
          )}
        </div>

        {tryoutFee > 0 && (
          <p className="text-xs text-gray-500">
            This tryout requires a ${tryoutFee} fee. Payment processing will be
            available soon. Your signup will be marked as pending until payment
            is completed.
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-md bg-blue-600 px-4 py-3 font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400"
        >
          {isSubmitting
            ? "Signing up..."
            : tryoutFee === 0
              ? "Sign Up (Free)"
              : `Sign Up ($${tryoutFee})`}
        </button>
      </form>
    </div>
  )
}
