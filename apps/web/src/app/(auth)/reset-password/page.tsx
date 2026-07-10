"use client"

import { useState, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"

function ResetPasswordForm() {
  const searchParams = useSearchParams()
  const token = searchParams?.get("token") || ""

  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (password.length < 8) {
      setError("Password must be at least 8 characters")
      return
    }
    if (password !== confirm) {
      setError("Passwords do not match")
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.")
        return
      }
      setDone(true)
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="border-ink-100 shadow-panel w-full max-w-md rounded-[30px] border bg-white/95 p-8 backdrop-blur-xl">
        <div className="mb-6 text-center">
          <div className="border-play-100 bg-play-50 text-play-600 mb-3 inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em]">
            Password Reset
          </div>
        </div>

        {done ? (
          <>
            <h1 className="text-ink-950 mb-2 text-center text-3xl font-bold">Password Updated</h1>
            <p className="text-ink-500 mb-6 text-center text-sm">
              Your password has been changed. Sign in with your new password to continue.
            </p>
            <Link
              href="/sign-in"
              className="bg-ink-950 hover:bg-ink-800 block w-full rounded-2xl px-4 py-3 text-center font-semibold text-white transition"
            >
              Sign In
            </Link>
          </>
        ) : !token ? (
          <>
            <h1 className="text-ink-950 mb-2 text-center text-3xl font-bold">Invalid Link</h1>
            <p className="text-ink-500 mb-6 text-center text-sm">
              This reset link is missing or malformed. Request a new one and try again.
            </p>
            <Link
              href="/forgot-password"
              className="bg-ink-950 hover:bg-ink-800 block w-full rounded-2xl px-4 py-3 text-center font-semibold text-white transition"
            >
              Request New Link
            </Link>
          </>
        ) : (
          <>
            <h1 className="text-ink-950 mb-2 text-center text-3xl font-bold">Choose a New Password</h1>
            <p className="text-ink-500 mb-6 text-center text-sm">
              Enter a new password for your account.
            </p>

            {error && (
              <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="password" className="text-ink-700 block text-sm font-medium">
                  New Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className="border-ink-200 text-ink-950 placeholder-ink-400 focus:border-play-400 focus:ring-play-500/10 mt-1 block w-full rounded-2xl border bg-white px-3 py-3 focus:outline-none focus:ring-4"
                  placeholder="At least 8 characters"
                />
              </div>

              <div>
                <label htmlFor="confirm" className="text-ink-700 block text-sm font-medium">
                  Confirm New Password
                </label>
                <input
                  id="confirm"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  minLength={8}
                  className="border-ink-200 text-ink-950 placeholder-ink-400 focus:border-play-400 focus:ring-play-500/10 mt-1 block w-full rounded-2xl border bg-white px-3 py-3 focus:outline-none focus:ring-4"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="bg-ink-950 hover:bg-ink-800 disabled:bg-ink-300 w-full rounded-2xl px-4 py-3 font-semibold text-white transition disabled:cursor-not-allowed"
              >
                {loading ? "Updating..." : "Update Password"}
              </button>
            </form>

            <p className="text-ink-500 mt-6 text-center text-sm">
              Link expired?{" "}
              <Link
                href="/forgot-password"
                className="text-play-600 hover:text-play-700 font-semibold"
              >
                Request a new one
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  )
}
