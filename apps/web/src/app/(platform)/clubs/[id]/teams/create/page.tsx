"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"

const createTeamSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters").max(100),
  ageGroup: z.string().min(1, "Select an age group"),
  gender: z.enum(["MALE", "FEMALE", "COED"]).optional(),
  season: z.string().optional(),
  description: z.string().optional(),
})

type CreateTeamFormData = z.infer<typeof createTeamSchema>

const ageGroups = [
  "U5",
  "U6",
  "U7",
  "U8",
  "U9",
  "U10",
  "U11",
  "U12",
  "U13",
  "U14",
  "U15",
  "U16",
  "U17",
  "U18",
  "Adult",
]

type StaffRoleType = "HeadCoach" | "AssistantCoach" | "TeamManager"

interface StaffAssignment {
  type: "assign"
  userId: string
  name: string
  email: string
  staffRole: StaffRoleType
}

interface StaffInvite {
  type: "invite"
  email: string
  staffRole: StaffRoleType
}

interface AvailableStaff {
  userId: string
  firstName: string | null
  lastName: string | null
  email: string
  roles: Array<{
    role: string
    teamId: string | null
    teamName: string | null
    designation: string | null
  }>
}

function getStaffRoleLabel(staffRole: StaffRoleType): string {
  switch (staffRole) {
    case "HeadCoach":
      return "Head Coach"
    case "AssistantCoach":
      return "Assistant Coach"
    case "TeamManager":
      return "Team Manager"
  }
}

function getStaffRoleBadgeColor(staffRole: StaffRoleType): string {
  switch (staffRole) {
    case "HeadCoach":
      return "bg-play-100 text-play-700"
    case "AssistantCoach":
      return "bg-court-100 text-court-700"
    case "TeamManager":
      return "bg-play-100 text-play-700"
  }
}

