"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"

const editTeamSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters").max(100),
  ageGroup: z.string().min(1, "Select an age group"),
  gender: z.enum(["MALE", "FEMALE", "COED"]).optional(),
  season: z.string().optional(),
  description: z.string().optional(),
})

type EditTeamFormData = z.infer<typeof editTeamSchema>

const ageGroups = ["U6", "U8", "U10", "U12", "U14", "U16", "U18", "Adult"]

interface StaffMember {
  id: string
  role: string
  designation: string | null
  user: {
    id: string
    firstName: string | null
    lastName: string | null
    email: string
  }
}

interface TeamTryout {
  id: string
  title: string
  scheduledAt: string
  isPublished: boolean
  ageGroup: string
}

function getDesignationLabel(designation: string | null, role: string): string {
  if (designation === "HeadCoach") return "Head Coach"
  if (designation === "AssistantCoach") return "Assistant Coach"
  if (role === "TeamManager") return "Team Manager"
  return role
}

function getDesignationBadgeColor(designation: string | null, role: string): string {
  if (designation === "HeadCoach") return "bg-blue-100 text-blue-800"
  if (designation === "AssistantCoach") return "bg-indigo-100 text-indigo-800"
  if (role === "TeamManager") return "bg-green-100 text-green-800"
  return "bg-gray-100 text-gray-700"
}

export default function EditTeamPage() {
  const params = useParams()
  const clubId = params?.id as string
  const teamId = params?.teamId as string

  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [staffList, setStaffList] = useState<StaffMember[]>([])
  const [tryoutList, setTryoutList] = useState<TeamTryout[]>([])

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EditTeamFormData>({
    resolver: zodResolver(editTeamSchema),
  })

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/teams/${teamId}`)
        if (!res.ok) throw new Error("Failed to load team")
        const team = await res.json()
        reset({
          name: team.name,
          ageGroup: team.ageGroup,
          gender: team.gender || undefined,
          season: team.season || "",
          description: team.description || "",
        })
        setStaffList(team.staff || [])
        setTryoutList(team.tryouts || [])
      } catch {
        setError("Failed to load team")
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [teamId, reset])

  const onSubmit = async (data: EditTeamFormData) => {
    setIsSubmitting(true)
    setError(null)
    setSaved(false)

    try {
      const res = await fetch(`/api/teams/${teamId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          gender: data.gender || null,
          season: data.season || null,
          description: data.description || null,
        }),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || "Failed to update team")
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
        <p className="text-gray-500">Loading team...</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <Link
          href={`/clubs/${clubId}/teams`}
          className="mb-2 inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
        >
          &larr; Back to Teams
        </Link>
        <h2 className="text-xl font-bold text-gray-900">Edit Team</h2>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {saved && (
          <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">
            Team updated successfully.
          </div>
        )}

        <div className="rounded-lg bg-white p-8 shadow">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">Team Details</h3>

          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                Team Name <span className="text-red-500">*</span>
              </label>
              <input
                {...register("name")}
                type="text"
                id="name"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="ageGroup" className="block text-sm font-medium text-gray-700">
                Age Group <span className="text-red-500">*</span>
              </label>
              <select
                {...register("ageGroup")}
                id="ageGroup"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-green-500 focus:outline-none"
              >
                <option value="">Select age group</option>
                {ageGroups.map((age) => (
                  <option key={age} value={age}>
                    {age}
                  </option>
                ))}
              </select>
              {errors.ageGroup && (
                <p className="mt-1 text-sm text-red-600">{errors.ageGroup.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="gender" className="block text-sm font-medium text-gray-700">
                  Gender
                </label>
                <select
                  {...register("gender")}
                  id="gender"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-green-500 focus:outline-none"
                >
                  <option value="">Select gender</option>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="COED">Co-ed</option>
                </select>
              </div>

              <div>
                <label htmlFor="season" className="block text-sm font-medium text-gray-700">
                  Season
                </label>
                <input
                  {...register("season")}
                  type="text"
                  id="season"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-green-500 focus:outline-none"
                  placeholder="Spring 2026"
                />
              </div>
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                Description
              </label>
              <textarea
                {...register("description")}
                id="description"
                rows={3}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-green-500 focus:outline-none"
                placeholder="Team description..."
              />
            </div>
          </div>
        </div>

        <div className="flex gap-4">
          <Link
            href={`/clubs/${clubId}/teams`}
            className="rounded-md border border-gray-300 px-4 py-2 font-semibold text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 rounded-md bg-green-600 px-4 py-2 font-semibold text-white hover:bg-green-700 disabled:bg-gray-400"
          >
            {isSubmitting ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>

      {/* Staff Section */}
      <div className="mt-8 rounded-lg bg-white p-8 shadow">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">
          Staff ({staffList.length})
        </h3>
        {staffList.length === 0 ? (
          <p className="text-sm text-gray-500">
            No staff assigned to this team yet. Assign staff when{" "}
            <Link
              href={`/clubs/${clubId}/teams/create`}
              className="text-green-600 hover:text-green-700"
            >
              creating a team
            </Link>{" "}
            or from the{" "}
            <Link
              href={`/clubs/${clubId}/staff`}
              className="text-green-600 hover:text-green-700"
            >
              staff page
            </Link>
            .
          </p>
        ) : (
          <div className="space-y-3">
            {staffList.map((member) => {
              const name =
                [member.user.firstName, member.user.lastName]
                  .filter(Boolean)
                  .join(" ") || member.user.email

              return (
                <div
                  key={member.id}
                  className="flex items-center justify-between rounded-md border border-gray-200 p-3"
                >
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{name}</p>
                      <p className="text-xs text-gray-500">{member.user.email}</p>
                    </div>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${getDesignationBadgeColor(member.designation, member.role)}`}
                    >
                      {getDesignationLabel(member.designation, member.role)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Tryouts Section */}
      <div className="mt-6 rounded-lg bg-white p-8 shadow">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">
            Tryouts ({tryoutList.length})
          </h3>
          <Link
            href={`/clubs/${clubId}/tryouts/create`}
            className="text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            Create Tryout
          </Link>
        </div>
        {tryoutList.length === 0 ? (
          <p className="text-sm text-gray-500">
            No tryouts linked to this team yet. Link a tryout by selecting this team when creating or editing a tryout.
          </p>
        ) : (
          <div className="space-y-3">
            {tryoutList.map((tryout) => {
              const isPast = new Date(tryout.scheduledAt) < new Date()
              return (
                <Link
                  key={tryout.id}
                  href={`/clubs/${clubId}/tryouts/${tryout.id}/edit`}
                  className="flex items-center justify-between rounded-md border border-gray-200 p-3 transition hover:border-blue-300 hover:shadow-sm"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {tryout.title}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(tryout.scheduledAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}{" "}
                      &middot; {tryout.ageGroup}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      isPast
                        ? "bg-gray-100 text-gray-600"
                        : tryout.isPublished
                          ? "bg-green-100 text-green-700"
                          : "bg-yellow-100 text-yellow-700"
                    }`}
                  >
                    {isPast ? "Past" : tryout.isPublished ? "Published" : "Draft"}
                  </span>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
