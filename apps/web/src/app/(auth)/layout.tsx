import { Suspense } from "react"
import Link from "next/link"
import { BrandWordmark } from "@/components/brand/wordmark"
import { CourtBackdropLayer } from "@/components/ui"
import { AuthBrandPanel } from "./auth-brand-panel"

/**
 * Split-screen auth shell (2026-08-13). Was a 448px card centred on a pale
 * mesh — on a 1440px monitor ~70% of the screen did nothing. Shared by all
 * five auth routes (sign-in, sign-up, forgot-password, reset-password,
 * magic-link), so this lifts every one at once.
 *
 * The panel is a client component (it reads the demo persona out of
 * ?callbackUrl to target its pitch) so it sits behind Suspense.
 */

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    /**
     * FLEX, not grid (2026-08-13). The grid version relied on the panel's
     * `hidden`/`lg:flex` agreeing with `lg:grid-cols-[1fr_1fr]`; if the panel
     * ever failed to claim its column the form could end up in a zero-width
     * track and the page looked empty. Flex with an explicit basis on the
     * panel and `flex-1 min-w-0` on the form means the FORM SIDE ALWAYS HAS
     * WIDTH, at every viewport, whatever the panel does.
     */
    <div className="flex min-h-screen w-full">
      <Suspense
        fallback={
          <aside className="hidden shrink-0 basis-1/2 bg-gradient-to-br from-[#4338ca] via-[#2f2d78] to-[#1b1a3d] lg:block" />
        }
      >
        <AuthBrandPanel />
      </Suspense>

      {/* ── Form side ──────────────────────────────────────────────────── */}
      {/* `overflow-hidden` is LOad-BEARING, not cosmetic: the decorative layer
          below paints glows that reach past the box. Unclipped they widen the
          document past the viewport, the page gains a horizontal scrollbar, and
          scrolling into that gutter shows a bare strip with no content — which
          is exactly what the layout "disappearing" at non-desktop widths was
          (owner, 2026-08-13). */}
      <main className="bg-ink-50/70 relative flex min-h-screen w-full min-w-0 flex-1 flex-col items-center justify-center overflow-hidden px-4 py-10 sm:px-8 lg:px-12">
        {/* Phones and tablets get the navy court instead of a pale void; the
            desktop brand panel already carries the brand on wide screens. */}
        <CourtBackdropLayer variant="navy" className="lg:hidden" />

        {/* Mobile keeps the wordmark — the brand panel is desktop-only */}
        <div className="relative z-10 mb-8 flex flex-col items-center text-center lg:hidden">
          <Link href="/" aria-label="SportsHub ONE, back to home" className="inline-block">
            <BrandWordmark size="lg" variant="reverse" />
          </Link>
          <p className="mx-auto mt-3 max-w-sm text-sm text-white/70">
            The complete platform for youth basketball clubs, leagues, and families.
          </p>
        </div>

        {/* Wider than the old 448px: research on form width says a signup form
            should own its column rather than float as a narrow card in it. */}
        <div className="relative z-10 w-full max-w-[30rem]">{children}</div>
      </main>
    </div>
  )
}
