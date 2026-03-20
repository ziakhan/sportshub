"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"

interface StaffRole {
  id: string
  role: string
  designation: string | null
  team: { id: string; name: string } | null
}

interface StaffMember {
  id: string
  role: string
  designation: string | null
  team: { id: string; name: string } | null
  user: {
    id: string
    firstName: string | null
    lastName: string | null
    email: string
  }
}

interface GroupedStaff {
  userId: string
  firstName: string | null
  lastName: string | null
  email: string
  clubRoles: StaffRole[] // ClubOwner, ClubManager, unscoped Staff
  teamRoles: StaffRole[] // team-scoped Staff/TeamManager with designation
}

interface Invitation {
  id: string
  invitedEmail: string
  role: string
  type: "INVITE" | "REQUEST"
  status: string
  message: string | null
  invitedUser: {
    firstName: string | null
    lastName: string | null
    email: string
  } | null
  invitedBy: {
    firstName: string | null
    lastName: string | null
  }
}

function groupStaffByUser(staff: StaffMember[]): GroupedStaff[] {
  const map = new Map<string, GroupedStaff>()

  for (const member of staff) {
    let group = map.get(member.user.id)
    if (!group) {
      group = {
        userId: member.user.id,
        firstName: member.user.firstName,
        lastName: member.user.lastName,
        email: member.user.email,
        clubRoles: [],
        teamRoles: [],
      }
      map.set(member.user.id, group)
    }

    const entry: StaffRole = {
      id: member.id,
      role: member.role,
      designation: member.designation,
      team: member.team,
    }

    if (member.team) {
      group.teamRoles.push(entry)
    } else {
      group.clubRoles.push(entry)
    }
  }

  return Array.from(map.values())
}

function getClubRoleLabel(role: string): string {
  if (role === "ClubOwner") return "Owner"
  if (role === "ClubManager") return "Manager"
  return "Staff"
}

function getClubRoleBadgeColor(role: string): string {
  if (role === "ClubOwner") return "bg-yellow-100 text-yellow-700 border-yellow-200"
  if (role === "ClubManager") return "bg-purple-100 text-purple-700 border-purple-200"
  return "bg-orange-100 text-orange-700 border-orange-200"
}

function getTeamRoleLabel(designation: string | null, role: string): string {
  if (designation === "HeadCoach") return "Head Coach"
  if (designation === "AssistantCoach") return "Asst. Coach"
  if (role === "TeamManager") return "Manager"
  return "Staff"
}

function getTeamRoleBadgeColor(designation: string | null, role: string): string {
  if (designation === "HeadCoach") return "bg-orange-50 text-orange-700 border-orange-200"
  if (designation === "AssistantCoach") return "bg-indigo-50 text-indigo-700 border-indigo-200"
  if (role === "TeamManager") return "bg-green-50 text-green-700 border-green-200"
  return "bg-gray-50 text-gray-600 border-gray-200"
}

