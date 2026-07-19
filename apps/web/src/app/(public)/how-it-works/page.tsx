import Link from "next/link"
import { DemoPlayer } from "@/components/demo/demo-player"
import { SEASON_SCENES } from "@/components/demo/scenes-season"

export const metadata = {
  title: "How It Works | One Season, Start to Finish",
  alternates: { canonical: "/how-it-works" },
  description:
    "One season, told start to finish: a club posts a tryout, a family signs up and pays, the league schedules, the games go live, the recaps write themselves.",
}

export default function HowItWorksPage() {
  return (
    <>
      <section className="mesh-surface border-ink-100 border-b bg-[#fafafa] py-16 sm:py-20">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="mx-auto max-w-3xl text-center">
            <div className="bg-play-50 text-play-700 mb-5 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider">
              How it works
            </div>
            <h1 className="font-display text-ink-950 mb-6 text-balance text-4xl font-extrabold leading-tight sm:text-5xl">
              One season,{" "}
              <span className="from-play-600 to-hoop-500 bg-gradient-to-r bg-clip-text text-transparent">
                start to finish
              </span>
            </h1>
            <p className="text-ink-500 mx-auto mb-4 max-w-2xl text-lg leading-8">
              Watch the baton pass: the club posts a tryout, a family signs up and pays, the
              league builds the schedule, the games go live and the recaps write themselves.
              Every step is tagged with who&apos;s doing it. Use the filter to follow just your
              seat.
            </p>
            <p className="text-ink-400 text-sm">
              These are not videos. Every screen is the real design system running demo data.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-white py-12 sm:py-16">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="mx-auto max-w-4xl">
            <DemoPlayer title="One season, start to finish" scenes={SEASON_SCENES} />
          </div>
        </div>
      </section>

      <section className="bg-[#fafafa] py-16 sm:py-20">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="from-play-600 via-play-700 to-ink-950 rounded-[34px] bg-gradient-to-br px-8 py-12 text-white sm:px-12">
            <div className="max-w-3xl">
              <h2 className="mb-4 text-3xl font-bold sm:text-4xl">Now run it for real.</h2>
              <p className="text-play-100 mb-8 max-w-2xl leading-7">
                Everything you just watched is live today. Claim your club, publish a tryout, or
                open your league&apos;s next season.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/sign-up"
                  className="text-ink-950 hover:bg-ink-50 inline-flex items-center justify-center rounded-2xl bg-white px-6 py-3.5 text-sm font-semibold transition"
                >
                  Create your free account
                </Link>
                <Link
                  href="/for-clubs"
                  className="inline-flex items-center justify-center rounded-2xl border border-white/20 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  Clubs: see your walkthroughs &rarr;
                </Link>
                <Link
                  href="/events"
                  className="inline-flex items-center justify-center rounded-2xl border border-white/20 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  Families: find a program &rarr;
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
