"use client"

import { useRef, useState } from "react"
import { signIn } from "next-auth/react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { GoogleButton } from "@/components/auth/google-button"

/** Same-origin relative paths only — anything else falls back to the app. */
function safeCallbackUrl(raw: string | null | undefined): string | null {
  if (!raw) return null
  return raw.startsWith("/") && !raw.startsWith("//") ? raw : null
}

const inputClass =
  "border-ink-200 text-ink-950 placeholder-ink-400 focus:border-play-400 focus:ring-play-500/10 mt-1 block w-full rounded-2xl border bg-white px-3 py-3 focus:outline-none focus:ring-4"

export function SignInForm({ googleEnabled }: { googleEnabled: boolean }) {
  const searchParams = useSearchParams()
  const rawCallback = safeCallbackUrl(searchParams?.get("callbackUrl"))
  // No deep link → role-aware landing: operators → dashboard, parents/players
  // → personalized public homepage (site-ia-plan §8)
  const callbackUrl = rawCallback ?? "/post-login"

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  // Magic-link stage: request sent → show the "check your email" + code panel
  const [magicSent, setMagicSent] = useState(false)
  const [magicLoading, setMagicLoading] = useState(false)
  const [code, setCode] = useState("")
  const [codeError, setCodeError] = useState("")
  const [codeLoading, setCodeLoading] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(false)
  const emailRef = useRef<HTMLInputElement>(null)

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    try {
      const result = await signIn("credentials", { email, password, redirect: false })
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

  const requestMagicLink = async () => {
    if (!email) {
      setError("Enter your email above first — we'll send the sign-in link there.")
      emailRef.current?.focus()
      return
    }
    setMagicLoading(true)
    setError("")
    try {
      await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Always 200 (anti-enumeration) — the sent panel is shown regardless
        body: JSON.stringify({ email, callbackUrl: rawCallback ?? undefined }),
      })
      setMagicSent(true)
      setCode("")
      setCodeError("")
      setResendCooldown(true)
      setTimeout(() => setResendCooldown(false), 30_000)
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setMagicLoading(false)
    }
  }

  const verifyCode = async (value: string) => {
    setCodeLoading(true)
    setCodeError("")
    try {
      const result = await signIn("magic", { email, code: value, redirect: false })
      if (result?.error) {
        setCodeError("That code didn't work. Check the newest email, or resend below.")
      } else {
        window.location.href = callbackUrl
      }
    } catch {
      setCodeError("Something went wrong. Please try again.")
    } finally {
      setCodeLoading(false)
    }
  }

  const handleCodeChange = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, 6)
    setCode(digits)
    if (digits.length === 6 && !codeLoading) void verifyCode(digits)
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="border-ink-100 shadow-panel w-full max-w-md rounded-[30px] border bg-white/95 p-8 backdrop-blur-xl">
        {magicSent ? (
          <>
            <div className="mb-6 text-center">
              <div className="border-gold-100 bg-gold-50 text-gold-600 mb-3 inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em]">
                Check your email
              </div>
            </div>
            <h1 className="text-ink-950 mb-2 text-center text-3xl font-bold">We sent you a link</h1>
            <p className="text-ink-500 mb-6 text-center text-sm">
              If an account exists for <span className="text-ink-700 font-semibold">{email}</span>,
              a sign-in link is on its way. Tap it — or enter the 6-digit code from the email
              below. It expires in 15 minutes.
            </p>

            {codeError && (
              <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                {codeError}
              </div>
            )}

            <label htmlFor="magic-code" className="text-ink-700 block text-sm font-medium">
              6-digit code
            </label>
            <input
              id="magic-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => handleCodeChange(e.target.value)}
              disabled={codeLoading}
              placeholder="••••••"
              className={`${inputClass} text-center font-mono text-2xl tracking-[0.5em]`}
              autoFocus
            />
            <p className="text-ink-400 mt-2 text-center text-xs">
              {codeLoading ? "Checking…" : "The code verifies automatically"}
            </p>

            <div className="mt-6 flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={() => {
                  setMagicSent(false)
                  setError("")
                }}
                className="text-ink-600 hover:text-ink-950 font-semibold"
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={() => void requestMagicLink()}
                disabled={magicLoading || resendCooldown}
                className="text-play-600 hover:text-play-700 disabled:text-ink-300 font-semibold"
              >
                {resendCooldown ? "Sent — wait a moment" : "Resend email"}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="mb-6 text-center">
              <div className="border-play-100 bg-play-50 text-play-600 mb-3 inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em]">
                Welcome Back
              </div>
            </div>

            <h1 className="text-ink-950 mb-2 text-center text-3xl font-bold">Sign in</h1>
            <p className="text-ink-500 mb-6 text-center text-sm">
              Games, schedules, and your teams — right where you left them.
            </p>

            {error && (
              <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                {error}
              </div>
            )}

            {googleEnabled && (
              <>
                <GoogleButton
                  label="Continue with Google"
                  onClick={() => void signIn("google", { callbackUrl })}
                />
                <div className="my-5 flex items-center gap-3">
                  <div className="bg-ink-100 h-px flex-1" />
                  <span className="text-ink-400 text-xs font-medium uppercase tracking-wider">
                    or
                  </span>
                  <div className="bg-ink-100 h-px flex-1" />
                </div>
              </>
            )}

            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="text-ink-700 block text-sm font-medium">
                  Email
                </label>
                <input
                  id="email"
                  ref={emailRef}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className={inputClass}
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="text-ink-700 block text-sm font-medium">
                    Password
                  </label>
                  <Link
                    href="/forgot-password"
                    className="text-play-600 hover:text-play-700 text-sm font-semibold"
                  >
                    Forgot password?
                  </Link>
                </div>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className={inputClass}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="bg-ink-950 hover:bg-ink-800 disabled:bg-ink-300 w-full rounded-2xl px-4 py-3 font-semibold text-white transition disabled:cursor-not-allowed"
              >
                {loading ? "Signing in..." : "Sign in"}
              </button>
            </form>

            <button
              type="button"
              onClick={() => void requestMagicLink()}
              disabled={magicLoading}
              className="border-ink-200 text-ink-700 hover:bg-ink-50 disabled:text-ink-300 mt-3 w-full rounded-2xl border px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed"
            >
              {magicLoading ? "Sending…" : "✨ Email me a sign-in link instead"}
            </button>

            <p className="text-ink-500 mt-6 text-center text-sm">
              Don&apos;t have an account?{" "}
              <Link
                href={
                  rawCallback
                    ? `/sign-up?callbackUrl=${encodeURIComponent(rawCallback)}`
                    : "/sign-up"
                }
                className="text-play-600 hover:text-play-700 font-semibold"
              >
                Sign up
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
