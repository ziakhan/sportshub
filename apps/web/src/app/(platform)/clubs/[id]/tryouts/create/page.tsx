"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"

const createTryoutSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").max(200),
  description: z.string().optional(),
  location: z.string().min(3, "Enter a location"),
  scheduledAt: z.string().min(1, "Select a date and time"),
  duration: z.coerce.number().min(1).optional(),
  fee: z.coerce.number().min(0, "Fee must be 0 or more"),
  maxParticipants: z.coerce.number().min(1).optional(),
  isPublic: z.boolean().default(true),
})

type CreateTryoutFormData = z.infer<typeof createTryoutSchema>

interface Team {
  id: string
  name: string
  ageGroup: string
  gender: string | null
}

export default function CreateTryoutPage() {
  const params = useParams()
  const clubId = params?.id as string

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdTryout, setCreatedTryout] = useState<{ title: string } | null>(null)
  const [teams, setTeams] = useState<Team[]>([])
  const [selectedTeamId, setSelectedTeamId] = useState("")
  const [loadingTeams, setLoadingTeams] = useState(true)

  const selectedTeam = teams.find((t) => t.id === selectedTeamId)

  useEffect(() => {
    async function fetchTeams() {
      try {
        const res = await fetch(`/api/teams?tenantId=${clubId}`)
        if (res.ok) {
          const data = await res.json()
          setTeams(data.teams || [])
        }
      } catch {
        // silently fail
      } finally {
        setLoadingTeams(false)
      }
    }
    fetchTeams()
  }, [clubId])

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateTryoutFormData>({
    resolver: zodResolver(createTryoutSchema),
    defaultValues: {
      fee: 0,
      isPublic: true,
    },
  })

  const onSubmit = async (data: CreateTryoutFormData) => {
    if (!selectedTeamId) {
      setError("Please select a team")
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const payload: Record<string, unknown> = {
        title: data.title,
        description: data.description || undefined,
        ageGroup: selectedTeam?.ageGroup,
        location: data.location,
        scheduledAt: new Date(data.scheduledAt).toISOString(),
        fee: data.fee,
        isPublic: data.isPublic,
        tenantId: clubId,
        teamId: selectedTeamId,
      }
      if (selectedTeam?.gender) payload.gender = selectedTeam.gender
      if (data.duration) payload.duration = data.duration
      if (data.maxParticipants) payload.maxParticipants = data.maxParticipants

      const res = await fetch("/api/tryouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        let errorMsg = "Failed to create tryout"
        try {
          const errorData = await res.json()
          errorMsg = errorData.error || errorMsg
        } catch {
          // Response wasn't JSON
        }
        throw new Error(errorMsg)
      }

      setCreatedTryout({ title: data.title })
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
      setIsSubmitting(false)
    }
  }

  if (createdTryout) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="rounded-lg bg-white p-8 shadow text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
            <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="mb-2 text-xl font-bold text-gray-900">Tryout Created!</h2>
          <p className="mb-1 text-gray-600">
            <span className="font-semibold">{createdTryout.title}</span> has been created as a draft.
          </p>
          <p className="mb-6 text-sm text-gray-500">
            You can publish it to the marketplace from the tryouts list.
          </p>
          <div className="flex gap-3">
            <Link
              href={`/clubs/${clubId}/tryouts`}
              className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-center font-semibold text-white hover:bg-blue-700"
            >
              View Tryouts
            </Link>
            <button
              onClick={() => {
                setCreatedTryout(null)
                setError(null)
                setIsSubmitting(false)
                setSelectedTeamId("")
                reset()
              }}
              className="flex-1 rounded-md border border-gray-300 px-4 py-2 font-semibold text-gray-700 hover:bg-gray-50"
            >
              Create Another Tryout
            </button>
          </div>
        </div>
      </div>
    )
  }

  const genderLabel = (g: string | null) => {
    if (g === "MALE") return "Boys"
    if (g === "FEMALE") return "Girls"
    if (g === "COED") return "Co-ed"
    return "Any"
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
        <h2 className="text-xl font-bold text-gray-900">Create Tryout</h2>
        <p className="mt-1 text-sm text-gray-600">
          Set up a tryout for your club. You can publish it to the marketplace
          after creation.
        </p>
      </div>

      <div className="rounded-lg bg-white p-8 shadow">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Team Selection (mandatory) */}
          <div>
            <label htmlFor="teamId" className="block text-sm font-medium text-gray-700">
              Team <span className="text-red-500">*</span>
            </label>
            {loadingTeams ? (
              <p className="mt-1 text-sm text-gray-500">Loading teams...</p>
            ) : teams.length === 0 ? (
              <div className="mt-1 rounded-md border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-700">
                No teams found. <Link href={`/clubs/${clubId}/teams/create`} className="font-medium underline">Create a team</Link> first.
              </div>
            ) : (
              <select
                id="teamId"
                value={selectedTeamId}
                onChange={(e) => setSelectedTeamId(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
              >
                <option value="">Select a team</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name} ({team.ageGroup}{team.gender ? ` / ${genderLabel(team.gender)}` : ""})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Show age group & gender from team */}
          {selectedTeam && (
            <div className="flex gap-4">
              <div className="rounded-md bg-blue-50 px-3 py-2 text-sm">
                <span className="text-blue-600">Age Group:</span>{" "}
                <span className="font-medium text-blue-900">{selectedTeam.ageGroup}</span>
              </div>
              <div className="rounded-md bg-blue-50 px-3 py-2 text-sm">
                <span className="text-blue-600">Gender:</span>{" "}
                <span className="font-medium text-blue-900">{genderLabel(selectedTeam.gender)}</span>
              </div>
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
              placeholder="Spring 2026 U12 Boys Tryout"
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
              placeholder="What to expect, what to bring..."
            />
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
              placeholder="Main Gym, 123 Court Ave"
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
                placeholder="90"
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
                placeholder="0.00"
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
                placeholder="No limit"
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

          <p className="text-xs text-gray-500">
            Tryouts are saved as drafts. You can publish them to the marketplace
            from the tryouts list.
          </p>

          <div className="flex gap-4">
            <Link
              href={`/clubs/${clubId}/tryouts`}
              className="rounded-md border border-gray-300 px-4 py-2 font-semibold text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isSubmitting || !selectedTeamId}
              className="flex-1 rounded-md bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 disabled:bg-gray-400"
            >
              {isSubmitting ? "Creating..." : "Create Tryout"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
