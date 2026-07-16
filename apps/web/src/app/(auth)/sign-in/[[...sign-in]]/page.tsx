import { Suspense } from "react"
import { appleWebEnabled } from "@/lib/apple-web-auth"
import { SignInForm } from "./sign-in-form"

// Server component so the social buttons render exactly when each provider
// is configured (env-gated in lib/auth.ts) — no client round-trip to
// /providers.
export default function SignInPage() {
  const googleEnabled = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
  return (
    <Suspense>
      <SignInForm googleEnabled={googleEnabled} appleEnabled={appleWebEnabled()} />
    </Suspense>
  )
}
