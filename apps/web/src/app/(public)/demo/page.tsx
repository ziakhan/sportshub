import { LiveDemo } from "@/components/flow-demo/live"
import { MobileDesktopNotice } from "@/components/flow-demo/mobile-notice"

export const metadata = {
  title: "Watch It Run | Signup to Final Whistle | SportsHub One",
  alternates: { canonical: "/demo" },
  description:
    "Watch the real product run end to end: a club builds its team through tryouts and offers, the league opens a season and schedules every game, a referee takes the day, and game night is scored live to every phone, down to the signed scoresheet.",
}

export default function DemoPage() {
  return (
    <section className="bg-[#fafafa] py-10 sm:py-14">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="mx-auto mb-8 max-w-2xl text-center">
          <h1 className="font-display text-ink-950 text-4xl font-extrabold">
            Watch it run, end to end
          </h1>
          <p className="text-ink-500 mt-3 text-lg leading-8">
            This plays like the real thing: dropdowns open, forms fill in, checkmarks land. Each
            step acts itself out, then the glowing button waits for you. Click it to keep the
            season moving, or hit Autoplay and just watch.
          </p>
        </div>
        <div className="mx-auto max-w-5xl">
          <MobileDesktopNotice />
          <LiveDemo />
        </div>
      </div>
    </section>
  )
}
