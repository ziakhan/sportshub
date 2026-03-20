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
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-3xl w-full bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          Create Test Users
        </h1>
        <p className="text-gray-600 mb-6">
          This will create test users with different roles in your database.
          These are for development/testing only.
        </p>

        <div className="mb-6">
          <label
            htmlFor="clubId"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Club ID (optional - leave empty to auto-detect your club)
          </label>
          <input
            type="text"
            id="clubId"
            value={clubId}
            onChange={(e) => setClubId(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-orange-500 focus:ring-orange-500"
            placeholder="Enter club ID or leave empty"
          />
          <p className="mt-1 text-sm text-gray-500">
            If you leave this empty, we&apos;ll use the first club you own
          </p>
        </div>

        <button
          onClick={createTestUsers}
          disabled={loading}
          className="w-full rounded-lg bg-orange-500 px-6 py-3 text-white font-semibold hover:bg-orange-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {loading ? "Creating Test Users..." : "Create Test Users"}
        </button>

        {result && (
          <div className="mt-6 rounded-lg bg-green-50 border border-green-200 p-4">
            <h3 className="text-green-800 font-semibold mb-3">
              {result.message}
            </h3>
            {result.users && (
              <div className="space-y-3">
                {result.users.map((user: any, index: number) => (
                  <div
                    key={index}
                    className="text-sm text-green-700 bg-white rounded p-3 border border-green-100"
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
                    <p className="text-xs text-gray-500 mt-1">
                      User ID: {user.id}
                    </p>
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={() => router.push("/dashboard")}
              className="mt-4 text-orange-600 hover:text-orange-700 font-medium"
            >
              Go to Dashboard →
            </button>
          </div>
        )}

        {error && (
          <div className="mt-6 rounded-lg bg-red-50 border border-red-200 p-4">
            <h3 className="text-red-800 font-semibold mb-2">Error</h3>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <div className="mt-8 border-t pt-6">
          <h3 className="font-semibold text-gray-900 mb-3">
            Test Users That Will Be Created:
          </h3>
          <ul className="space-y-2 text-sm text-gray-600">
            <li>
              • <strong>ClubOwner:</strong> owner@test.com - Can manage entire
              club
            </li>
            <li>
              • <strong>ClubManager:</strong> manager@test.com - Can manage
              club operations
            </li>
            <li>
              • <strong>Staff (Boys U14):</strong> staff.boys@test.com - Team
              staff
            </li>
            <li>
              • <strong>Staff (Girls U16):</strong> staff.girls@test.com - Team
              staff
            </li>
            <li>
              • <strong>Parent:</strong> parent@test.com - Can register players
            </li>
            <li>
              • <strong>Referee:</strong> referee@test.com - Can officiate
              games
            </li>
            <li>
              • <strong>Scorekeeper:</strong> scorekeeper@test.com - Can track
              game stats
            </li>
            <li>
              • <strong>Player:</strong> player@test.com - Athlete
            </li>
          </ul>
          <p className="mt-4 text-xs text-gray-500">
            Note: These are test users for verifying data relationships and permissions logic.
            All test accounts use the same password.
          </p>
        </div>
      </div>
    </div>
  )
}
