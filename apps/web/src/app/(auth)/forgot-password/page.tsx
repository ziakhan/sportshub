"use client"

import { useState } from "react"
import Link from "next/link"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      if (!res.ok) throw new Error()
      // The API always returns 200 — deliberately the same whether or not an
      // account exists, so this page can't be used to probe for addresses.
      setSent(true)
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

        {sent ? (
          <>
            <h1 className="text-ink-950 mb-2 text-center text-3xl font-bold">Check Your Inbox</h1>
            <p className="text-ink-500 mb-6 text-center text-sm">
              If an account exists for <span className="text-ink-700 font-semibold">{email}</span>,
              we&apos;ve sent a link to reset your password. The link expires in 1 hour.
            </p>
            <p className="text-ink-500 text-center text-sm">
              Didn&apos;t get it? Check your spam folder, or{" "}
              <button
                type="button"
                onClick={() => setSent(false)}
                className="text-play-600 hover:text-play-700 font-semibold"
              >
                try again
              </button>
              .
            </p>
          </>
        ) : (
          <>
            <h1 className="text-ink-950 mb-2 text-center text-3xl font-bold">Forgot Password?</h1>
            <p className="text-ink-500 mb-6 text-center text-sm">
              Enter your account email and we&apos;ll send you a reset link.
            </p>

            {error && (
              <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="text-ink-700 block text-sm font-medium">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="border-ink-200 text-ink-950 placeholder-ink-400 focus:border-play-400 focus:ring-play-500/10 mt-1 block w-full rounded-2xl border bg-white px-3 py-3 focus:outline-none focus:ring-4"
                  placeholder="you@example.com"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="bg-ink-950 hover:bg-ink-800 disabled:bg-ink-300 w-full rounded-2xl px-4 py-3 font-semibold text-white transition disabled:cursor-not-allowed"
              >
                {loading ? "Sending..." : "Send Reset Link"}
              </button>
            </form>
          </>
        )}

        <p className="text-ink-500 mt-6 text-center text-sm">
          Remembered it?{" "}
          <Link href="/sign-in" className="text-play-600 hover:text-play-700 font-semibold">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
