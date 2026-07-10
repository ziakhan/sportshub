"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Badge, Button, Card, PanelHeader, toneForStatus } from "@/components/ui"

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

const inputCls =
  "border-ink-200 focus:border-play-500 focus:ring-play-500/20 mt-1 block w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2"

/** Small count pill for panel headers. */
function CountPill({ n }: { n: number }) {
  return (
    <span className="bg-ink-100 text-ink-600 rounded-full px-2.5 py-0.5 text-xs font-semibold">
      {n}
    </span>
  )
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

  // Removes the member entirely — every role at this club and its teams
  // (the old single-roleId call silently left a multi-role member's other roles).
  const handleRemove = async (userId: string, name: string) => {
    if (!confirm(`Remove ${name} from staff? This removes ALL their roles at this club and its teams.`))
      return

    try {
      const res = await fetch(`/api/clubs/${clubId}/staff?userId=${userId}&all=1`, {
        method: "DELETE",
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to remove")
      }

      loadData()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to remove")
    }
  }

  const handleRevokeInvite = async (invitationId: string, email: string) => {
    if (!confirm(`Revoke the invitation to ${email}?`)) return
    try {
      const res = await fetch(`/api/invitations/${invitationId}`, { method: "DELETE" })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to revoke")
      }
      loadData()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to revoke")
    }
  }

  // Promote/demote in place (designation on team coaching roles, role on club rows).
  const handleRoleChange = async (
    roleId: string,
    change: { designation?: string | null; role?: string }
  ) => {
    try {
      const res = await fetch(`/api/clubs/${clubId}/staff`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleId, ...change }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to update role")
      }
      loadData()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update role")
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
        <p className="text-ink-500 motion-safe:animate-pulse">Loading staff...</p>
      </div>
    )
  }

  const sentInvites = invitations.filter((i) => i.type === "INVITE")
  const requests = invitations.filter((i) => i.type === "REQUEST")
  const grouped = groupStaffByUser(staff)

  return (
    <div className="space-y-8">
      {/* Invite Form */}
      <Card className="reveal">
        <PanelHeader title="Invite staff" />

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
                className={inputCls}
                placeholder="staff@example.com"
              />
            </div>
            <div>
              <label className="text-ink-700 block text-sm font-medium">Role</label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as "ClubManager" | "Staff")}
                className={inputCls}
              >
                <option value="Staff">Staff — a coach or team member</option>
                <option value="ClubManager">Manager — helps run the whole club</option>
              </select>
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={inviting} block icon={ICONS.send}>
                {inviting ? "Sending..." : "Send Invite"}
              </Button>
            </div>
          </div>

          <div className="border-ink-100 bg-ink-50 text-ink-600 flex items-start gap-2 rounded-xl border p-3 text-xs leading-5">
            <svg
              className="text-ink-400 mt-0.5 h-4 w-4 shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4M12 8h.01" />
            </svg>
            <span>
              <strong className="text-ink-700 font-semibold">Staff</strong> are the people you
              assign to teams — you&apos;ll choose their role (Head Coach, Assistant Coach, or Team
              Manager) when adding them to a team.{" "}
              <strong className="text-ink-700 font-semibold">Managers</strong> can help run the
              entire club: managing teams, tryouts, and staff.
            </span>
          </div>
          <div>
            <label className="text-ink-700 block text-sm font-medium">
              Message <span className="text-ink-400">(optional)</span>
            </label>
            <input
              type="text"
              value={inviteMessage}
              onChange={(e) => setInviteMessage(e.target.value)}
              className={inputCls}
              placeholder="We'd love you to join our staff!"
            />
          </div>
        </form>
      </Card>

      {/* Staff Requests */}
      {requests.length > 0 && (
        <Card className="reveal [animation-delay:60ms]">
          <PanelHeader title="Staff requests" action={<CountPill n={requests.length} />} />
          <div className="space-y-2">
            {requests.map((req, i) => {
              const name = req.invitedUser
                ? [req.invitedUser.firstName, req.invitedUser.lastName].filter(Boolean).join(" ") ||
                  req.invitedEmail
                : req.invitedEmail

              return (
                <div
                  key={req.id}
                  className="reveal border-ink-100 flex items-center justify-between gap-3 rounded-2xl border p-4 transition-all duration-200 hover:border-[color:var(--brand-line)] hover:shadow-[0_10px_30px_-22px_rgba(15,23,42,0.45)]"
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <div className="min-w-0">
                    <div className="text-ink-900 font-medium">{name}</div>
                    <div className="text-ink-500 text-sm">
                      Wants to join as {req.role}
                      {req.message && ` — "${req.message}"`}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button size="sm" onClick={() => handleRespondToRequest(req.id, "accept", req.role)}>
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="subtle"
                      onClick={() => handleRespondToRequest(req.id, "decline")}
                    >
                      Decline
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* Current Staff */}
      <Card className="reveal [animation-delay:120ms]">
        <PanelHeader title="Current staff" action={<CountPill n={grouped.length} />} />

        {grouped.length === 0 ? (
          <p className="text-ink-400 text-sm">No staff members yet.</p>
        ) : (
          <div className="space-y-3">
            {grouped.map((member, i) => {
              const name =
                [member.firstName, member.lastName].filter(Boolean).join(" ") || member.email

              const isOwner = member.clubRoles.some((r) => r.role === "ClubOwner")

              return (
                <div
                  key={member.userId}
                  className="reveal border-ink-100 rounded-2xl border bg-white p-4 transition-all duration-200 hover:border-[color:var(--brand-line)] hover:shadow-[0_10px_30px_-22px_rgba(15,23,42,0.45)]"
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      {/* Name + Email */}
                      <div className="flex items-center gap-2">
                        <span className="text-ink-900 font-medium">{name}</span>
                        {/* Club-level role badges */}
                        {member.clubRoles.map((r) =>
                          r.role === "ClubOwner" ? (
                            <Badge key={r.id} tone="hoop">
                              Owner
                            </Badge>
                          ) : (
                            // Staff ↔ Manager promoted in place (audit §2c)
                            <select
                              key={r.id}
                              value={r.role}
                              onChange={(e) => handleRoleChange(r.id, { role: e.target.value })}
                              className="bg-play-50 text-play-700 border-play-200 hover:bg-play-100 cursor-pointer rounded-full border px-2 py-0.5 text-xs font-semibold transition-colors"
                              title="Change club role"
                            >
                              <option value="Staff">Staff</option>
                              <option value="ClubManager">Manager</option>
                            </select>
                          )
                        )}
                      </div>
                      <div className="text-ink-500 mt-0.5 text-xs">{member.email}</div>

                      {/* Team assignments */}
                      {member.teamRoles.length > 0 && (
                        <div className="mt-3">
                          <div className="font-condensed text-ink-400 mb-1.5 text-xs font-semibold uppercase tracking-wide">
                            Team Assignments
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            {member.teamRoles.map((tr) => (
                              <span key={tr.id} className="inline-flex items-center gap-1">
                                <Link
                                  href={`/clubs/${clubId}/teams/${tr.team!.id}/edit`}
                                  className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-xs font-medium transition-all duration-150 hover:-translate-y-0.5 hover:shadow-sm ${getTeamRoleBadgeColor(tr.designation, tr.role)}`}
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
                                {/* Coaching designation promoted in place */}
                                {tr.role === "Staff" && (
                                  <select
                                    value={tr.designation ?? ""}
                                    onChange={(e) =>
                                      handleRoleChange(tr.id, {
                                        designation: e.target.value === "" ? null : e.target.value,
                                      })
                                    }
                                    className="border-ink-200 text-ink-600 hover:border-ink-300 cursor-pointer rounded-lg border bg-white px-1.5 py-0.5 text-[11px]"
                                    title="Change coaching designation"
                                  >
                                    <option value="">Staff</option>
                                    <option value="AssistantCoach">Asst. Coach</option>
                                    <option value="HeadCoach">Head Coach</option>
                                  </select>
                                )}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Unassigned indicator for non-owner/manager staff */}
                      {member.teamRoles.length === 0 &&
                        !isOwner &&
                        !member.clubRoles.some((r) => r.role === "ClubManager") && (
                          <div className="mt-2">
                            <span className="bg-ink-100 text-ink-500 inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium">
                              Not assigned to any team
                            </span>
                          </div>
                        )}
                    </div>

                    {/* Remove button — removes ALL of the member's roles here */}
                    {!isOwner && (
                      <Button
                        size="sm"
                        variant="secondary"
                        tone="hoop"
                        onClick={() => handleRemove(member.userId, name)}
                        className="ml-4 shrink-0"
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* Pending Invitations */}
      {sentInvites.length > 0 && (
        <Card className="reveal [animation-delay:180ms]">
          <PanelHeader title="Pending invitations" action={<CountPill n={sentInvites.length} />} />
          <div className="space-y-2">
            {sentInvites.map((invite, i) => (
              <div
                key={invite.id}
                className="reveal border-ink-100 flex items-center justify-between gap-3 rounded-2xl border p-4 transition-all duration-200 hover:border-[color:var(--brand-line)] hover:shadow-[0_10px_30px_-22px_rgba(15,23,42,0.45)]"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-ink-900 font-medium">{invite.invitedEmail}</span>
                    <Badge tone={toneForStatus(invite.status)}>{invite.status}</Badge>
                  </div>
                  <div className="text-ink-500 mt-0.5 text-xs">Invited as {invite.role}</div>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  tone="hoop"
                  onClick={() => handleRevokeInvite(invite.id, invite.invitedEmail)}
                  className="shrink-0"
                >
                  Revoke
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

/** Full SVG icons for kit buttons (the Button kit sizes them). */
const ICONS = {
  send: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
}
