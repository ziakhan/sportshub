"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { addPlayerSchema, type AddPlayerFormData } from "@/lib/validations/tryout-signup"

export default function EditPlayerPage() {
  const router = useRouter()
  const params = useParams()
  const playerId = params?.id as string

  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const labelClass = "block text-sm font-medium text-ink-700"
  const inputClass =
    "mt-1 block w-full rounded-xl border border-ink-200 px-3 py-2 text-ink-900 shadow-sm focus:border-play-500 focus:outline-none focus:ring-2 focus:ring-play-500/20"

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AddPlayerFormData>({
    resolver: zodResolver(addPlayerSchema),
  })

  useEffect(() => {
    async function loadPlayer() {
      try {
        const res = await fetch(`/api/players/${playerId}`)
        if (!res.ok) throw new Error("Failed to load player")
        const data = await res.json()
        reset({
          firstName: data.firstName,
          lastName: data.lastName,
          dateOfBirth: new Date(data.dateOfBirth).toISOString().split("T")[0],
          gender: data.gender,
          jerseyNumber: data.jerseyNumber || "",
          height: data.height || "",
          weight: data.weight || undefined,
          position: data.position || "",
        })
      } catch {
        setError("Failed to load player")
      } finally {
        setIsLoading(false)
      }
    }
    loadPlayer()
  }, [playerId, reset])

  const onSubmit = async (data: AddPlayerFormData) => {
    setIsSubmitting(true)
    setError(null)
    setSuccess(false)

    try {
      const res = await fetch(`/api/players/${playerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || "Failed to update player")
      }

      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-ink-500">Loading player...</p>
      </div>
    )
  }

  return (
    <div className="p-6 md:p-8">
      <div className="mx-auto max-w-xl">
        <div className="mb-6">
          <Link href="/players" className="text-ink-500 hover:text-ink-700 text-sm">
            &larr; Back to Players
          </Link>
        </div>

        <div className="border-ink-100 rounded-3xl border bg-white p-8 shadow-[0_16px_50px_-34px_rgba(15,23,42,0.45)]">
          <h1 className="text-ink-900 mb-2 text-2xl font-semibold">Edit Player</h1>
          <p className="text-ink-600 mb-6 text-sm">Update your player&apos;s information.</p>

          {error && (
            <div className="border-hoop-200 bg-hoop-50 text-hoop-700 mb-4 rounded-xl border p-3 text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-court-50 text-court-700 mb-4 rounded-md border border-green-200 p-3 text-sm">
              Player updated successfully!
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
                />
                {errors.firstName && (
                  <p className="mt-1 text-sm text-red-600">{errors.firstName.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="lastName" className={labelClass}>
                  Last Name <span className="text-red-500">*</span>
                </label>
                <input {...register("lastName")} type="text" id="lastName" className={inputClass} />
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

            <div className="flex gap-4 pt-2">
              <button
                type="button"
                onClick={() => router.back()}
                className="border-ink-200 text-ink-700 hover:bg-court-50 rounded-xl border bg-white px-4 py-2 font-semibold shadow-sm transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="bg-play-600 hover:bg-play-700 disabled:bg-ink-400 flex-1 rounded-xl px-4 py-2 font-semibold text-white shadow-sm transition disabled:cursor-not-allowed"
              >
                {isSubmitting ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
