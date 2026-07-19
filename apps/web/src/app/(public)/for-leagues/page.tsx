import Link from "next/link"
import { DemoPlayer } from "@/components/demo/demo-player"
import { LEAGUE_CLIPS } from "@/components/demo/clips"

export const metadata = {
  title: "For Leagues | Scheduling, Live Scoring & Standings for Youth Basketball",
  alternates: { canonical: "/for-leagues" },
  description:
    "Registration, rosters, scheduling, live scoring, standings and stat leaders. A complete operating system for youth basketball leagues.",
}

const SECTIONS = [
  {
    id: "registration",
    title: "Registration without the chasing",
    body: "Publish your season with the fee and format. Clubs submit finalized rosters in one click, payment attached, and rosters freeze when you say so.",
    scenes: LEAGUE_CLIPS.registration,
  },
  {
    id: "scheduling",
    title: "A schedule that solves itself",
    body: "Game days, gyms and blackout dates go in. A fair round robin comes out, inside your real court time. Move a game and everyone finds out at once.",
    scenes: LEAGUE_CLIPS.scheduling,
  },
  {
    id: "scoring",
    title: "Live scoring at every table",
    body: "Scorekeepers run games from a phone, guests can score with a one-time link, and referees confirm and sign off in their own view.",
    scenes: LEAGUE_CLIPS.scoring,
  },
  {
    id: "standings",
    title: "Standings, leaders, playoffs",
    body: "Every final feeds the table and the stat leaders the moment it lands. When the season ends, the bracket seeds itself from the standings.",
    scenes: LEAGUE_CLIPS.standings,
  },
  {
    id: "recaps",
    title: "A league families read about",
    body: "Every scored game becomes a written recap on your public pages within minutes. Box scores, leaders and news your community shares.",
    scenes: LEAGUE_CLIPS.recaps,
  },
  {
    id: "fees",
    title: "Fees, tracked like everything else",
    body: "Collect team fees online or record offline payments. Every obligation is visible and every payment reports the same way.",
    scenes: LEAGUE_CLIPS.fees,
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
            <p className="text-ink-400 mt-6 text-sm">
              Each section below is a hands-on walkthrough. Click the glowing button on a screen to do that step, at your own pace.
            </p>
          </div>
        </div>
      </section>

      {SECTIONS.map((s, idx) => (
        <section key={s.id} id={s.id} className={`scroll-mt-24 py-14 sm:py-16 ${idx % 2 ? "bg-[#fafafa]" : "bg-white"}`}>
          <div className="container mx-auto px-4 sm:px-6">
            <div className="mx-auto grid max-w-6xl items-center gap-8 lg:grid-cols-[0.8fr_1.2fr]">
              <div className={idx % 2 ? "lg:order-2" : ""}>
                <h2 className="text-ink-950 mb-3 text-2xl font-bold sm:text-3xl">{s.title}</h2>
                <p className="text-ink-500 text-[15px] leading-7">{s.body}</p>
              </div>
              <div>
                <DemoPlayer title={`${s.title} walkthrough`} scenes={s.scenes} />
              </div>
            </div>
          </div>
        </section>
      ))}

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
                  href="/how-it-works"
                  className="inline-flex items-center justify-center rounded-2xl border border-white/20 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  Watch the whole season play out &rarr;
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
