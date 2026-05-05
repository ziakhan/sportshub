"use client"

import { Suspense, useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { addPlayerSchema, type AddPlayerFormData } from "@/lib/validations/tryout-signup"

function calcAge(dobStr: string | undefined): number | null {
  if (!dobStr) return null
  const dob = new Date(dobStr)
  if (isNaN(dob.getTime())) return null
  return Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000))
}

function AddPlayerForm() {
  const searchParams = useSearchParams()
  const redirectTo = searchParams?.get("redirect") ?? null

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdPlayer, setCreatedPlayer] = useState<{ name: string } | null>(null)
  const labelClass = "block text-sm font-medium text-ink-700"
  const inputClass =
    "mt-1 block w-full rounded-xl border border-ink-200 px-3 py-2 text-ink-900 shadow-sm focus:border-play-500 focus:outline-none focus:ring-2 focus:ring-play-500/20"

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<AddPlayerFormData>({
    resolver: zodResolver(addPlayerSchema),
  })

  const watchedDob = watch("dateOfBirth")
  const watchedConsent = watch("parentalConsentGiven")
  const age = calcAge(watchedDob)
  const isMinor = age !== null && age < 13

  const onSubmit = async (data: AddPlayerFormData) => {
    setIsSubmitting(true)
    setError(null)

    try {
      const res = await fetch("/api/players", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || "Failed to add player")
      }

      setCreatedPlayer({ name: `${data.firstName} ${data.lastName}` })
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (createdPlayer) {
    return (
      <div className="p-6 md:p-8">
        <div className="mx-auto max-w-xl">
          <div className="border-ink-100 rounded-3xl border bg-white p-8 text-center shadow-[0_16px_50px_-34px_rgba(15,23,42,0.45)]">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <svg
                className="h-6 w-6 text-green-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h2 className="text-ink-900 mb-2 text-xl font-semibold">Player Added!</h2>
            <p className="text-ink-600 mb-6">
              <span className="font-semibold">{createdPlayer.name}</span> has been registered.
            </p>
            <div className="flex gap-3">
              <Link
                href={redirectTo || "/players"}
                className="bg-play-600 hover:bg-play-700 flex-1 rounded-xl px-4 py-2 text-center font-semibold text-white transition"
              >
                View My Players
              </Link>
              <button
                onClick={() => {
                  setCreatedPlayer(null)
                  setError(null)
                  reset()
                }}
                className="border-ink-200 text-ink-700 hover:bg-court-50 flex-1 rounded-xl border px-4 py-2 font-semibold transition"
              >
                Add Another Player
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 md:p-8">
      <div className="mx-auto max-w-xl">
        <div className="mb-6">
          <Link href={redirectTo || "/players"} className="text-ink-500 hover:text-ink-700 text-sm">
            &larr; Back to Players
          </Link>
        </div>

        <div className="border-ink-100 rounded-3xl border bg-white p-8 shadow-[0_16px_50px_-34px_rgba(15,23,42,0.45)]">
          <h1 className="text-ink-900 mb-2 text-2xl font-semibold">Add a Player</h1>
          <p className="text-ink-600 mb-6 text-sm">
            Register your child so you can sign them up for tryouts and teams.
          </p>

          {error && (
            <div className="border-hoop-200 bg-hoop-50 text-hoop-700 mb-4 rounded-xl border p-3 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="firstName" className={labelClass}>
                  First Name <span className="text-red-500">*</span>
                </label>
                <input
                  {...register("firstName")}
                  type="text"
                  id="firstName"
                  className={inputClass}
                  placeholder="First name"
                />
                {errors.firstName && (
                  <p className="mt-1 text-sm text-red-600">{errors.firstName.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="lastName" className={labelClass}>
                  Last Name <span className="text-red-500">*</span>
                </label>
                <input
                  {...register("lastName")}
                  type="text"
                  id="lastName"
                  className={inputClass}
                  placeholder="Last name"
                />
                {errors.lastName && (
                  <p className="mt-1 text-sm text-red-600">{errors.lastName.message}</p>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="dateOfBirth" className={labelClass}>
                Date of Birth <span className="text-red-500">*</span>
              </label>
              <input
                {...register("dateOfBirth")}
                type="date"
                id="dateOfBirth"
                className={inputClass}
              />
              {errors.dateOfBirth && (
                <p className="mt-1 text-sm text-red-600">{errors.dateOfBirth.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="gender" className={labelClass}>
                Gender <span className="text-red-500">*</span>
              </label>
              <select {...register("gender")} id="gender" className={inputClass}>
                <option value="">Select gender</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="COED">Other</option>
              </select>
              {errors.gender && (
                <p className="mt-1 text-sm text-red-600">{errors.gender.message}</p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="jerseyNumber" className={labelClass}>
                  Jersey Number <span className="text-ink-400">(optional)</span>
                </label>
                <input
                  {...register("jerseyNumber")}
                  type="text"
                  id="jerseyNumber"
                  className={inputClass}
                  placeholder="e.g. 23"
                />
              </div>

              <div>
                <label htmlFor="height" className={labelClass}>
                  Height <span className="text-ink-400">(optional)</span>
                </label>
                <input
                  {...register("height")}
                  type="text"
                  id="height"
                  className={inputClass}
                  placeholder={`e.g. 5'6"`}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="weight" className={labelClass}>
                  Weight (lbs) <span className="text-ink-400">(optional)</span>
                </label>
                <input
                  {...register("weight")}
                  type="number"
                  id="weight"
                  className={inputClass}
                  placeholder="e.g. 120"
                />
              </div>

              <div>
                <label htmlFor="position" className={labelClass}>
                  Position <span className="text-ink-400">(optional)</span>
                </label>
                <select {...register("position")} id="position" className={inputClass}>
                  <option value="">Select position</option>
                  <option value="Point Guard">Point Guard</option>
                  <option value="Shooting Guard">Shooting Guard</option>
                  <option value="Small Forward">Small Forward</option>
                  <option value="Power Forward">Power Forward</option>
                  <option value="Center">Center</option>
                </select>
              </div>
            </div>

            {isMinor && (
              <div className="border-play-200 bg-play-50 rounded-xl border p-4">
                <p className="text-ink-700 mb-3 text-sm">
                  This child is under 13. Federal law (COPPA) requires a parent or guardian to give explicit consent before we can collect or store their information.
                </p>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    {...register("parentalConsentGiven")}
                    type="checkbox"
                    className="mt-1"
                  />
                  <span className="text-ink-700">
                    I am the parent or legal guardian and I consent to registering this child.
                  </span>
                </label>
              </div>
            )}

            <div className="flex gap-4 pt-2">
              <Link
                href={redirectTo || "/players"}
                className="border-ink-200 text-ink-700 hover:bg-court-50 rounded-xl border bg-white px-4 py-2 font-semibold shadow-sm transition"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={isSubmitting || (isMinor && !watchedConsent)}
                className="bg-play-600 hover:bg-play-700 disabled:bg-ink-400 flex-1 rounded-xl px-4 py-2 font-semibold text-white shadow-sm transition disabled:cursor-not-allowed"
              >
                {isSubmitting ? "Adding..." : "Add Player"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default function AddPlayerPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-12">
          <p className="text-ink-500">Loading...</p>
        </div>
      }
    >
      <AddPlayerForm />
    </Suspense>
  )
}
