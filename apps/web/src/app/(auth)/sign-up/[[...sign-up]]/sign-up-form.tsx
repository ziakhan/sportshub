"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { AppleButton } from "@/components/auth/apple-button"
import { GoogleButton } from "@/components/auth/google-button"

function safeCallbackUrl(raw: string | null | undefined): string | null {
  if (!raw) return null
  return raw.startsWith("/") && !raw.startsWith("//") ? raw : null
}

const inputClass =
  // Roomier than the old px-3/py-3: single-column forms shouldn't get much
  // WIDER than ~480px, so presence comes from scale — taller targets, larger
  // text — not from stretching the column.
  "border-ink-200 text-ink-950 placeholder-ink-400 focus:border-play-400 focus:ring-play-500/10 mt-1.5 block w-full rounded-2xl border bg-white px-4 py-3.5 text-[15.5px] focus:outline-none focus:ring-4"

export function SignUpForm({
  googleEnabled,
  appleEnabled,
  claimToken,
}: {
  googleEnabled: boolean
  appleEnabled: boolean
  /** Club-claim completion token: unlocks signup while public signups are
   * closed (the API checks it; the form just carries it through). */
  claimToken?: string | null
}) {
  const searchParams = useSearchParams()
  const callbackUrl = safeCallbackUrl(searchParams?.get("callbackUrl"))
  // Invited people arrive with the address the invitation was sent to —
  // signing up with a different one silently orphans the invite.
  const invitedEmail = searchParams?.get("email") ?? ""
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState(invitedEmail)
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [platformMarketingConsent, setPlatformMarketingConsent] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  // Google users skip onboarding's callbackUrl handling here — NextAuth's
  // newUser page (/onboarding) picks them up after the OAuth round-trip.
  const googleCallback = callbackUrl
    ? `/onboarding?callbackUrl=${encodeURIComponent(callbackUrl)}`
    : "/onboarding"

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (password.length < 8) {
      setError("Password must be at least 8 characters")
      return
    }

    setLoading(true)
    setError("")

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          firstName,
          lastName,
          platformMarketingConsent,
          claimToken: claimToken || undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Something went wrong")
        return
      }

      // Auto sign-in after successful registration
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        setError("Account created but sign-in failed. Please sign in manually.")
      } else {
        // Carry the intended destination through onboarding — its final
        // redirect honors callbackUrl instead of parking users on dashboard.
        window.location.href = callbackUrl
          ? `/onboarding?callbackUrl=${encodeURIComponent(callbackUrl)}`
          : "/onboarding"
      }
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  // Centring + width now come from the split auth shell (layout.tsx)
  return (
    <div>
      <div className="border-ink-100 shadow-panel w-full rounded-[30px] border bg-white/95 p-8 backdrop-blur-xl sm:p-10">
        <div className="mb-6 text-center">
          <div className="border-hoop-100 bg-hoop-50 text-hoop-600 mb-3 inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em]">
            Join Sportshub
          </div>
        </div>

        <h1 className="text-ink-950 mb-2 text-center text-[2rem] font-bold leading-tight">
          Create your account
        </h1>
        <p className="text-ink-500 mb-6 text-center text-sm">
          One account for every team, club, and league in the family.
        </p>

        {error && (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {(googleEnabled || appleEnabled) && (
          <>
            <div className="space-y-3">
              {googleEnabled && (
                <GoogleButton
                  label="Sign up with Google"
                  onClick={() => void signIn("google", { callbackUrl: googleCallback })}
                />
              )}
              {appleEnabled && (
                <AppleButton
                  label="Sign up with Apple"
                  onClick={() => void signIn("apple", { callbackUrl: googleCallback })}
                />
              )}
            </div>
            <div className="my-5 flex items-center gap-3">
              <div className="bg-ink-100 h-px flex-1" />
              <span className="text-ink-400 text-xs font-medium uppercase tracking-wider">or</span>
              <div className="bg-ink-100 h-px flex-1" />
            </div>
          </>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="firstName" className="text-ink-700 block text-sm font-medium">
                First Name
              </label>
              <input
                id="firstName"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                autoComplete="given-name"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="lastName" className="text-ink-700 block text-sm font-medium">
                Last Name
              </label>
              <input
                id="lastName"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                autoComplete="family-name"
                className={inputClass}
              />
            </div>
          </div>

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
              autoComplete="email"
              inputMode="email"
              className={inputClass}
              placeholder="you@example.com"
            />
            {invitedEmail ? (
              <p className="text-ink-500 mt-1 text-xs">
                This is the address your invitation was sent to. Keep it and the invitation will
                be waiting when you land.
              </p>
            ) : null}
          </div>

          {/* One password field with a reveal, not two (2026-08-13). A confirm
              field measurably raises abandonment and stops catching typos the
              moment the user can SEE what they typed. */}
          <div>
            <label htmlFor="password" className="text-ink-700 block text-sm font-medium">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                className={`${inputClass} pr-12`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="text-ink-400 hover:text-ink-700 absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold uppercase tracking-wide transition"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            <p className="text-ink-400 mt-1 text-xs">At least 8 characters.</p>
          </div>

          <label htmlFor="platformMarketingConsent" className="flex items-start gap-2.5">
            <input
              id="platformMarketingConsent"
              type="checkbox"
              checked={platformMarketingConsent}
              onChange={(e) => setPlatformMarketingConsent(e.target.checked)}
              className="border-ink-300 text-play-600 focus:ring-play-500/20 mt-0.5 h-4 w-4 rounded"
            />
            <span className="text-ink-600 text-sm">Send me occasional news about SportsHub</span>
          </label>

          <button
            type="submit"
            disabled={loading}
            className="bg-ink-950 hover:bg-ink-800 disabled:bg-ink-300 w-full rounded-2xl px-4 py-4 text-[16px] font-semibold text-white transition disabled:cursor-not-allowed"
          >
            {loading ? "Creating account..." : "Create Account"}
          </button>

          {/* Terms + privacy were absent entirely — on a platform holding
              children's data (COPPA) that is a legal gap, not a design nit. */}
          <p className="text-ink-400 text-center text-xs leading-5">
            By creating an account you agree to our{" "}
            <Link href="/legal/terms" className="text-ink-600 font-semibold underline">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/legal/privacy" className="text-ink-600 font-semibold underline">
              Privacy Policy
            </Link>
            .
          </p>
        </form>

        <p className="text-ink-500 mt-6 text-center text-sm">
          Already have an account?{" "}
          <Link
            href={
              callbackUrl ? `/sign-in?callbackUrl=${encodeURIComponent(callbackUrl)}` : "/sign-in"
            }
            className="text-play-600 hover:text-play-700 font-semibold"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
