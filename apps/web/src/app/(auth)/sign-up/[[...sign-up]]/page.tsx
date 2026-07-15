import { Suspense } from "react"
import { SignUpForm } from "./sign-up-form"

// Server component so the Google button renders exactly when the provider is
// configured (env-gated in lib/auth.ts) — no client round-trip to /providers.
export default function SignUpPage() {
  const googleEnabled = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
  return (
    <Suspense>
      <SignUpForm googleEnabled={googleEnabled} />
    </Suspense>
  )
}
