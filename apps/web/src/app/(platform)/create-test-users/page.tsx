"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export default function CreateTestUsersPage() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [clubId, setClubId] = useState("")
  const router = useRouter()

  const createTestUsers = async () => {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch("/api/create-test-users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          clubId: clubId || undefined,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setResult(data)
      } else {
        setError(data.error || "Failed to create test users")
      }
    } catch (err) {
      setError("Network error: " + String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-court-50 flex min-h-screen items-center justify-center p-4">
      <div className="border-ink-100 w-full max-w-3xl rounded-3xl border bg-white p-8 shadow-[0_24px_70px_-40px_rgba(15,23,42,0.45)]">
        <h1 className="text-ink-900 mb-4 text-2xl font-semibold">Create Test Users</h1>
        <p className="text-ink-700 mb-6">
          This will create test users with different roles in your database. These are for
          development/testing only.
        </p>

        <div className="mb-6">
          <label htmlFor="clubId" className="text-ink-800 mb-2 block text-sm font-medium">
            Club ID (optional - leave empty to auto-detect your club)
          </label>
          <input
            type="text"
            id="clubId"
            value={clubId}
            onChange={(e) => setClubId(e.target.value)}
            className="border-ink-200 focus:border-play-500 focus:ring-play-500/20 w-full rounded-xl border px-4 py-2.5"
            placeholder="Enter club ID or leave empty"
          />
          <p className="text-ink-500 mt-1 text-sm">
            If you leave this empty, we&apos;ll use the first club you own
          </p>
        </div>

        <button
          onClick={createTestUsers}
          disabled={loading}
          className="bg-play-600 hover:bg-play-700 disabled:bg-ink-400 w-full rounded-xl px-6 py-3 font-semibold text-white transition disabled:cursor-not-allowed"
        >
          {loading ? "Creating Test Users..." : "Create Test Users"}
        </button>

        {result && (
          <div className="mt-6 rounded-lg border border-green-200 bg-green-50 p-4">
            <h3 className="mb-3 font-semibold text-green-800">{result.message}</h3>
            {result.users && (
              <div className="space-y-3">
                {result.users.map((user: any, index: number) => (
                  <div
                    key={index}
                    className="text-court-700 rounded-xl border border-green-100 bg-white p-3 text-sm"
                  >
                    <p>
                      <strong>Name:</strong> {user.firstName} {user.lastName}
                    </p>
                    <p>
                      <strong>Email:</strong> {user.email}
                    </p>
                    <p>
                      <strong>Role:</strong> {user.role}
                    </p>
                    <p className="text-ink-500 mt-1 text-xs">User ID: {user.id}</p>
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={() => router.push("/dashboard")}
              className="text-play-700 hover:text-play-800 mt-4 font-medium"
            >
              Go to Dashboard →
            </button>
          </div>
        )}

        {error && (
          <div className="border-hoop-200 mt-6 rounded-lg border bg-red-50 p-4">
            <h3 className="mb-2 font-semibold text-red-800">Error</h3>
            <p className="text-hoop-700 text-sm">{error}</p>
          </div>
        )}

        <div className="mt-8 border-t pt-6">
          <h3 className="text-ink-900 mb-3 font-semibold">Test Users That Will Be Created:</h3>
          <ul className="text-ink-700 space-y-2 text-sm">
            <li>
              • <strong>ClubOwner:</strong> owner@test.com - Can manage entire club
            </li>
            <li>
              • <strong>ClubManager:</strong> manager@test.com - Can manage club operations
            </li>
            <li>
              • <strong>Staff (Boys U14):</strong> staff.boys@test.com - Team staff
            </li>
            <li>
              • <strong>Staff (Girls U16):</strong> staff.girls@test.com - Team staff
            </li>
            <li>
              • <strong>Parent:</strong> parent@test.com - Can register players
            </li>
            <li>
              • <strong>Referee:</strong> referee@test.com - Can officiate games
            </li>
            <li>
              • <strong>Scorekeeper:</strong> scorekeeper@test.com - Can track game stats
            </li>
            <li>
              • <strong>Player:</strong> player@test.com - Athlete
            </li>
          </ul>
          <p className="text-ink-500 mt-4 text-xs">
            Note: These are test users for verifying data relationships and permissions logic. All
            test accounts use the same password.
          </p>
        </div>
      </div>
    </div>
  )
}
