"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"

const editTryoutSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").max(200),
  description: z.string().optional(),
  ageGroup: z.string().min(1, "Select an age group"),
  gender: z.enum(["MALE", "FEMALE", "COED"]).optional(),
  location: z.string().min(3, "Enter a location"),
  scheduledAt: z.string().min(1, "Select a date and time"),
  duration: z.coerce.number().min(1).optional(),
  fee: z.coerce.number().min(0, "Fee must be 0 or more"),
  maxParticipants: z.coerce.number().min(1).optional(),
  isPublic: z.boolean().default(true),
})

type EditTryoutFormData = z.infer<typeof editTryoutSchema>

const ageGroups = ["U6", "U8", "U10", "U12", "U14", "U16", "U18", "Adult"]

function toLocalDatetimeValue(isoString: string): string {
  const date = new Date(isoString)
  const offset = date.getTimezoneOffset()
  const local = new Date(date.getTime() - offset * 60000)
  return local.toISOString().slice(0, 16)
}

export default function EditTryoutPage() {
  const params = useParams()
  const clubId = params.id as string
  const tryoutId = params.tryoutId as string

  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EditTryoutFormData>({
    resolver: zodResolver(editTryoutSchema),
  })

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/tryouts/${tryoutId}`)
        if (!res.ok) throw new Error("Failed to load tryout")
        const tryout = await res.json()
        reset({
          title: tryout.title,
          description: tryout.description || "",
          ageGroup: tryout.ageGroup,
          gender: tryout.gender || undefined,
          location: tryout.location,
          scheduledAt: toLocalDatetimeValue(tryout.scheduledAt),
          duration: tryout.duration || undefined,
          fee: Number(tryout.fee),
          maxParticipants: tryout.maxParticipants || undefined,
          isPublic: tryout.isPublic,
        })
      } catch {
        setError("Failed to load tryout")
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [tryoutId, reset])

  const onSubmit = async (data: EditTryoutFormData) => {
    setIsSubmitting(true)
    setError(null)
    setSaved(false)

    try {
      const res = await fetch(`/api/tryouts/${tryoutId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: data.title,
          description: data.description || null,
          ageGroup: data.ageGroup,
          gender: data.gender || null,
          location: data.location,
          scheduledAt: new Date(data.scheduledAt).toISOString(),
          duration: data.duration || null,
          fee: data.fee,
          maxParticipants: data.maxParticipants || null,
          isPublic: data.isPublic,
        }),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || "Failed to update tryout")
      }

      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-gray-500">Loading tryout...</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <Link
          href={`/clubs/${clubId}/tryouts`}
          className="mb-2 inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
        >
          &larr; Back to Tryouts
        </Link>
        <h2 className="text-xl font-bold text-gray-900">Edit Tryout</h2>
      </div>

      <div className="rounded-lg bg-white p-8 shadow">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}
          {saved && (
            <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">
              Tryout updated successfully.
            </div>
          )}

          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              {...register("title")}
              type="text"
              id="title"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {errors.title && (
              <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700">
              Description
            </label>
            <textarea
              {...register("description")}
              id="description"
              rows={3}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="ageGroup" className="block text-sm font-medium text-gray-700">
                Age Group <span className="text-red-500">*</span>
              </label>
              <select
                {...register("ageGroup")}
                id="ageGroup"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
              >
                <option value="">Select age group</option>
                {ageGroups.map((age) => (
                  <option key={age} value={age}>{age}</option>
                ))}
              </select>
              {errors.ageGroup && (
                <p className="mt-1 text-sm text-red-600">{errors.ageGroup.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="gender" className="block text-sm font-medium text-gray-700">
                Gender
              </label>
              <select
                {...register("gender")}
                id="gender"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
              >
                <option value="">Any</option>
                <option value="MALE">Boys</option>
                <option value="FEMALE">Girls</option>
                <option value="COED">Co-ed</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="location" className="block text-sm font-medium text-gray-700">
              Location <span className="text-red-500">*</span>
            </label>
            <input
              {...register("location")}
              type="text"
              id="location"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {errors.location && (
              <p className="mt-1 text-sm text-red-600">{errors.location.message}</p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="scheduledAt" className="block text-sm font-medium text-gray-700">
                Date & Time <span className="text-red-500">*</span>
              </label>
              <input
                {...register("scheduledAt")}
                type="datetime-local"
                id="scheduledAt"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
              />
              {errors.scheduledAt && (
                <p className="mt-1 text-sm text-red-600">{errors.scheduledAt.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="duration" className="block text-sm font-medium text-gray-700">
                Duration (minutes)
              </label>
              <input
                {...register("duration")}
                type="number"
                id="duration"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="fee" className="block text-sm font-medium text-gray-700">
                Fee ($) <span className="text-red-500">*</span>
              </label>
              <input
                {...register("fee")}
                type="number"
                id="fee"
                min="0"
                step="0.01"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
              />
              {errors.fee && (
                <p className="mt-1 text-sm text-red-600">{errors.fee.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="maxParticipants" className="block text-sm font-medium text-gray-700">
                Max Participants
              </label>
              <input
                {...register("maxParticipants")}
                type="number"
                id="maxParticipants"
                min="1"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              {...register("isPublic")}
              type="checkbox"
              id="isPublic"
              className="h-4 w-4 rounded border-gray-300 text-blue-600"
            />
            <label htmlFor="isPublic" className="text-sm text-gray-700">
              Public tryout (visible on marketplace when published)
            </label>
          </div>

          <div className="flex gap-4">
            <Link
              href={`/clubs/${clubId}/tryouts`}
              className="rounded-md border border-gray-300 px-4 py-2 font-semibold text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 rounded-md bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 disabled:bg-gray-400"
            >
              {isSubmitting ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
