import Link from "next/link"
import { DemoPlayer } from "@/components/demo/demo-player"
import { CLUB_CLIPS } from "@/components/demo/clips"

export const metadata = {
  title: "For Clubs | Registration, Payments & Live Scoring for Youth Basketball",
  alternates: { canonical: "/for-clubs" },
  description:
    "Tryouts, rosters, offers, payments, live scoring and a public presence families love. One platform for your whole club.",
}

const SECTIONS = [
  {
    id: "setup",
    title: "Claim your club, build your teams",
    body: "Your club probably already has a page here waiting to be claimed. Take it over, create your age groups, and give every coach and team manager their proper role.",
    scenes: CLUB_CLIPS.setup,
  },
  {
    id: "tryouts",
    title: "Tryouts without the clipboard",
    body: "Publish a tryout with dates, gym and capacity. Watch paid signups roll in, then check players in from your phone on tryout night.",
    scenes: CLUB_CLIPS.tryouts,
  },
  {
    id: "offers",
    title: "Offers that fill rosters",
    body: "Build one offer template with uniform, fees and installment plan. Send it to everyone at once and watch acceptances come back with deposits already paid.",
    scenes: CLUB_CLIPS.offers,
  },
  {
    id: "payments",
    title: "Every dollar accounted for",
    body: "The ledger knows who paid, who owes and when the next installment runs. Cards get charged on schedule and reminders go out on their own.",
    scenes: CLUB_CLIPS.payments,
  },
  {
    id: "scoring",
    title: "Game night, handled",
    body: "Hand the table a one-time scoring link. Every press updates the live game page that parents are watching, and the box score publishes itself at the buzzer.",
    scenes: CLUB_CLIPS.scoring,
  },
  {
    id: "comms",
    title: "One place to talk",
    body: "Pinned announcements, polls that count themselves, recurring practices on every family calendar. The group chat can go back to carpool.",
    scenes: CLUB_CLIPS.comms,
  },
  {
    id: "public",
    title: "A public face that recruits for you",
    body: "Your club page carries programs, news recaps written after every game, and verified reviews from real families. New parents find you on Google.",
    scenes: CLUB_CLIPS.publicFace,
  },
  {
    id: "league",
    title: "League play without retyping",
    body: "Submit your finalized roster to the league in one click, fee included. The schedule lands back on every calendar and the standings update themselves.",
    scenes: CLUB_CLIPS.league,
  },
]

export default function ForClubsPage() {
  return (
    <>
      <section className="mesh-surface border-ink-100 border-b bg-[#fafafa] py-20 sm:py-24">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="mx-auto max-w-3xl text-center">
            <div className="bg-play-50 text-play-700 mb-5 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider">
              For clubs
            </div>
            <h1 className="font-display text-ink-950 mb-6 text-balance text-4xl font-extrabold leading-tight sm:text-5xl">
              Everything your club runs on,{" "}
              <span className="from-play-600 to-hoop-500 bg-gradient-to-r bg-clip-text text-transparent">
                in one place
              </span>
            </h1>
            <p className="text-ink-500 mx-auto mb-10 max-w-2xl text-lg leading-8">
              Tryouts, rosters, offers, payments, live scoring, and a public presence that keeps
              families engaged all season, without the spreadsheets, e-transfer chasing, and five
              different apps.
            </p>
            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/sign-up"
                className="bg-ink-950 hover:bg-ink-800 inline-flex items-center justify-center rounded-2xl px-7 py-3.5 text-[15px] font-semibold text-white shadow-lg transition"
              >
                Start your club free
              </Link>
              <Link
                href="/club"
                className="border-ink-200 text-ink-700 hover:bg-ink-50 inline-flex items-center justify-center rounded-2xl border bg-white px-7 py-3.5 text-[15px] font-semibold transition"
              >
                See club pages live
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
          <div className="from-play-600 via-play-700 to-ink-950 rounded-[34px] bg-gradient-to-br px-8 py-12 text-white sm:px-12">
            <div className="max-w-3xl">
              <h2 className="mb-4 text-3xl font-bold sm:text-4xl">
                Claim your club or start fresh. Free.
              </h2>
              <p className="text-play-100 mb-8 max-w-2xl leading-7">
                Nearly 200 Ontario clubs already have a page waiting to be claimed. Create your
                account, take over your public profile, and publish your first tryout today.
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
