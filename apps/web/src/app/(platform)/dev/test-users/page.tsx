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
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-3xl mx-auto">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <p className="text-yellow-800 font-semibold">
            DEV ONLY - Role Switcher
          </p>
          <p className="text-yellow-700 text-sm">
            Switch your account&apos;s role to test different permissions and UI views.
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">
            Role Switcher
          </h1>
          {userName && (
            <p className="text-gray-500 mb-4">
              Logged in as <strong>{userName}</strong> ({userEmail})
            </p>
          )}

          {currentRole && (
            <div className="mb-6 flex items-center gap-3">
              <span className="text-gray-600">Current role:</span>
              <span
                className={`px-3 py-1 rounded-full text-sm font-semibold border ${roleColor[currentRole] || "bg-gray-100"}`}
              >
                {currentRole}
              </span>
              {tenantName && (
                <span className="text-gray-500 text-sm">
                  (scoped to {tenantName})
                </span>
              )}
            </div>
          )}

          {message && (
            <div
              className={`mb-6 rounded-lg p-3 text-sm ${
                message.startsWith("Error")
                  ? "bg-red-50 text-red-700 border border-red-200"
                  : "bg-green-50 text-green-700 border border-green-200"
              }`}
            >
              {message}
            </div>
          )}

          <h2 className="text-lg font-semibold text-gray-800 mb-3">
            Click a role to switch:
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {ALL_ROLES.map(({ role, description }) => (
              <button
                key={role}
                onClick={() => switchRole(role)}
                disabled={loading || role === currentRole}
                className={`text-left p-4 rounded-lg border-2 transition-all ${
                  role === currentRole
                    ? `${roleColor[role]} border-2 cursor-default`
                    : "bg-white border-gray-200 hover:border-orange-400 hover:shadow-md cursor-pointer"
                } ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <div className="font-semibold text-gray-900">{role}</div>
                <div className="text-sm text-gray-500">{description}</div>
                {role === currentRole && (
                  <div className="text-xs font-medium mt-1">Active</div>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
