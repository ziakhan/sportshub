"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Suspense } from "react"

function SignInForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams?.get("callbackUrl") || "/"

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    setLoading(true)
    setError("")

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        setError("Invalid email or password")
      } else {
        // Full page reload to pick up session cookie in server layouts
        window.location.href = callbackUrl
      }
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
            Welcome Back
          </div>
        </div>

        <h1 className="text-ink-950 mb-2 text-center text-3xl font-bold">Sign In</h1>
        <p className="text-ink-500 mb-6 text-center text-sm">
          Welcome back to Youth Basketball Hub
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

          <div>
            <label htmlFor="password" className="text-ink-700 block text-sm font-medium">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="border-ink-200 text-ink-950 placeholder-ink-400 focus:border-play-400 focus:ring-play-500/10 mt-1 block w-full rounded-2xl border bg-white px-3 py-3 focus:outline-none focus:ring-4"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="bg-ink-950 hover:bg-ink-800 disabled:bg-ink-300 w-full rounded-2xl px-4 py-3 font-semibold text-white transition disabled:cursor-not-allowed"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p className="text-ink-500 mt-6 text-center text-sm">
          Don&apos;t have an account?{" "}
          <Link href="/sign-up" className="text-play-600 hover:text-play-700 font-semibold">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  )
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  )
}
