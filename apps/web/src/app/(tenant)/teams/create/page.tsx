"use client"

import { Suspense } from "react"
import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { constants } from "@youthbasketballhub/config"

const createTeamSchema = z.object({
  name: z.string().min(3).max(100),
  ageGroup: z.string(),
  gender: z.enum(["MALE", "FEMALE", "COED"]).optional(),
  season: z.string().optional(),
  description: z.string().optional(),
})

type CreateTeamFormData = z.infer<typeof createTeamSchema>

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
    case "HeadCoach": return "Head Coach"
    case "AssistantCoach": return "Assistant Coach"
    case "TeamManager": return "Team Manager"
  }
}

function getStaffRoleBadgeColor(staffRole: StaffRoleType): string {
  switch (staffRole) {
    case "HeadCoach": return "bg-orange-100 text-orange-800"
    case "AssistantCoach": return "bg-indigo-100 text-indigo-800"
    case "TeamManager": return "bg-green-100 text-green-800"
  }
}

function CreateTeamForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tenantId = searchParams?.get("tenantId") ?? null

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Staff assignment state
  const [availableStaff, setAvailableStaff] = useState<AvailableStaff[]>([])
  const [loadingStaff, setLoadingStaff] = useState(true)
  const [staffAssignments, setStaffAssignments] = useState<StaffAssignment[]>([])
  const [staffInvites, setStaffInvites] = useState<StaffInvite[]>([])
  const [selectedStaffId, setSelectedStaffId] = useState("")
  const [selectedStaffRole, setSelectedStaffRole] = useState<StaffRoleType>("AssistantCoach")
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState<StaffRoleType>("AssistantCoach")

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateTeamFormData>({
    resolver: zodResolver(createTeamSchema),
  })

  useEffect(() => {
    if (!tenantId) return
    async function fetchStaff() {
      try {
        const res = await fetch(`/api/clubs/${tenantId}/staff/available`)
        if (res.ok) {
          const data = await res.json()
          setAvailableStaff(data.staff || [])
        }
      } catch {
        // Staff section won't show
      } finally {
        setLoadingStaff(false)
      }
    }
    fetchStaff()
  }, [tenantId])

  const hasHeadCoach =
    staffAssignments.some((s) => s.staffRole === "HeadCoach") ||
    staffInvites.some((s) => s.staffRole === "HeadCoach")

  const handleAddStaff = () => {
    if (!selectedStaffId) return
    const staff = availableStaff.find((s) => s.userId === selectedStaffId)
    if (!staff) return
    if (staffAssignments.some((s) => s.userId === selectedStaffId)) {
      setError("This staff member is already assigned")
      return
    }
    if (selectedStaffRole === "HeadCoach" && hasHeadCoach) {
      setError("Only one Head Coach is allowed per team")
      return
    }
    setError(null)
    const name = [staff.firstName, staff.lastName].filter(Boolean).join(" ") || staff.email
    setStaffAssignments((prev) => [
      ...prev,
      { type: "assign", userId: staff.userId, name, email: staff.email, staffRole: selectedStaffRole },
    ])
    setSelectedStaffId("")
  }

  const handleAddInvite = () => {
    const email = inviteEmail.trim().toLowerCase()
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address")
      return
    }
    if (staffInvites.some((s) => s.email === email) || staffAssignments.some((s) => s.email === email)) {
      setError("This email is already added")
      return
    }
    if (inviteRole === "HeadCoach" && hasHeadCoach) {
      setError("Only one Head Coach is allowed per team")
      return
    }
    setError(null)
    setStaffInvites((prev) => [...prev, { type: "invite", email, staffRole: inviteRole }])
    setInviteEmail("")
  }

  const onSubmit = async (data: CreateTeamFormData) => {
    if (!tenantId) {
      setError("Tenant ID is required")
      return
    }
    setIsSubmitting(true)
    setError(null)

    const staff = [
      ...staffAssignments.map((s) => ({
        type: "assign" as const,
        userId: s.userId,
        role: s.staffRole === "TeamManager" ? "TeamManager" as const : "Staff" as const,
        designation: s.staffRole === "HeadCoach" ? "HeadCoach" as const : s.staffRole === "AssistantCoach" ? "AssistantCoach" as const : null,
      })),
      ...staffInvites.map((s) => ({
        type: "invite" as const,
        email: s.email,
        role: s.staffRole === "TeamManager" ? "TeamManager" as const : "Staff" as const,
        designation: s.staffRole === "HeadCoach" ? "HeadCoach" as const : s.staffRole === "AssistantCoach" ? "AssistantCoach" as const : null,
      })),
    ]

    try {
      const response = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, tenantId, staff }),
      })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to create team")
      }
      router.push(`/teams?tenantId=${tenantId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
      setIsSubmitting(false)
    }
  }

  const unassignedStaff = availableStaff.filter(
    (s) => !staffAssignments.some((a) => a.userId === s.userId)
  )

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto max-w-2xl px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Create New Team</h1>
          <p className="mt-2 text-gray-600">Add a team to your club and assign coaching staff</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              {error}
            </div>
          )}

          {/* Team Details */}
          <div className="rounded-lg bg-white p-8 shadow-lg">
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
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                  placeholder="Warriors U12"
                />
                {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>}
              </div>

              <div>
                <label htmlFor="ageGroup" className="block text-sm font-medium text-gray-700">
                  Age Group <span className="text-red-500">*</span>
                </label>
                <select
                  {...register("ageGroup")}
                  id="ageGroup"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-orange-500 focus:outline-none"
                >
                  <option value="">Select age group</option>
                  {constants.ageGroups.map((age) => (
                    <option key={age} value={age}>{age}</option>
                  ))}
                </select>
                {errors.ageGroup && (
                  <p className="mt-1 text-sm text-red-600">{errors.ageGroup.message}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="gender" className="block text-sm font-medium text-gray-700">Gender</label>
                  <select
                    {...register("gender")}
                    id="gender"
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-orange-500 focus:outline-none"
                  >
                    <option value="">Select gender</option>
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="COED">Co-ed</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="season" className="block text-sm font-medium text-gray-700">Season</label>
                  <input
                    {...register("season")}
                    type="text"
                    id="season"
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-orange-500 focus:outline-none"
                    placeholder="Spring 2026"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700">Description</label>
                <textarea
                  {...register("description")}
                  id="description"
                  rows={3}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-orange-500 focus:outline-none"
                  placeholder="Team description..."
                />
              </div>
            </div>
          </div>

          {/* Staff Assignment */}
          <div className="rounded-lg bg-white p-8 shadow-lg">
            <h3 className="mb-1 text-lg font-semibold text-gray-900">Staff Assignment</h3>
            <p className="mb-4 text-sm text-gray-600">
              Assign coaches and team managers. You can also invite people by email.
            </p>

            {(staffAssignments.length > 0 || staffInvites.length > 0) && (
              <div className="mb-6 space-y-2">
                {staffAssignments.map((s) => (
                  <div key={s.userId} className="flex items-center justify-between rounded-md border border-gray-200 px-3 py-2">
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{s.name}</p>
                        <p className="text-xs text-gray-500">{s.email}</p>
                      </div>
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${getStaffRoleBadgeColor(s.staffRole)}`}>
                        {getStaffRoleLabel(s.staffRole)}
                      </span>
                    </div>
                    <button type="button" onClick={() => setStaffAssignments((p) => p.filter((x) => x.userId !== s.userId))} className="text-gray-400 hover:text-red-500">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
                {staffInvites.map((s) => (
                  <div key={s.email} className="flex items-center justify-between rounded-md border border-dashed border-gray-300 bg-gray-50 px-3 py-2">
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{s.email}</p>
                        <p className="text-xs text-amber-600">Pending invite</p>
                      </div>
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${getStaffRoleBadgeColor(s.staffRole)}`}>
                        {getStaffRoleLabel(s.staffRole)}
                      </span>
                    </div>
                    <button type="button" onClick={() => setStaffInvites((p) => p.filter((x) => x.email !== s.email))} className="text-gray-400 hover:text-red-500">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="mb-4">
              <label className="mb-1 block text-sm font-medium text-gray-700">Add Existing Staff</label>
              {loadingStaff ? (
                <p className="text-sm text-gray-500">Loading staff...</p>
              ) : unassignedStaff.length === 0 ? (
                <p className="text-sm text-gray-500">No available staff. Use the invite section below.</p>
              ) : (
                <div className="flex gap-2">
                  <select value={selectedStaffId} onChange={(e) => setSelectedStaffId(e.target.value)} className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none">
                    <option value="">Select a staff member</option>
                    {unassignedStaff.map((s) => {
                      const name = [s.firstName, s.lastName].filter(Boolean).join(" ") || s.email
                      const currentRoles = s.roles.filter((r) => !r.teamId).map((r) => r.role).join(", ")
                      return <option key={s.userId} value={s.userId}>{name} ({currentRoles})</option>
                    })}
                  </select>
                  <select value={selectedStaffRole} onChange={(e) => setSelectedStaffRole(e.target.value as StaffRoleType)} className="w-40 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none">
                    <option value="HeadCoach" disabled={hasHeadCoach}>Head Coach</option>
                    <option value="AssistantCoach">Assistant Coach</option>
                    <option value="TeamManager">Team Manager</option>
                  </select>
                  <button type="button" onClick={handleAddStaff} disabled={!selectedStaffId} className="rounded-md bg-orange-500 px-3 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:bg-gray-300">Add</button>
                </div>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Invite by Email</label>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="staff@example.com"
                  className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddInvite() } }}
                />
                <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as StaffRoleType)} className="w-40 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none">
                  <option value="HeadCoach" disabled={hasHeadCoach}>Head Coach</option>
                  <option value="AssistantCoach">Assistant Coach</option>
                  <option value="TeamManager">Team Manager</option>
                </select>
                <button type="button" onClick={handleAddInvite} disabled={!inviteEmail.trim()} className="rounded-md border border-orange-500 px-3 py-2 text-sm font-medium text-orange-600 hover:bg-orange-50 disabled:border-gray-300 disabled:text-gray-300">Invite</button>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                The invited person will receive a notification and be assigned once they accept.
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 rounded-md bg-orange-500 px-4 py-2 text-white font-semibold hover:bg-orange-600 disabled:bg-gray-400"
            >
              {isSubmitting ? "Creating..." : "Create Team"}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="rounded-md border border-gray-300 px-4 py-2 font-semibold text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function CreateTeamPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading...</div>}>
      <CreateTeamForm />
    </Suspense>
  )
}
