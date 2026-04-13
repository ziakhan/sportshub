"use client"

import { useState, useEffect, useCallback } from "react"
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
  if (role === "ClubOwner") return "bg-hoop-100 text-hoop-700 border-hoop-200"
  if (role === "ClubManager") return "bg-play-100 text-play-700 border-play-200"
  return "bg-play-100 text-play-700 border-play-200"
}

function getTeamRoleLabel(designation: string | null, role: string): string {
  if (designation === "HeadCoach") return "Head Coach"
  if (designation === "AssistantCoach") return "Asst. Coach"
  if (role === "TeamManager") return "Manager"
  return "Staff"
}

function getTeamRoleBadgeColor(designation: string | null, role: string): string {
  if (designation === "HeadCoach") return "bg-play-50 text-play-700 border-play-200"
  if (designation === "AssistantCoach") return "bg-court-50 text-court-700 border-court-200"
  if (role === "TeamManager") return "bg-court-50 text-court-700 border-court-200"
  return "bg-court-50 text-ink-600 border-ink-200"
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

  const loadData = useCallback(async () => {
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
  }, [clubId])

  useEffect(() => {
    loadData()
  }, [loadData])

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
      const res = await fetch(`/api/clubs/${clubId}/staff?roleId=${roleId}`, { method: "DELETE" })

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
        <p className="text-ink-500">Loading staff...</p>
      </div>
    )
  }

  const sentInvites = invitations.filter((i) => i.type === "INVITE")
  const requests = invitations.filter((i) => i.type === "REQUEST")
  const grouped = groupStaffByUser(staff)

  return (
    <div className="space-y-8">
      {/* Invite Form */}
      <div className="border-ink-100 shadow-soft rounded-2xl border bg-white p-6">
        <h2 className="text-ink-900 mb-4 text-lg font-semibold">Invite Staff</h2>

        {error && (
          <div className="border-hoop-200 bg-hoop-50 text-hoop-700 mb-4 rounded-xl border p-3 text-sm">
            {error}
          </div>
        )}

        {inviteSuccess && (
          <div className="border-court-200 bg-court-50 text-court-700 mb-4 rounded-xl border p-3 text-sm">
            {inviteSuccess}
          </div>
        )}

        <form onSubmit={handleInvite} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="text-ink-700 block text-sm font-medium">Email</label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
                className="border-ink-200 focus:border-play-500 focus:ring-play-500 mt-1 block w-full rounded-xl border px-3 py-2 focus:outline-none focus:ring-1"
                placeholder="staff@example.com"
              />
            </div>
            <div>
              <label className="text-ink-700 block text-sm font-medium">Role</label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as "ClubManager" | "Staff")}
                className="border-ink-200 focus:border-play-500 mt-1 block w-full rounded-xl border px-3 py-2 focus:outline-none"
              >
                <option value="Staff">Staff</option>
                <option value="ClubManager">Manager</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={inviting}
                className="bg-play-600 hover:bg-play-700 disabled:bg-court-300 w-full rounded-xl px-4 py-2 font-semibold text-white"
              >
                {inviting ? "Sending..." : "Send Invite"}
              </button>
            </div>
          </div>
          <div>
            <label className="text-ink-700 block text-sm font-medium">
              Message <span className="text-ink-400">(optional)</span>
            </label>
            <input
              type="text"
              value={inviteMessage}
              onChange={(e) => setInviteMessage(e.target.value)}
              className="border-ink-200 focus:border-play-500 mt-1 block w-full rounded-xl border px-3 py-2 focus:outline-none"
              placeholder="We'd love you to join our staff!"
            />
          </div>
        </form>
      </div>

      {/* Staff Requests */}
      {requests.length > 0 && (
        <div className="border-ink-100 shadow-soft rounded-2xl border bg-white p-6">
          <h2 className="text-ink-900 mb-4 text-lg font-semibold">
            Staff Requests ({requests.length})
          </h2>
          <div className="space-y-3">
            {requests.map((req) => {
              const name = req.invitedUser
                ? [req.invitedUser.firstName, req.invitedUser.lastName].filter(Boolean).join(" ") ||
                  req.invitedEmail
                : req.invitedEmail

              return (
                <div
                  key={req.id}
                  className="border-ink-100 flex items-center justify-between rounded-xl border p-4"
                >
                  <div>
                    <div className="text-ink-900 font-medium">{name}</div>
                    <div className="text-ink-500 text-sm">
                      Wants to join as {req.role}
                      {req.message && ` — "${req.message}"`}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleRespondToRequest(req.id, "accept", req.role)}
                      className="bg-play-600 hover:bg-play-700 rounded-xl px-3 py-1.5 text-xs font-semibold text-white"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => handleRespondToRequest(req.id, "decline")}
                      className="border-ink-200 text-ink-700 hover:bg-court-50 rounded-xl border px-3 py-1.5 text-xs font-semibold"
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
      <div className="border-ink-100 shadow-soft rounded-2xl border bg-white p-6">
        <h2 className="text-ink-900 mb-4 text-lg font-semibold">
          Current Staff ({grouped.length})
        </h2>

        {grouped.length === 0 ? (
          <p className="text-ink-400 text-sm">No staff members yet.</p>
        ) : (
          <div className="space-y-4">
            {grouped.map((member) => {
              const name =
                [member.firstName, member.lastName].filter(Boolean).join(" ") || member.email

              const isOwner = member.clubRoles.some((r) => r.role === "ClubOwner")

              return (
                <div key={member.userId} className="border-ink-100 rounded-xl border bg-white p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      {/* Name + Email */}
                      <div className="flex items-center gap-2">
                        <span className="text-ink-900 font-medium">{name}</span>
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
                      <div className="text-ink-500 mt-0.5 text-xs">{member.email}</div>

                      {/* Team assignments */}
                      {member.teamRoles.length > 0 && (
                        <div className="mt-3">
                          <div className="text-ink-400 mb-1.5 text-xs font-medium uppercase tracking-wider">
                            Team Assignments
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {member.teamRoles.map((tr) => (
                              <Link
                                key={tr.id}
                                href={`/clubs/${clubId}/teams/${tr.team!.id}/edit`}
                                className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-xs font-medium transition-colors hover:shadow-sm ${getTeamRoleBadgeColor(tr.designation, tr.role)}`}
                              >
                                <span className="font-semibold">{tr.team!.name}</span>
                                <span className="opacity-60">·</span>
                                <span>{getTeamRoleLabel(tr.designation, tr.role)}</span>
                                <svg
                                  className="h-3 w-3 opacity-40"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M9 5l7 7-7 7"
                                  />
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
                            <span className="border-ink-200 bg-court-50 text-ink-500 inline-flex rounded-full border px-2 py-0.5 text-xs">
                              Not assigned to any team
                            </span>
                          </div>
                        )}
                    </div>

                    {/* Remove button */}
                    {!isOwner && (
                      <button
                        onClick={() =>
                          handleRemove(member.clubRoles[0]?.id || member.teamRoles[0]?.id, name)
                        }
                        className="text-hoop-600 hover:text-hoop-700 ml-4 text-xs font-medium"
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
        <div className="border-ink-100 shadow-soft rounded-2xl border bg-white p-6">
          <h2 className="text-ink-900 mb-4 text-lg font-semibold">
            Pending Invitations ({sentInvites.length})
          </h2>
          <div className="space-y-3">
            {sentInvites.map((invite) => (
              <div
                key={invite.id}
                className="border-ink-100 bg-court-50 flex items-center justify-between rounded-xl border p-4"
              >
                <div>
                  <div className="text-ink-900 font-medium">{invite.invitedEmail}</div>
                  <div className="text-ink-500 text-xs">Invited as {invite.role} — Pending</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
