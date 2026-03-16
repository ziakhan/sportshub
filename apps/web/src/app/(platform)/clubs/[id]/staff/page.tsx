"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"

interface StaffMember {
  id: string
  role: string
  user: {
    id: string
    firstName: string | null
    lastName: string | null
    email: string
  }
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

export default function StaffPage() {
  const params = useParams()
  const router = useRouter()
  const clubId = params.id as string

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
          Current Staff ({staff.length})
        </h2>

        {staff.length === 0 ? (
          <p className="text-sm text-gray-400">No staff members yet.</p>
        ) : (
          <div className="space-y-3">
            {staff.map((member) => {
              const name =
                [member.user.firstName, member.user.lastName]
                  .filter(Boolean)
                  .join(" ") || member.user.email

              return (
                <div
                  key={member.id}
                  className="flex items-center justify-between rounded-md border border-gray-200 p-4"
                >
                  <div className="flex items-center gap-3">
                    <div>
                      <div className="font-medium text-gray-900">{name}</div>
                      <div className="text-xs text-gray-500">
                        {member.user.email}
                      </div>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        member.role === "ClubOwner"
                          ? "bg-yellow-100 text-yellow-700"
                          : member.role === "ClubManager"
                            ? "bg-purple-100 text-purple-700"
                            : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {member.role}
                    </span>
                  </div>
                  {member.role !== "ClubOwner" && (
                    <button
                      onClick={() => handleRemove(member.id, name)}
                      className="text-xs font-medium text-red-500 hover:text-red-700"
                    >
                      Remove
                    </button>
                  )}
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
