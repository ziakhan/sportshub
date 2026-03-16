"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export default function SyncUserPage() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const syncUser = async () => {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch("/api/sync-current-user", {
        method: "POST",
      })

      const data = await response.json()

      if (response.ok) {
        setResult(data)
      } else {
        setError(data.error || "Failed to sync user")
      }
    } catch (err) {
      setError("Network error: " + String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          Sync User to Database
        </h1>
        <p className="text-gray-600 mb-6">
          Click the button below to sync your Clerk account to the database.
          This will create your user record and assign you a Parent role.
        </p>

        <button
          onClick={syncUser}
          disabled={loading}
          className="w-full rounded-lg bg-blue-600 px-6 py-3 text-white font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {loading ? "Syncing..." : "Sync My Account"}
        </button>

        {result && (
          <div className="mt-6 rounded-lg bg-green-50 border border-green-200 p-4">
            <h3 className="text-green-800 font-semibold mb-2">
              {result.message}
            </h3>
            {result.user && (
              <div className="text-sm text-green-700 space-y-1">
                <p>
                  <strong>Email:</strong> {result.user.email}
                </p>
                <p>
                  <strong>Name:</strong> {result.user.firstName}{" "}
                  {result.user.lastName}
                </p>
                <p>
                  <strong>Role:</strong> {result.user.role || "Parent"}
                </p>
                <p>
                  <strong>User ID:</strong> {result.user.id}
                </p>
              </div>
            )}
            <button
              onClick={() => router.push("/dashboard")}
              className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
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
      </div>
    </div>
  )
}