export default function StaffPage() {
  const params = useParams()
  const router = useRouter()
  const clubId = params?.id as string

  const [staff, setStaff] = useState<StaffMember[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Invite form
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState<"ClubManager" | "Staff">("Staff")
  const [inviteMessage, setInviteMessage] = useState("")
  const [inviting, setInviting] = useState(false)
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null)

  async function loadData() {
    try {
      const res = await fetch(`/api/clubs/${clubId}/staff`)
      if (!res.ok) throw new Error("Failed to load staff")
      const data = await res.json()
      setStaff(data.staff)
      setInvitations(data.invitations)
    } catch {
      setError("Failed to load staff data")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [clubId])

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setInviting(true)
    setError(null)
    setInviteSuccess(null)

    try {
      const res = await fetch(`/api/clubs/${clubId}/staff`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail,
          role: inviteRole,
          message: inviteMessage || undefined,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to send invitation")
      }

      setInviteSuccess(`Invitation sent to ${inviteEmail}`)
      setInviteEmail("")
      setInviteMessage("")
      loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setInviting(false)
    }
  }

  const handleRemove = async (roleId: string, name: string) => {
    if (!confirm(`Remove ${name} from staff?`)) return

    try {
      const res = await fetch(
        `/api/clubs/${clubId}/staff?roleId=${roleId}`,
        { method: "DELETE" }
      )

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to remove")
      }

      loadData()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to remove")
    }
  }

  const handleRespondToRequest = async (
    invitationId: string,
    action: "accept" | "decline",
    role?: string
  ) => {
    try {
      const res = await fetch(`/api/invitations/${invitationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, role }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to respond")
      }

      loadData()
      router.refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to respond")
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-gray-500">Loading staff...</p>
      </div>
    )
  }

  const sentInvites = invitations.filter((i) => i.type === "INVITE")
  const requests = invitations.filter((i) => i.type === "REQUEST")
  const grouped = groupStaffByUser(staff)

  return (
    <div className="space-y-8">
      {/* Invite Form */}
      <div className="rounded-lg bg-white p-6 shadow">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          Invite Staff
        </h2>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {inviteSuccess && (
          <div className="mb-4 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">
            {inviteSuccess}
          </div>
        )}

        <form onSubmit={handleInvite} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                placeholder="staff@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Role
              </label>
              <select
                value={inviteRole}
                onChange={(e) =>
                  setInviteRole(e.target.value as "ClubManager" | "Staff")
                }
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-purple-500 focus:outline-none"
              >
                <option value="Staff">Staff</option>
                <option value="ClubManager">Manager</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={inviting}
                className="w-full rounded-md bg-purple-600 px-4 py-2 font-semibold text-white hover:bg-purple-700 disabled:bg-gray-400"
              >
                {inviting ? "Sending..." : "Send Invite"}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Message <span className="text-gray-400">(optional)</span>
            </label>
            <input
              type="text"
              value={inviteMessage}
              onChange={(e) => setInviteMessage(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-purple-500 focus:outline-none"
              placeholder="We'd love you to join our staff!"
            />
          </div>
        </form>
      </div>

      {/* Staff Requests */}
      {requests.length > 0 && (
        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Staff Requests ({requests.length})
          </h2>
          <div className="space-y-3">
            {requests.map((req) => {
              const name = req.invitedUser
                ? [req.invitedUser.firstName, req.invitedUser.lastName]
                    .filter(Boolean)
                    .join(" ") || req.invitedEmail
                : req.invitedEmail

              return (
                <div
                  key={req.id}
                  className="flex items-center justify-between rounded-md border border-gray-200 p-4"
                >
                  <div>
                    <div className="font-medium text-gray-900">{name}</div>
                    <div className="text-sm text-gray-500">
                      Wants to join as {req.role}
                      {req.message && ` — "${req.message}"`}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        handleRespondToRequest(req.id, "accept", req.role)
                      }
                      className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() =>
                        handleRespondToRequest(req.id, "decline")
                      }
                      className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Current Staff */}
      <div className="rounded-lg bg-white p-6 shadow">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          Current Staff ({grouped.length})
        </h2>

        {grouped.length === 0 ? (
          <p className="text-sm text-gray-400">No staff members yet.</p>
        ) : (
          <div className="space-y-4">
            {grouped.map((member) => {
              const name =
                [member.firstName, member.lastName]
                  .filter(Boolean)
                  .join(" ") || member.email

              const isOwner = member.clubRoles.some((r) => r.role === "ClubOwner")

              return (
                <div
                  key={member.userId}
                  className="rounded-md border border-gray-200 p-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      {/* Name + Email */}
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{name}</span>
                        {/* Club-level role badges */}
                        {member.clubRoles.map((r) => (
                          <span
                            key={r.id}
                            className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${getClubRoleBadgeColor(r.role)}`}
                          >
                            {getClubRoleLabel(r.role)}
                          </span>
                        ))}
                      </div>
                      <div className="mt-0.5 text-xs text-gray-500">{member.email}</div>

                      {/* Team assignments */}
                      {member.teamRoles.length > 0 && (
                        <div className="mt-3">
                          <div className="mb-1.5 text-xs font-medium uppercase tracking-wider text-gray-400">
                            Team Assignments
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {member.teamRoles.map((tr) => (
                              <Link
                                key={tr.id}
                                href={`/clubs/${clubId}/teams/${tr.team!.id}/edit`}
                                className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors hover:shadow-sm ${getTeamRoleBadgeColor(tr.designation, tr.role)}`}
                              >
                                <span className="font-semibold">{tr.team!.name}</span>
                                <span className="opacity-60">·</span>
                                <span>{getTeamRoleLabel(tr.designation, tr.role)}</span>
                                <svg className="h-3 w-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Unassigned indicator for non-owner/manager staff */}
                      {member.teamRoles.length === 0 &&
                        !isOwner &&
                        !member.clubRoles.some((r) => r.role === "ClubManager") && (
                        <div className="mt-2">
                          <span className="inline-flex rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs text-gray-500">
                            Not assigned to any team
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Remove button */}
                    {!isOwner && (
                      <button
                        onClick={() => handleRemove(member.clubRoles[0]?.id || member.teamRoles[0]?.id, name)}
                        className="ml-4 text-xs font-medium text-red-500 hover:text-red-700"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Pending Invitations */}
      {sentInvites.length > 0 && (
        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Pending Invitations ({sentInvites.length})
          </h2>
          <div className="space-y-3">
            {sentInvites.map((invite) => (
              <div
                key={invite.id}
                className="flex items-center justify-between rounded-md border border-gray-200 bg-gray-50 p-4"
              >
                <div>
                  <div className="font-medium text-gray-900">
                    {invite.invitedEmail}
                  </div>
                  <div className="text-xs text-gray-500">
                    Invited as {invite.role} — Pending
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
