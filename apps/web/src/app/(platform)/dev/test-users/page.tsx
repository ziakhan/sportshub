"use client"

import { useState, useEffect } from "react"

const ALL_ROLES = [
  { role: "ClubOwner", description: "Owns and manages a club/tenant" },
  { role: "ClubManager", description: "Manages club operations" },
  { role: "Staff", description: "Manages teams, runs tryouts" },
  { role: "TeamManager", description: "Manages a specific team" },
  { role: "Parent", description: "Registers players, pays fees" },
  { role: "Player", description: "Player profile (13+)" },
  { role: "Referee", description: "Officiates games" },
  { role: "LeagueOwner", description: "Owns and manages a league" },
  { role: "LeagueManager", description: "Manages league operations" },
  { role: "Scorekeeper", description: "Scores games in real-time" },
  { role: "PlatformAdmin", description: "Full platform admin access" },
]

const roleColor: Record<string, string> = {
  ClubOwner: "bg-purple-100 text-purple-800 border-purple-300",
  ClubManager: "bg-indigo-100 text-indigo-800 border-indigo-300",
  Staff: "bg-orange-100 text-orange-800 border-orange-300",
  TeamManager: "bg-cyan-100 text-cyan-800 border-cyan-300",
  Parent: "bg-green-100 text-green-800 border-green-300",
  Player: "bg-yellow-100 text-yellow-800 border-yellow-300",
  Referee: "bg-orange-100 text-orange-800 border-orange-300",
  LeagueOwner: "bg-red-100 text-red-800 border-red-300",
  LeagueManager: "bg-pink-100 text-pink-800 border-pink-300",
  Scorekeeper: "bg-teal-100 text-teal-800 border-teal-300",
  PlatformAdmin: "bg-gray-200 text-gray-800 border-gray-400",
}

export default function RoleSwitcherPage() {
  const [currentRole, setCurrentRole] = useState<string | null>(null)
  const [userName, setUserName] = useState("")
  const [userEmail, setUserEmail] = useState("")
  const [tenantName, setTenantName] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const fetchCurrentRole = async () => {
    try {
      const res = await fetch("/api/dev/switch-role")
      const data = await res.json()
      if (data.roles && data.roles.length > 0) {
        setCurrentRole(data.roles[0].role)
        setTenantName(data.roles[0].tenant)
      }
      if (data.user) {
        setUserName(data.user.name)
        setUserEmail(data.user.email)
      }
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    fetchCurrentRole()
  }, [])

  const switchRole = async (role: string) => {
    setLoading(true)
    setMessage(null)

    try {
      const res = await fetch("/api/dev/switch-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      })
      const data = await res.json()

      if (res.ok) {
        setCurrentRole(role)
        setTenantName(data.tenantScoped || null)
        setMessage(`Switched to ${role}`)
      } else {
        setMessage(`Error: ${data.error}`)
      }
    } catch (err) {
      setMessage("Network error: " + String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-court-50 min-h-screen p-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
          <p className="font-semibold text-yellow-800">DEV ONLY - Role Switcher</p>
          <p className="text-hoop-700 text-sm">
            Switch your account&apos;s role to test different permissions and UI views.
          </p>
        </div>

        <div className="border-ink-100 mb-6 rounded-3xl border bg-white p-8 shadow-[0_24px_70px_-40px_rgba(15,23,42,0.45)]">
          <h1 className="text-ink-900 mb-1 text-2xl font-semibold">Role Switcher</h1>
          {userName && (
            <p className="text-ink-500 mb-4">
              Logged in as <strong>{userName}</strong> ({userEmail})
            </p>
          )}

          {currentRole && (
            <div className="mb-6 flex items-center gap-3">
              <span className="text-ink-700">Current role:</span>
              <span
                className={`rounded-full border px-3 py-1 text-sm font-semibold ${roleColor[currentRole] || "bg-gray-100"}`}
              >
                {currentRole}
              </span>
              {tenantName && <span className="text-ink-500 text-sm">(scoped to {tenantName})</span>}
            </div>
          )}

          {message && (
            <div
              className={`mb-6 rounded-lg p-3 text-sm ${
                message.startsWith("Error")
                  ? "bg-hoop-50 text-hoop-700 border-hoop-200 border"
                  : "bg-court-50 text-court-700 border-court-200 border"
              }`}
            >
              {message}
            </div>
          )}

          <h2 className="text-ink-900 mb-3 text-lg font-semibold">Click a role to switch:</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {ALL_ROLES.map(({ role, description }) => (
              <button
                key={role}
                onClick={() => switchRole(role)}
                disabled={loading || role === currentRole}
                className={`rounded-lg border-2 p-4 text-left transition-all ${
                  role === currentRole
                    ? `${roleColor[role]} cursor-default border-2`
                    : "border-ink-200 hover:border-play-300 cursor-pointer bg-white hover:shadow-md"
                } ${loading ? "cursor-not-allowed opacity-50" : ""}`}
              >
                <div className="text-ink-900 font-semibold">{role}</div>
                <div className="text-ink-500 text-sm">{description}</div>
                {role === currentRole && <div className="mt-1 text-xs font-medium">Active</div>}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
