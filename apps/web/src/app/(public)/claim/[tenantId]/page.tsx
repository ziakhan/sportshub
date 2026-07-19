import { Metadata } from "next"
import { ClaimWizard } from "./claim-wizard"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Claim your club — SportsHub",
  robots: { index: false },
}

/**
 * Public, anonymous claim page (owner 2026-07-18: claim-first,
 * account-at-end). The wizard fetches its own options — no session needed.
 */
export default function ClaimClubPage({ params }: { params: { tenantId: string } }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <ClaimWizard tenantId={params.tenantId} />
    </div>
  )
}
