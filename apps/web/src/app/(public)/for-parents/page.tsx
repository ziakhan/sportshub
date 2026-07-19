import Link from "next/link"
import { ParentDemo } from "@/components/flow-demo/flows"

export const metadata = {
  title: "For Parents & Players | Signups, Live Scores & Your Kid's Season | SportsHub One",
  alternates: { canonical: "/for-parents" },
  description:
    "The family side, shown as it really works: find tryouts, sign up and pay in minutes, accept offers with payment plans, then follow every game live with box scores, standings, recaps and team chat.",
}

export default function ForParentsPage() {
  return (
    <section className="bg-[#fafafa] py-10 sm:py-14">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="mx-auto mb-8 max-w-2xl text-center">
          <p className="text-court-600 text-sm font-bold uppercase tracking-[0.18em]">
            For parents &amp; players
          </p>
          <h1 className="font-display text-ink-950 mt-2 text-4xl font-extrabold">
            Your kid&apos;s whole season, on your phone
          </h1>
          <p className="text-ink-500 mt-3 text-lg leading-8">
            Not just the signups and the fees. Live scores while you&apos;re stuck at work, the box
            score on the drive home, the recap at the kitchen table, and the team chat where the
            dinner gets planned. Every screen here is the real product. Click the glowing button
            to move through it.
          </p>
          <a href="/demo/parents" className="from-play-600 to-hoop-500 shadow-play-600/25 mt-5 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:brightness-105">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current"><path d="M8 5v14l11-7z" /></svg>
            Watch your season run
          </a>
        </div>
        <ParentDemo />
        <p className="text-ink-400 mt-10 text-center text-sm">
          Run a club? <Link href="/for-clubs" className="text-play-700 font-semibold">See the club side</Link>.
          Run a league? <Link href="/for-leagues" className="text-play-700 font-semibold">See the league side</Link>.
        </p>
      </div>
    </section>
  )
}