export default function CreateTeamPage() {
  const router = useRouter()
  const params = useParams()
  const clubId = params?.id as string

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdTeam, setCreatedTeam] = useState<{
    name: string
    ageGroup: string
    staffCount: number
  } | null>(null)

  // Staff assignment state
  const [availableStaff, setAvailableStaff] = useState<AvailableStaff[]>([])
  const [loadingStaff, setLoadingStaff] = useState(true)
  const [staffAssignments, setStaffAssignments] = useState<StaffAssignment[]>([])
  const [staffInvites, setStaffInvites] = useState<StaffInvite[]>([])

  // Add staff form state
  const [selectedStaffId, setSelectedStaffId] = useState("")
  const [selectedStaffRole, setSelectedStaffRole] = useState<StaffRoleType>("AssistantCoach")

  // Invite form state
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState<StaffRoleType>("AssistantCoach")

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateTeamFormData>({
    resolver: zodResolver(createTeamSchema),
  })

  // Fetch available staff on mount
  useEffect(() => {
    async function fetchStaff() {
      try {
        const res = await fetch(`/api/clubs/${clubId}/staff/available`)
        if (res.ok) {
          const data = await res.json()
          setAvailableStaff(data.staff || [])
        }
      } catch {
        // Silently fail — staff section just won't show existing staff
      } finally {
        setLoadingStaff(false)
      }
    }
    fetchStaff()
  }, [clubId])

  const hasHeadCoach =
    staffAssignments.some((s) => s.staffRole === "HeadCoach") ||
    staffInvites.some((s) => s.staffRole === "HeadCoach")

  const handleAddStaff = () => {
    if (!selectedStaffId) return

    const staff = availableStaff.find((s) => s.userId === selectedStaffId)
    if (!staff) return

    // Check if already assigned
    if (staffAssignments.some((s) => s.userId === selectedStaffId)) {
      setError("This staff member is already assigned")
      return
    }

    // Check head coach limit
    if (selectedStaffRole === "HeadCoach" && hasHeadCoach) {
      setError("Only one Head Coach is allowed per team")
      return
    }

    setError(null)
    const name = [staff.firstName, staff.lastName].filter(Boolean).join(" ") || staff.email

    setStaffAssignments((prev) => [
      ...prev,
      {
        type: "assign",
        userId: staff.userId,
        name,
        email: staff.email,
        staffRole: selectedStaffRole,
      },
    ])
    setSelectedStaffId("")
  }

  const handleAddInvite = () => {
    const email = inviteEmail.trim().toLowerCase()
    if (!email) return

    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address")
      return
    }

    // Check duplicates
    if (staffInvites.some((s) => s.email === email)) {
      setError("This email is already in the invite list")
      return
    }
    if (staffAssignments.some((s) => s.email === email)) {
      setError("This person is already assigned as staff")
      return
    }

    // Check head coach limit
    if (inviteRole === "HeadCoach" && hasHeadCoach) {
      setError("Only one Head Coach is allowed per team")
      return
    }

    setError(null)
    setStaffInvites((prev) => [...prev, { type: "invite", email, staffRole: inviteRole }])
    setInviteEmail("")
  }

  const removeAssignment = (userId: string) => {
    setStaffAssignments((prev) => prev.filter((s) => s.userId !== userId))
  }

  const removeInvite = (email: string) => {
    setStaffInvites((prev) => prev.filter((s) => s.email !== email))
  }

  const onSubmit = async (data: CreateTeamFormData) => {
    setIsSubmitting(true)
    setError(null)

    // Build staff array for API
    const staff = [
      ...staffAssignments.map((s) => ({
        type: "assign" as const,
        userId: s.userId,
        role: s.staffRole === "TeamManager" ? ("TeamManager" as const) : ("Staff" as const),
        designation:
          s.staffRole === "HeadCoach"
            ? ("HeadCoach" as const)
            : s.staffRole === "AssistantCoach"
              ? ("AssistantCoach" as const)
              : null,
      })),
      ...staffInvites.map((s) => ({
        type: "invite" as const,
        email: s.email,
        role: s.staffRole === "TeamManager" ? ("TeamManager" as const) : ("Staff" as const),
        designation:
          s.staffRole === "HeadCoach"
            ? ("HeadCoach" as const)
            : s.staffRole === "AssistantCoach"
              ? ("AssistantCoach" as const)
              : null,
      })),
    ]

    try {
      const payload: Record<string, unknown> = {
        name: data.name,
        ageGroup: data.ageGroup,
        tenantId: clubId,
        season: data.season || undefined,
        description: data.description || undefined,
      }
      if (data.gender) payload.gender = data.gender
      if (staff.length > 0) payload.staff = staff

      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        let errorMsg = "Failed to create team"
        try {
          const errorData = await res.json()
          errorMsg = errorData.error || errorMsg
        } catch {
          // Response wasn't JSON
        }
        throw new Error(errorMsg)
      }

      setCreatedTeam({
        name: data.name,
        ageGroup: data.ageGroup,
        staffCount: staffAssignments.length + staffInvites.length,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
      setIsSubmitting(false)
    }
  }

  // Filter out already-assigned staff from the dropdown
  const unassignedStaff = availableStaff.filter(
    (s) => !staffAssignments.some((a) => a.userId === s.userId)
  )

  if (createdTeam) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="border-ink-100 shadow-soft rounded-2xl border bg-white p-8 text-center">
          <div className="bg-court-100 mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full">
            <svg
              className="text-court-600 h-6 w-6"
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
          <h2 className="text-ink-900 mb-2 text-xl font-bold">Team Created!</h2>
          <p className="text-ink-600 mb-1">
            <span className="font-semibold">{createdTeam.name}</span> ({createdTeam.ageGroup}) has
            been created.
          </p>
          {createdTeam.staffCount > 0 && (
            <p className="text-ink-500 mb-6 text-sm">
              {createdTeam.staffCount} staff member{createdTeam.staffCount > 1 ? "s" : ""}{" "}
              assigned/invited.
            </p>
          )}
          {createdTeam.staffCount === 0 && <div className="mb-6" />}
          <div className="flex gap-3">
            <Link
              href={`/clubs/${clubId}/teams`}
              className="bg-play-600 hover:bg-play-700 flex-1 rounded-xl px-4 py-2 text-center font-semibold text-white"
            >
              View Teams
            </Link>
            <button
              onClick={() => {
                setCreatedTeam(null)
                setStaffAssignments([])
                setStaffInvites([])
                setError(null)
                setIsSubmitting(false)
              }}
              className="border-ink-200 text-ink-700 hover:bg-court-50 flex-1 rounded-xl border px-4 py-2 font-semibold"
            >
              Create Another Team
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <Link
          href={`/clubs/${clubId}/teams`}
          className="text-ink-500 hover:text-ink-700 mb-2 inline-flex items-center text-sm"
        >
          &larr; Back to Teams
        </Link>
        <h2 className="text-ink-900 text-xl font-bold">Create New Team</h2>
        <p className="text-ink-600 mt-1 text-sm">
          Add a team to your club and assign coaching staff
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {error && (
          <div className="border-hoop-200 bg-hoop-50 text-hoop-700 rounded-xl border p-3 text-sm">
            {error}
          </div>
        )}

        {/* Team Details Card */}
        <div className="border-ink-100 shadow-soft rounded-2xl border bg-white p-8">
          <h3 className="text-ink-900 mb-4 text-lg font-semibold">Team Details</h3>

          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="text-ink-700 block text-sm font-medium">
                Team Name <span className="text-red-500">*</span>
              </label>
              <input
                {...register("name")}
                type="text"
                id="name"
                className="border-ink-200 focus:border-play-500 focus:ring-play-500 mt-1 block w-full rounded-xl border px-3 py-2 focus:outline-none focus:ring-1"
                placeholder="Warriors U12"
              />
              {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>}
            </div>

            <div>
              <label htmlFor="ageGroup" className="text-ink-700 block text-sm font-medium">
                Age Group <span className="text-red-500">*</span>
              </label>
              <select
                {...register("ageGroup")}
                id="ageGroup"
                className="border-ink-200 focus:border-play-500 mt-1 block w-full rounded-xl border px-3 py-2 focus:outline-none"
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
                <label htmlFor="gender" className="text-ink-700 block text-sm font-medium">
                  Gender
                </label>
                <select
                  {...register("gender")}
                  id="gender"
                  className="border-ink-200 focus:border-play-500 mt-1 block w-full rounded-xl border px-3 py-2 focus:outline-none"
                >
                  <option value="">Select gender</option>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="COED">Co-ed</option>
                </select>
              </div>

              <div>
                <label htmlFor="season" className="text-ink-700 block text-sm font-medium">
                  Season
                </label>
                <input
                  {...register("season")}
                  type="text"
                  id="season"
                  className="border-ink-200 focus:border-play-500 mt-1 block w-full rounded-xl border px-3 py-2 focus:outline-none"
                  placeholder="Spring 2026"
                />
              </div>
            </div>

            <div>
              <label htmlFor="description" className="text-ink-700 block text-sm font-medium">
                Description
              </label>
              <textarea
                {...register("description")}
                id="description"
                rows={3}
                className="border-ink-200 focus:border-play-500 mt-1 block w-full rounded-xl border px-3 py-2 focus:outline-none"
                placeholder="Team description..."
              />
            </div>
          </div>
        </div>

        {/* Staff Assignment Card */}
        <div className="border-ink-100 shadow-soft rounded-2xl border bg-white p-8">
          <h3 className="text-ink-900 mb-1 text-lg font-semibold">Staff Assignment</h3>
          <p className="text-ink-600 mb-4 text-sm">
            Assign coaches and team managers. You can also invite people by email.
          </p>

          {/* Current assignments list */}
          {(staffAssignments.length > 0 || staffInvites.length > 0) && (
            <div className="mb-6 space-y-2">
              {staffAssignments.map((s) => (
                <div
                  key={s.userId}
                  className="border-ink-200 flex items-center justify-between rounded-xl border px-3 py-2"
                >
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="text-ink-900 text-sm font-medium">{s.name}</p>
                      <p className="text-ink-500 text-xs">{s.email}</p>
                    </div>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${getStaffRoleBadgeColor(s.staffRole)}`}
                    >
                      {getStaffRoleLabel(s.staffRole)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeAssignment(s.userId)}
                    className="text-ink-400 hover:text-hoop-600"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              ))}
              {staffInvites.map((s) => (
                <div
                  key={s.email}
                  className="border-ink-200 bg-court-50 flex items-center justify-between rounded-xl border border-dashed px-3 py-2"
                >
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="text-ink-900 text-sm font-medium">{s.email}</p>
                      <p className="text-xs text-amber-600">Pending invite</p>
                    </div>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${getStaffRoleBadgeColor(s.staffRole)}`}
                    >
                      {getStaffRoleLabel(s.staffRole)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeInvite(s.email)}
                    className="text-ink-400 hover:text-hoop-600"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add existing staff */}
          <div className="mb-4">
            <label className="text-ink-700 mb-1 block text-sm font-medium">
              Add Existing Staff
            </label>
            {loadingStaff ? (
              <p className="text-ink-500 text-sm">Loading staff...</p>
            ) : unassignedStaff.length === 0 ? (
              <p className="text-ink-500 text-sm">
                No available staff. Use the invite section below to add new staff.
              </p>
            ) : (
              <div className="flex gap-2">
                <select
                  value={selectedStaffId}
                  onChange={(e) => setSelectedStaffId(e.target.value)}
                  className="border-ink-200 focus:border-play-500 flex-1 rounded-xl border px-3 py-2 text-sm focus:outline-none"
                >
                  <option value="">Select a staff member</option>
                  {unassignedStaff.map((s) => {
                    const name = [s.firstName, s.lastName].filter(Boolean).join(" ") || s.email
                    const currentRoles = s.roles
                      .filter((r) => !r.teamId)
                      .map((r) => r.role)
                      .join(", ")
                    return (
                      <option key={s.userId} value={s.userId}>
                        {name} ({currentRoles})
                      </option>
                    )
                  })}
                </select>
                <select
                  value={selectedStaffRole}
                  onChange={(e) => setSelectedStaffRole(e.target.value as StaffRoleType)}
                  className="border-ink-200 focus:border-play-500 w-40 rounded-xl border px-3 py-2 text-sm focus:outline-none"
                >
                  <option value="HeadCoach" disabled={hasHeadCoach}>
                    Head Coach
                  </option>
                  <option value="AssistantCoach">Assistant Coach</option>
                  <option value="TeamManager">Team Manager</option>
                </select>
                <button
                  type="button"
                  onClick={handleAddStaff}
                  disabled={!selectedStaffId}
                  className="bg-play-600 hover:bg-play-700 disabled:bg-court-300 rounded-xl px-3 py-2 text-sm font-medium text-white"
                >
                  Add
                </button>
              </div>
            )}
          </div>

          {/* Invite by email */}
          <div>
            <label className="text-ink-700 mb-1 block text-sm font-medium">Invite by Email</label>
            <div className="flex gap-2">
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="staff@example.com"
                className="border-ink-200 focus:border-play-500 flex-1 rounded-xl border px-3 py-2 text-sm focus:outline-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    handleAddInvite()
                  }
                }}
              />
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as StaffRoleType)}
                className="border-ink-200 focus:border-play-500 w-40 rounded-xl border px-3 py-2 text-sm focus:outline-none"
              >
                <option value="HeadCoach" disabled={hasHeadCoach}>
                  Head Coach
                </option>
                <option value="AssistantCoach">Assistant Coach</option>
                <option value="TeamManager">Team Manager</option>
              </select>
              <button
                type="button"
                onClick={handleAddInvite}
                disabled={!inviteEmail.trim()}
                className="disabled:border-ink-200 disabled:text-ink-300 border-play-600 text-play-600 hover:bg-play-50 rounded-xl border px-3 py-2 text-sm font-medium"
              >
                Invite
              </button>
            </div>
            <p className="text-ink-500 mt-1 text-xs">
              The invited person will receive a notification and be assigned to this team once they
              accept.
            </p>
          </div>
        </div>

        {/* Submit buttons */}
        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="border-ink-200 text-ink-700 hover:bg-court-50 rounded-xl border px-4 py-2 font-semibold"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-play-600 hover:bg-play-700 disabled:bg-court-300 flex-1 rounded-xl px-4 py-2 font-semibold text-white"
          >
            {isSubmitting ? "Creating..." : "Create Team"}
          </button>
        </div>
      </form>
    </div>
  )
}
