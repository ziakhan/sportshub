import { ParentLiveDemo } from "@/components/flow-demo/live"
import { MobileDesktopNotice } from "@/components/flow-demo/mobile-notice"

export const metadata = {
  title: "Watch the Parent Side | Tryout to Game Day | SportsHub One",
  alternates: { canonical: "/demo/parents" },
  description:
    "Watch a parent's whole season run: find the tryout, sign up and pay, accept the offer, live on your calendar with RSVPs, and game day with a box score that updates itself.",
}

export default function ParentDemoPage() {
  return (
    <section className="bg-[#fafafa] py-8 sm:py-14">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="mx-auto mb-8 max-w-2xl text-center">
          <p className="text-hoop-600 text-sm font-bold uppercase tracking-[0.18em]">
            The parent side, played out
          </p>
          <h1 className="font-display text-ink-950 mt-2 text-3xl font-extrabold sm:text-4xl">
            Watch Maria&apos;s season run
          </h1>
          <p className="text-ink-500 mt-3 text-base leading-7 sm:text-lg sm:leading-8">
            From finding the tryout to a game day box score that moves on its own, every screen
            is the real product.
          </p>
        </div>
        <div className="mx-auto max-w-5xl">
          <MobileDesktopNotice />
          <ParentLiveDemo />
        </div>
      </div>
    </section>
  )
}
