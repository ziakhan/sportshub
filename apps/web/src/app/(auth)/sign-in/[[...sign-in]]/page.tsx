import { Suspense } from "react"
import { SignInForm } from "./sign-in-form"

// Server component so the Google button renders exactly when the provider is
// configured (env-gated in lib/auth.ts) — no client round-trip to /providers.
export default function SignInPage() {
  const googleEnabled = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
  return (
    <Suspense>
      <SignInForm googleEnabled={googleEnabled} />
    </Suspense>
  )
}
