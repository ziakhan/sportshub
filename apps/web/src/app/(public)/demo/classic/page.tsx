import type { Metadata } from "next"
import { LiveDemoClassic } from "@/components/flow-demo/live-classic"
import { MobileDesktopNotice } from "@/components/flow-demo/mobile-notice"

/**
 * The previous demo, frozen (owner 2026-08-11): the season walkthrough as it
 * was before the scheduling redesign. Unlisted on purpose — nothing links
 * here; the owner shares the URL when he wants the old version seen.
 */
export const metadata: Metadata = {
  title: "Product demo, previous version | SportsHub One",
  robots: { index: false, follow: false },
}

export default function ClassicDemoPage() {
  return (
    <section className="bg-[#fafafa] py-10 sm:py-14">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="mx-auto mb-8 max-w-2xl text-center">
          <h1 className="font-display text-ink-950 text-4xl font-extrabold">
            The previous demo, kept as it was
          </h1>
          <p className="text-ink-500 mt-3 text-lg leading-8">
            This is the season walkthrough before the scheduling redesign. The current demo lives
            at /demo.
          </p>
        </div>
        <div className="mx-auto max-w-5xl">
          <MobileDesktopNotice />
          <LiveDemoClassic />
        </div>
      </div>
    </section>
  )
}
