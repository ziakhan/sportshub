import { HowItWorksDemo } from "@/components/flow-demo/flows"

export const metadata = {
  title: "How It Works | A Whole Season, Step by Step | SportsHub One",
  alternates: { canonical: "/how-it-works" },
  description:
    "Walk a whole season the way it actually runs: league setup, club tryouts, offers and payments, roster submission, live scoring, recaps, and playoffs.",
}

export default function HowItWorksPage() {
  return (
    <section className="bg-[#fafafa] py-10 sm:py-14">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="mx-auto mb-8 max-w-2xl text-center">
          <h1 className="font-display text-ink-950 text-4xl font-extrabold">
            A whole season, step by step
          </h1>
          <p className="text-ink-500 mt-3 text-lg leading-8">
            This is the real product, screen by screen, from the league opening registration to
            the championship recap. Go through the steps at your own pace: read as long as you
            want, then click the glowing button to continue, exactly like using the app.
          </p>
        </div>
        <HowItWorksDemo />
      </div>
    </section>
  )
}
