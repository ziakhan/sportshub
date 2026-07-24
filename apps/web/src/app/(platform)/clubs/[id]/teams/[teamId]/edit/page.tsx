"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Badge, Button, Card, PanelHeader, toneForStatus, type BadgeTone } from "@/components/ui"

const editTeamSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters").max(100),
  ageGroup: z.string().min(1, "Select an age group"),
  gender: z.enum(["MALE", "FEMALE", "COED"]).optional(),
  season: z.string().optional(),
  description: z.string().optional(),
})

type EditTeamFormData = z.infer<typeof editTeamSchema>

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

const inputCls =
  "mt-1 block w-full rounded-md border border-ink-200 px-3 py-2 text-sm focus:border-play-500 focus:outline-none focus:ring-1 focus:ring-play-500/20 disabled:cursor-not-allowed disabled:bg-ink-50 disabled:text-ink-400"

const inlineSelectCls =
  "rounded-md border border-ink-200 px-3 py-2 text-sm focus:border-play-500 focus:outline-none focus:ring-1 focus:ring-play-500/20"

type StaffRoleType = "HeadCoach" | "AssistantCoach" | "TeamManager"

interface ExistingStaffMember {
  id: string // UserRole ID
  role: string
  designation: string | null
  user: {
    id: string
    firstName: string | null
    lastName: string | null
    email: string
  }
}

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

interface TeamTryout {
  id: string
  title: string
  scheduledAt: string
  isPublished: boolean
  ageGroup: string
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

function getStaffRoleTone(staffRole: StaffRoleType): BadgeTone {
  switch (staffRole) {
    case "HeadCoach":
      return "play"
    case "AssistantCoach":
      return "court"
    case "TeamManager":
      return "play"
  }
}

function getDesignationLabel(designation: string | null, role: string): string {
  if (designation === "HeadCoach") return "Head Coach"
  if (designation === "AssistantCoach") return "Assistant Coach"
  if (role === "TeamManager") return "Team Manager"
  return role
}

function getDesignationTone(designation: string | null, role: string): BadgeTone {
  if (designation === "HeadCoach") return "play"
  if (designation === "AssistantCoach") return "court"
  if (role === "TeamManager") return "play"
  return "neutral"
}

function toStaffRoleType(designation: string | null, role: string): StaffRoleType {
  if (designation === "HeadCoach") return "HeadCoach"
  if (designation === "AssistantCoach") return "AssistantCoach"
  if (role === "TeamManager") return "TeamManager"
  return "AssistantCoach"
}

export default function EditTeamPage() {
  const params = useParams()
  const clubId = params?.id as string
  const teamId = params?.teamId as string

  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  // Existing staff on the team (from DB)
  const [existingStaff, setExistingStaff] = useState<ExistingStaffMember[]>([])
  const [staffToRemove, setStaffToRemove] = useState<string[]>([]) // UserRole IDs

  // New staff to add
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

  const [tryoutList, setTryoutList] = useState<TeamTryout[]>([])

  // Roster commitment cap (owner 2026-07-24, QA-103) — kept outside the
  // zod-validated form (like staff) so an empty cap input maps cleanly to
  // "no cap" instead of fighting number coercion.
  const [maxPlayers, setMaxPlayers] = useState("")
  const [showRosterFill, setShowRosterFill] = useState<"inherit" | "show" | "hide">("inherit")

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EditTeamFormData>({
    resolver: zodResolver(editTeamSchema),
  })

  // Load team data
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
        setExistingStaff(team.staff || [])
        setTryoutList(team.tryouts || [])
        setMaxPlayers(team.maxPlayers != null ? String(team.maxPlayers) : "")
        setShowRosterFill(
          team.showRosterFill === true ? "show" : team.showRosterFill === false ? "hide" : "inherit"
        )
      } catch {
        setError("Failed to load team")
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [teamId, reset])

  // Fetch available staff
  useEffect(() => {
    async function fetchStaff() {
      try {
        const res = await fetch(`/api/clubs/${clubId}/staff/available`)
        if (res.ok) {
          const data = await res.json()
          setAvailableStaff(data.staff || [])
        }
      } catch {
        // Silently fail
      } finally {
        setLoadingStaff(false)
      }
    }
    fetchStaff()
  }, [clubId])

