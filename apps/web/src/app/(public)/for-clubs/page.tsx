import Link from "next/link"
import { ClubDemo } from "@/components/flow-demo/flows"

export const metadata = {
  title: "For Clubs | Tryouts, Offers, Payments & Live Scoring | SportsHub One",
  alternates: { canonical: "/for-clubs" },
  description:
    "Everything a club runs, shown as it really works: claim your page, build teams and staff, run tryouts, send offers with payment plans, finalize rosters, enter leagues, and score games live.",
}

export default function ForClubsPage() {
  return (
    <section className="bg-[#fafafa] py-10 sm:py-14">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="mx-auto mb-8 max-w-2xl text-center">
          <p className="text-hoop-600 text-sm font-bold uppercase tracking-[0.18em]">For clubs</p>
          <h1 className="font-display text-ink-950 mt-2 text-4xl font-extrabold">
            Everything your club runs, shown for real
          </h1>
          <p className="text-ink-500 mt-3 text-lg leading-8">
            No feature list. This is the product itself, screen by screen: claiming your club
            page, building the team, tryouts and check-in, offers both ways, payments, league
            entry, and game day. Go at your own pace and click the glowing button to continue.
          </p>
          <a href="/demo" className="from-play-600 to-hoop-500 shadow-play-600/25 mt-5 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:brightness-105">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current"><path d="M8 5v14l11-7z" /></svg>
            Watch the full demo
          </a>
        </div>
        <ClubDemo />
        <p className="text-ink-400 mt-10 text-center text-sm">
          Run a league instead? <Link href="/for-leagues" className="text-play-700 font-semibold">See the league side</Link>.
          Just here for your player? <Link href="/for-parents" className="text-play-700 font-semibold">See the family side</Link>.
        </p>
      </div>
    </section>
  )
}
