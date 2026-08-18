import { Suspense } from "react"
import Link from "next/link"
import { appleWebEnabled } from "@/lib/apple-web-auth"
import { PUBLIC_SIGNUPS } from "@/lib/public-flags"
import { SignUpForm } from "./sign-up-form"

// Server component so the social buttons render exactly when each provider
// is configured (env-gated in lib/auth.ts) — no client round-trip to
// /providers.
//
// Pre-launch (PUBLIC_SIGNUPS=false): the form only renders for the two
// funnels allowed to mint accounts — club-claim completion (token in the
// callbackUrl) and email invitations (?email= from an invite link). Anyone
// else gets the join-the-list card. The signup API enforces the same rule
// server-side; this page is the polite face of it.
export default function SignUpPage({
  searchParams,
}: {
  searchParams: { callbackUrl?: string; email?: string }
}) {
  const googleEnabled = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)

  let claimToken: string | null = null
  const cb = searchParams.callbackUrl
  if (cb?.startsWith("/claim/complete")) {
    try {
      claimToken = new URL(cb, "http://x").searchParams.get("token")
    } catch {
      claimToken = null
    }
  }
  const invited = !!searchParams.email
  const open = PUBLIC_SIGNUPS || !!claimToken || invited

  if (!open) {
    return (
      <div>
        <div className="border-ink-100 shadow-panel w-full rounded-[30px] border bg-white/95 p-8 backdrop-blur-xl sm:p-10">
          <div className="mb-6 text-center">
            <div className="border-hoop-100 bg-hoop-50 text-hoop-600 mb-3 inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em]">
              Invite-only until launch
            </div>
          </div>
          <h1 className="text-ink-950 mb-2 text-center text-[2rem] font-bold leading-tight">
            Accounts open at launch.
          </h1>
          <p className="text-ink-500 mb-6 text-center text-sm">
            We&apos;re not taking signups yet. Already have an account? Log in below.
            New here? Leave your email or phone number on the homepage and you&apos;ll
            get one message the day the doors open.
          </p>
          <div className="space-y-3">
            <Link
              href="/sign-in"
              className="bg-play-600 hover:bg-play-700 block w-full rounded-full px-6 py-3 text-center text-sm font-bold text-white"
            >
              Log in
            </Link>
            <Link
              href="/"
              className="bg-gold-500 hover:bg-gold-600 text-ink-950 block w-full rounded-full px-6 py-3 text-center text-sm font-bold"
            >
              Join the launch list
            </Link>
            <Link
              href="/demos"
              className="border-ink-200 text-ink-700 hover:bg-ink-50 block w-full rounded-full border px-6 py-3 text-center text-sm font-semibold"
            >
              Watch the demos meanwhile
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <Suspense>
      <SignUpForm
        googleEnabled={googleEnabled && PUBLIC_SIGNUPS}
        appleEnabled={appleWebEnabled() && PUBLIC_SIGNUPS}
        claimToken={claimToken}
      />
    </Suspense>
  )
}
