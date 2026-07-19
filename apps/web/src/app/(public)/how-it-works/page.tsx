import Link from "next/link"
import { SectionHeader } from "@/components/ui"
import { DemoPlayer } from "@/components/demo/demo-player"
import { PARENT_SCENES } from "@/components/demo/scenes-parent"
import { CLUB_SCENES } from "@/components/demo/scenes-club"
import { LEAGUE_SCENES } from "@/components/demo/scenes-league"

export const metadata = {
  title: "How It Works | From First Tryout to the Championship",
  alternates: { canonical: "/how-it-works" },
  description:
    "Watch the whole platform work: families find and pay for tryouts, clubs run offers and rosters, leagues schedule and score a full season, step by step.",
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
              The whole season,{" "}
              <span className="from-play-600 to-hoop-500 bg-gradient-to-r bg-clip-text text-transparent">
                played out in front of you
              </span>
            </h1>
            <p className="text-ink-500 mx-auto mb-8 max-w-2xl text-lg leading-8">
              These are not videos. Every screen below is the real design system running demo
              data. Press play, pause anywhere, or jump to any step.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <a href="#parents" className="bg-hoop-50 text-hoop-700 hover:bg-hoop-100 rounded-full px-4 py-2 text-sm font-bold transition-colors">
                Parents &amp; players
              </a>
              <a href="#clubs" className="bg-play-50 text-play-700 hover:bg-play-100 rounded-full px-4 py-2 text-sm font-bold transition-colors">
                Clubs
              </a>
              <a href="#leagues" className="bg-ink-100 text-ink-700 hover:bg-ink-200 rounded-full px-4 py-2 text-sm font-bold transition-colors">
                Leagues
              </a>
            </div>
          </div>
        </div>
      </section>

      <section id="parents" className="scroll-mt-24 bg-white py-14 sm:py-16">
        <div className="container mx-auto px-4 sm:px-6">
          <SectionHeader
            eyebrow="For parents & players"
            title="Discover, register, pay. Then just follow the season"
            accent="hoop"
            align="center"
            className="mb-8"
          />
          <div className="mx-auto max-w-3xl">
            <DemoPlayer title="Parent journey walkthrough" scenes={PARENT_SCENES} />
          </div>
        </div>
      </section>

      <section id="clubs" className="scroll-mt-24 bg-[#fafafa] py-14 sm:py-16">
        <div className="container mx-auto px-4 sm:px-6">
          <SectionHeader
            eyebrow="For clubs"
            title="From claimed club to a paid, locked roster"
            accent="play"
            align="center"
            className="mb-8"
          />
          <div className="mx-auto max-w-3xl">
            <DemoPlayer title="Club journey walkthrough" scenes={CLUB_SCENES} />
          </div>
        </div>
      </section>

      <section id="leagues" className="scroll-mt-24 bg-white py-14 sm:py-16">
        <div className="container mx-auto px-4 sm:px-6">
          <SectionHeader
            eyebrow="For leagues"
            title="Season, schedule, referees, standings. End to end"
            accent="court"
            align="center"
            className="mb-8"
          />
          <div className="mx-auto max-w-3xl">
            <DemoPlayer title="League journey walkthrough" scenes={LEAGUE_SCENES} />
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