  // Compute active staff (existing minus removed)
  const activeExistingStaff = existingStaff.filter((s) => !staffToRemove.includes(s.id))

  const hasHeadCoach =
    activeExistingStaff.some((s) => s.designation === "HeadCoach") ||
    staffAssignments.some((s) => s.staffRole === "HeadCoach") ||
    staffInvites.some((s) => s.staffRole === "HeadCoach")

  // Filter out staff already on the team or already added
  const existingUserIds = new Set(activeExistingStaff.map((s) => s.user.id))
  const newAssignmentUserIds = new Set(staffAssignments.map((s) => s.userId))

  const unassignedStaff = availableStaff.filter(
    (s) => !existingUserIds.has(s.userId) && !newAssignmentUserIds.has(s.userId)
  )

  const handleAddStaff = () => {
    if (!selectedStaffId) return

    const staff = availableStaff.find((s) => s.userId === selectedStaffId)
    if (!staff) return

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

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address")
      return
    }

    if (staffInvites.some((s) => s.email === email)) {
      setError("This email is already in the invite list")
      return
    }
    if (staffAssignments.some((s) => s.email === email)) {
      setError("This person is already assigned as staff")
      return
    }
    if (activeExistingStaff.some((s) => s.user.email === email)) {
      setError("This person is already on the team")
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

  const removeNewAssignment = (userId: string) => {
    setStaffAssignments((prev) => prev.filter((s) => s.userId !== userId))
  }

  const removeNewInvite = (email: string) => {
    setStaffInvites((prev) => prev.filter((s) => s.email !== email))
  }

  const markExistingForRemoval = (userRoleId: string) => {
    setStaffToRemove((prev) => [...prev, userRoleId])
  }

  const undoRemoval = (userRoleId: string) => {
    setStaffToRemove((prev) => prev.filter((id) => id !== userRoleId))
  }

  const onSubmit = async (data: EditTeamFormData) => {
    setIsSubmitting(true)
    setError(null)
    setSaved(false)

    // Build staff arrays for the API
    const staffToAddPayload = [
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
        season: data.season || null,
        description: data.description || null,
        maxPlayers: maxPlayers.trim() === "" ? null : Number(maxPlayers),
        showRosterFill:
          showRosterFill === "show" ? true : showRosterFill === "hide" ? false : null,
      }
      if (data.gender) payload.gender = data.gender
      if (staffToAddPayload.length > 0) payload.staffToAdd = staffToAddPayload
      if (staffToRemove.length > 0) payload.staffToRemove = staffToRemove

      const res = await fetch(`/api/teams/${teamId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        let errorMsg = "Failed to update team"
        try {
          const errorData = await res.json()
          errorMsg = errorData.error || errorMsg
        } catch {
          // Response wasn't JSON
        }
        throw new Error(errorMsg)
      }

      const updatedTeam = await res.json()

      // Refresh state with updated team data
      setExistingStaff(updatedTeam.staff || [])
      setStaffToRemove([])
      setStaffAssignments([])
      setStaffInvites([])
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsSubmitting(false)
    }
  }

  const hasPendingStaffChanges =
    staffToRemove.length > 0 || staffAssignments.length > 0 || staffInvites.length > 0

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-ink-500">Loading team...</p>
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
        <h2 className="font-condensed text-ink-950 text-2xl font-bold uppercase tracking-wide">
          Edit Team
        </h2>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {error && (
          <div className="border-hoop-200 bg-hoop-50 text-hoop-700 rounded-xl border p-3 text-sm">
            {error}
          </div>
        )}
        {saved && (
          <div className="bg-court-50 text-court-700 border-court-200 rounded-xl border p-3 text-sm">
            Team updated successfully.
          </div>
        )}

        {/* Team Details Card */}
        <Card className="reveal">
          <PanelHeader title="Team details" />

          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="text-ink-700 block text-sm font-medium">
                Team Name <span className="text-red-500">*</span>
              </label>
              <input {...register("name")} type="text" id="name" className={inputCls} />
              {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>}
            </div>

            <div>
              <label htmlFor="ageGroup" className="text-ink-700 block text-sm font-medium">
                Age Group <span className="text-red-500">*</span>
              </label>
              <select {...register("ageGroup")} id="ageGroup" className={inputCls}>
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
                <select {...register("gender")} id="gender" className={inputCls}>
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
                  className={inputCls}
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
                className={inputCls}
                placeholder="Team description..."
              />
            </div>

            <div>
              <label htmlFor="maxPlayers" className="text-ink-700 block text-sm font-medium">
                Roster cap (committed players)
              </label>
              <input
                type="number"
                id="maxPlayers"
                min={1}
                step={1}
                value={maxPlayers}
                onChange={(e) => setMaxPlayers(e.target.value)}
                className={inputCls}
                placeholder="No cap"
              />
              <p className="text-ink-500 mt-1 text-xs">
                Counts PAID/committed players only. You can always send more offers than spots.
                Families are told a spot is theirs when payment is made.
              </p>
            </div>

            <div>
              <label htmlFor="showRosterFill" className="text-ink-700 block text-sm font-medium">
                Show roster fill publicly
              </label>
              <select
                id="showRosterFill"
                value={showRosterFill}
                onChange={(e) => setShowRosterFill(e.target.value as typeof showRosterFill)}
                className={inputCls}
              >
                <option value="inherit">Inherit club default</option>
                <option value="show">Show</option>
                <option value="hide">Hide</option>
              </select>
              <p className="text-ink-500 mt-1 text-xs">
                Shows &quot;X of Y spots filled&quot; on the public team page.
              </p>
            </div>
          </div>
        </Card>

        {/* Staff Management Card */}
        <Card className="reveal [animation-delay:80ms]">
          <PanelHeader
            title="Staff"
            action={<Badge>{activeExistingStaff.length + staffAssignments.length}</Badge>}
          />
          <p className="text-ink-600 -mt-3 mb-4 text-sm">
            Manage coaches and team managers. Staff can be assigned to multiple teams and clubs.
          </p>

          {/* Current staff on team */}
          {existingStaff.length > 0 && (
            <div className="mb-4">
              <label className="text-ink-500 mb-2 block text-xs font-semibold uppercase tracking-wider">
                Current Staff
              </label>
              <div className="space-y-2">
                {existingStaff.map((member) => {
                  const name =
                    [member.user.firstName, member.user.lastName].filter(Boolean).join(" ") ||
                    member.user.email
                  const isMarkedForRemoval = staffToRemove.includes(member.id)

                  return (
                    <div
                      key={member.id}
                      className={`flex items-center justify-between rounded-xl border px-3 py-2 transition-colors ${
                        isMarkedForRemoval
                          ? "border-hoop-200 bg-hoop-50 opacity-60"
                          : "border-ink-100 hover:border-ink-200"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div>
                          <p
                            className={`text-sm font-medium ${isMarkedForRemoval ? "text-hoop-700 line-through" : "text-ink-900"}`}
                          >
                            {name}
                          </p>
                          <p className="text-ink-500 text-xs">{member.user.email}</p>
                        </div>
                        <Badge tone={getDesignationTone(member.designation, member.role)}>
                          {getDesignationLabel(member.designation, member.role)}
                        </Badge>
                      </div>
                      {isMarkedForRemoval ? (
                        <button
                          type="button"
                          onClick={() => undoRemoval(member.id)}
                          className="text-play-700 hover:text-play-700 text-xs font-medium"
                        >
                          Undo
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => markExistingForRemoval(member.id)}
                          className="text-ink-400 hover:text-hoop-600 transition-colors"
                          title="Remove from team"
                        >
                          <svg
                            className="h-4 w-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* New assignments (pending save) */}
          {(staffAssignments.length > 0 || staffInvites.length > 0) && (
            <div className="mb-4">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-amber-600">
                Pending Changes (save to apply)
              </label>
              <div className="space-y-2">
                {staffAssignments.map((s) => (
                  <div
                    key={s.userId}
                    className="border-court-200 bg-court-50 flex items-center justify-between rounded-xl border px-3 py-2"
                  >
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="text-ink-900 text-sm font-medium">{s.name}</p>
                        <p className="text-ink-500 text-xs">{s.email}</p>
                      </div>
                      <Badge tone={getStaffRoleTone(s.staffRole)}>
                        {getStaffRoleLabel(s.staffRole)}
                      </Badge>
                      <span className="text-court-600 text-xs">+ New</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeNewAssignment(s.userId)}
                      className="text-ink-400 hover:text-hoop-600 transition-colors"
                    >
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
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
                    className="flex items-center justify-between rounded-xl border border-dashed border-amber-300 bg-amber-50 px-3 py-2"
                  >
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="text-ink-900 text-sm font-medium">{s.email}</p>
                        <p className="text-xs text-amber-600">Pending invite</p>
                      </div>
                      <Badge tone={getStaffRoleTone(s.staffRole)}>
                        {getStaffRoleLabel(s.staffRole)}
                      </Badge>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeNewInvite(s.email)}
                      className="text-ink-400 hover:text-hoop-600 transition-colors"
                    >
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
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
            </div>
          )}

          {/* Add existing staff */}
          <div className="border-ink-100 mb-4 border-t pt-4">
            <label className="text-ink-500 mb-2 block text-xs font-semibold uppercase tracking-wider">
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
                  className={`${inlineSelectCls} min-w-0 flex-1`}
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
                  className={`${inlineSelectCls} w-40`}
                >
                  <option value="HeadCoach" disabled={hasHeadCoach}>
                    Head Coach
                  </option>
                  <option value="AssistantCoach">Assistant Coach</option>
                  <option value="TeamManager">Team Manager</option>
                </select>
                <Button type="button" size="sm" onClick={handleAddStaff} disabled={!selectedStaffId}>
                  Add
                </Button>
              </div>
            )}
          </div>

          {/* Invite by email */}
          <div className="border-ink-100 border-t pt-4">
            <label className="text-ink-500 mb-2 block text-xs font-semibold uppercase tracking-wider">
              Invite by Email
            </label>
            <div className="flex gap-2">
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="staff@example.com"
                className={`${inlineSelectCls} min-w-0 flex-1`}
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
                className={`${inlineSelectCls} w-40`}
              >
                <option value="HeadCoach" disabled={hasHeadCoach}>
                  Head Coach
                </option>
                <option value="AssistantCoach">Assistant Coach</option>
                <option value="TeamManager">Team Manager</option>
              </select>
              <Button
                type="button"
                size="sm"
                variant="subtle"
                onClick={handleAddInvite}
                disabled={!inviteEmail.trim()}
              >
                Invite
              </Button>
            </div>
            <p className="text-ink-500 mt-1 text-xs">
              The invited person will receive a notification and be assigned to this team once they
              accept.
            </p>
          </div>
        </Card>

        {/* Save / Cancel buttons */}
        <div className="flex gap-3">
          <Button variant="subtle" href={`/clubs/${clubId}/teams`}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting} className="flex-1">
            {isSubmitting
              ? "Saving..."
              : hasPendingStaffChanges
                ? "Save All Changes"
                : "Save Changes"}
          </Button>
        </div>
      </form>

      {/* Tryouts Section */}
      <Card className="reveal mt-6 [animation-delay:160ms]">
        <PanelHeader
          title={`Tryouts (${tryoutList.length})`}
          action={
            <Button size="sm" variant="subtle" href={`/clubs/${clubId}/tryouts/create`}>
              Create Tryout
            </Button>
          }
        />
        {tryoutList.length === 0 ? (
          <p className="text-ink-500 text-sm">
            No tryouts linked to this team yet. Link a tryout by selecting this team when creating
            or editing a tryout.
          </p>
        ) : (
          <div className="space-y-2">
            {tryoutList.map((tryout) => {
              const isPast = new Date(tryout.scheduledAt) < new Date()
              return (
                <Link
                  key={tryout.id}
                  href={`/clubs/${clubId}/tryouts/${tryout.id}/edit`}
                  className="border-ink-100 flex items-center justify-between gap-3 rounded-2xl border bg-white p-3 transition-all duration-200 hover:translate-x-0.5 hover:border-[color:var(--brand-line)] hover:shadow-[0_10px_30px_-22px_rgba(15,23,42,0.45)]"
                >
                  <div className="min-w-0">
                    <p className="text-ink-900 truncate text-sm font-medium">{tryout.title}</p>
                    <p className="text-ink-500 text-xs">
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
                  <Badge
                    tone={
                      isPast ? "neutral" : toneForStatus(tryout.isPublished ? "PUBLISHED" : "DRAFT")
                    }
                    className="shrink-0"
                  >
                    {isPast ? "Past" : tryout.isPublished ? "Published" : "Draft"}
                  </Badge>
                </Link>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}
