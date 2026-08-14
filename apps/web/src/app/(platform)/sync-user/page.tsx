"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { CourtBackdrop } from "@/components/ui"

// LEGACY: a Clerk-era repair tool that survived the NextAuth migration. Nothing
// links to it and /api/sync-current-user is the only caller. Worth deleting.
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
    <CourtBackdrop
      variant="navy"
      className="flex min-h-[calc(100vh-4rem)] items-center"
      contentClassName="flex justify-center p-4"
    >
      <div className="border-ink-100 shadow-panel w-full max-w-md rounded-[28px] border bg-white p-8">
        <h1 className="text-ink-950 mb-4 text-2xl font-bold">
          Sync User to Database
        </h1>
        <p className="text-ink-600 mb-6">
          Click the button below to sync your Clerk account to the database.
          This will create your user record and assign you a Parent role.
        </p>

        <button
          onClick={syncUser}
          disabled={loading}
          className="bg-play-600 hover:bg-play-700 disabled:bg-ink-300 w-full rounded-xl px-6 py-3 font-semibold text-white disabled:cursor-not-allowed"
        >
          {loading ? "Syncing..." : "Sync My Account"}
        </button>

        {result && (
          <div className="bg-court-50 border-court-200 mt-6 rounded-xl border p-4">
            <h3 className="text-court-800 mb-2 font-semibold">
              {result.message}
            </h3>
            {result.user && (
              <div className="text-sm text-court-700 space-y-1">
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
              className="text-play-600 hover:text-play-700 mt-4 font-medium"
            >
              Go to Dashboard
            </button>
          </div>
        )}

        {error && (
          <div className="bg-hoop-50 border-hoop-200 mt-6 rounded-xl border p-4">
            <h3 className="text-hoop-800 mb-2 font-semibold">Error</h3>
            <p className="text-sm text-hoop-700">{error}</p>
          </div>
        )}
      </div>
    </CourtBackdrop>
  )
}
