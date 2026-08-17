import Link from "next/link"
import { CourtBackdrop } from "@/components/ui"
import { BrandWordmark } from "@/components/brand/wordmark"
import { ClaimWizard } from "@/app/(public)/claim/[tenantId]/claim-wizard"

export const dynamic = "force-dynamic"

/**
 * The chrome-free claim page (owner 2026-08-17). Same wizard as the in-site
 * claim route, but the only navigation on the page is the wordmark back to
 * the landing: pre-launch, claiming is the whole job here.
 */
export default function ClaimClubStandalonePage({
  params,
}: {
  params: { tenantId: string }
}) {
  return (
    <CourtBackdrop
      variant="daylight"
      floor="planks"
      intensity="immersive"
      className="min-h-[100dvh]"
    >
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 pt-6">
        <Link
          href="/"
          className="inline-flex items-center rounded-lg outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-gold-500/70"
          aria-label="SportsHub One home"
        >
          <BrandWordmark size="sm" />
        </Link>
        <span className="text-[13px] font-bold uppercase tracking-[0.14em] text-hoop-600">
          Launching this fall
        </span>
      </header>

      <div className="mx-auto max-w-xl px-4 py-10">
        <ClaimWizard tenantId={params.tenantId} />
      </div>

      <p className="text-ink-500 mx-auto max-w-xl px-4 pb-10 text-center text-[14px]">
        Questions? Reply to any email we send, or claim now and we&apos;ll walk you through the
        rest before launch.
      </p>
    </CourtBackdrop>
  )
}
