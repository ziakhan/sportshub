import Link from "next/link"
import { SectionHeader } from "@/components/ui"
import { DemoPlayer } from "@/components/demo/demo-player"
import { LEAGUE_SCENES } from "@/components/demo/scenes-league"

export const metadata = {
  title: "For Leagues | Scheduling, Live Scoring & Standings for Youth Basketball",
  alternates: { canonical: "/for-leagues" },
  description:
    "Registration, rosters, scheduling, live scoring, standings and stat leaders. A complete operating system for youth basketball leagues.",
}

const FEATURES = [
  {
    title: "Team registration & rosters",
    body: "Clubs register and pay online, submit rosters once, and rosters freeze on finalization. A clean paper trail with zero chasing.",
    tone: "bg-play-600 shadow-play-200",
    icon: (
      <>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
  },
  {
    title: "Scheduling that solves itself",
    body: "Divisions, sessions, venues, courts and blackouts go in. A full season schedule comes out, with a capacity planner that shows what fits.",
    tone: "bg-sky-500 shadow-sky-200",
    icon: (
      <>
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </>
    ),
  },
  {
    title: "Live scoring & official scoresheets",
    body: "Scorekeepers run games from a phone. Referee sign-off, server-generated PDF scoresheets, and box scores families watch live.",
    tone: "bg-hoop-500 shadow-hoop-200",
    icon: <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />,
  },
  {
    title: "Standings & stat leaders",
    body: "Standings with your tiebreaker rules, plus points, rebounds and assists leaders published automatically after every game.",
    tone: "bg-gold-500 shadow-gold-200",
    icon: (
      <>
        <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16" />
        <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
      </>
    ),
  },
  {
    title: "Automatic game recaps",
    body: "Every scored game becomes a newspaper-style recap on your league's public pages. Content your families share, written for you.",
    tone: "bg-violet-500 shadow-violet-200",
    icon: (
      <>
        <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-4 0V6" />
        <path d="M12 6h6M12 10h6M12 14h6M12 18h6" />
      </>
    ),
  },
  {
    title: "League fees, handled",
    body: "Collect team fees online or record offline payments. Every obligation tracked, every payment reported the same way.",
    tone: "bg-court-600 shadow-court-200",
    icon: <path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />,
  },
]

export default function ForLeaguesPage() {
  return (
    <>
      <section className="mesh-surface border-ink-100 border-b bg-[#fafafa] py-20 sm:py-24">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="mx-auto max-w-3xl text-center">
            <div className="bg-court-50 text-court-700 mb-5 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider">
              For leagues
            </div>
            <h1 className="font-display text-ink-950 mb-6 text-balance text-4xl font-extrabold leading-tight sm:text-5xl">
              A season of games,{" "}
              <span className="from-court-600 to-play-600 bg-gradient-to-r bg-clip-text text-transparent">
                organized end to end
              </span>
            </h1>
            <p className="text-ink-500 mx-auto mb-10 max-w-2xl text-lg leading-8">
              Registration, rosters, scheduling, live scoring, standings, stat leaders and
              automatic recaps. Everything a league needs to run competitive play, with a public
              face families check every week.
            </p>
            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/sign-up"
                className="bg-ink-950 hover:bg-ink-800 inline-flex items-center justify-center rounded-2xl px-7 py-3.5 text-[15px] font-semibold text-white shadow-lg transition"
              >
                Start your league free
              </Link>
              <Link
                href="/leagues"
                className="border-ink-200 text-ink-700 hover:bg-ink-50 inline-flex items-center justify-center rounded-2xl border bg-white px-7 py-3.5 text-[15px] font-semibold transition"
              >
                Browse leagues
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white py-14 sm:py-16">
        <div className="container mx-auto px-4 sm:px-6">
          <SectionHeader
            eyebrow="Watch it work"
            title="Season, schedule, referees, standings. End to end"
            accent="court"
            align="center"
            className="mb-8"
          />
          <div className="mx-auto max-w-3xl">
            <DemoPlayer title="League journey walkthrough" scenes={LEAGUE_SCENES} />
            <p className="text-ink-400 mt-3 text-center text-sm">
              Every screen here is the real design system with demo data. Press play or step through.{" "}
              <Link href="/how-it-works" className="text-play-600 font-semibold">
                See the parent and club journeys &rarr;
              </Link>
            </p>
          </div>
        </div>
      </section>

      <section className="bg-white py-16 sm:py-20">
        <div className="container mx-auto px-4 sm:px-6">
          <SectionHeader
            eyebrow="The whole operation"
            title="From registration night to the championship"
            accent="court"
            align="center"
            className="mb-12"
          />
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="card-lift border-ink-100 shadow-soft rounded-[24px] border bg-white p-6">
                <span className={`mb-4 flex h-11 w-11 items-center justify-center rounded-2xl shadow-lg ${f.tone}`}>
                  <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    {f.icon}
                  </svg>
                </span>
                <h3 className="text-ink-950 mb-1.5 text-lg font-bold">{f.title}</h3>
                <p className="text-ink-500 text-sm leading-6">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#fafafa] py-16 sm:py-20">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="from-court-600 via-court-700 to-ink-950 rounded-[34px] bg-gradient-to-br px-8 py-12 text-white sm:px-12">
            <div className="max-w-3xl">
              <h2 className="mb-4 text-3xl font-bold sm:text-4xl">
                Give your clubs a league worth bragging about.
              </h2>
              <p className="mb-8 max-w-2xl leading-7 text-white/80">
                Set up divisions, open registration, and let the platform handle the rest, while
                every game feeds public standings, leaders and recaps your community follows.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/sign-up"
                  className="text-ink-950 hover:bg-ink-50 inline-flex items-center justify-center rounded-2xl bg-white px-6 py-3.5 text-sm font-semibold transition"
                >
                  Create your account
                </Link>
                <Link
                  href="/for-clubs"
                  className="inline-flex items-center justify-center rounded-2xl border border-white/20 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  Running a club instead? &rarr;
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
