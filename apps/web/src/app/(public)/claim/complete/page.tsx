import { Metadata } from "next"
import { CompleteClaim } from "./complete-claim"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Take ownership of your club — SportsHub",
  robots: { index: false },
}

/**
 * Completion-token landing (owner 2026-07-18): redeeming the token binds the
 * verified claim to the signed-in USER. Not signed in → sign in / register
 * first (any email), then come back here via callbackUrl.
 */
export default function ClaimCompletePage({
  searchParams,
}: {
  searchParams: { token?: string }
}) {
  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <CompleteClaim token={searchParams.token ?? ""} />
    </div>
  )
}
