import Link from "next/link"
import { SectionHeader } from "@/components/ui"
import { DemoPlayer } from "@/components/demo/demo-player"
import { PARENT_SCENES } from "@/components/demo/scenes-parent"

export const metadata = {
  title: "For Parents & Players — One App for the Whole Season",
  alternates: { canonical: "/for-parents" },
  description:
    "Find programs, register and pay in minutes, RSVP from one calendar, follow games live, and track your kid's season — one login for every kid and every team.",
}

const FEATURES = [
  {
    title: "Find the right program",
    body: "Tryouts, camps, and house leagues near you with real details — dates, fees, age groups — not a screenshot in a Facebook group.",
    tone: "bg-hoop-500 shadow-hoop-200",
    icon: (
      <>
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
      </>
    ),
  },
  {
    title: "Register & pay in minutes",
    body: "Sign up online, pay by card or installments, keep every receipt — no e-transfer to a number you got in a group chat.",
    tone: "bg-court-600 shadow-court-200",
    icon: <path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />,
  },
  {
    title: "One calendar that's always right",
    body: "Practices, games, and events with RSVP buttons — synced to your phone's calendar. When something moves, it moves everywhere.",
    tone: "bg-play-600 shadow-play-200",
    icon: (
      <>
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
      </>
    ),
  },
  {
    title: "Follow the game live",
    body: "Stuck at work or driving the other kid? Live scores, play-by-play, and the full box score the moment the buzzer sounds.",
    tone: "bg-gold-500 shadow-gold-200",
    icon: <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />,
  },
  {
    title: "Their season, on the record",
    body: "Game logs, season stats, and recaps that mention your kid by name. Players 13+ get their own login and player page.",
    tone: "bg-sky-500 shadow-sky-200",
    icon: (
      <>
        <path d="M3 3v18h18" />
        <path d="m7 15 4-4 3 3 5-6" />
      </>
    ),
  },
  {
    title: "Chat without the chaos",
    body: "Team announcements you can actually find later, DMs with coaches, mute when you need it — the group chat goes back to carpool.",
    tone: "bg-violet-500 shadow-violet-200",
    icon: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
  },
]

export default function ForParentsPage() {
  return (
    <>
      <section className="mesh-surface border-ink-100 border-b bg-[#fafafa] py-20 sm:py-24">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="mx-auto max-w-3xl text-center">
            <div className="bg-hoop-50 text-hoop-700 mb-5 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider">
              For parents &amp; players
            </div>
            <h1 className="font-display text-ink-950 mb-6 text-balance text-4xl font-extrabold leading-tight sm:text-5xl">
              Your kid&apos;s whole season,{" "}
              <span className="from-play-600 to-hoop-500 bg-gradient-to-r bg-clip-text text-transparent">
                in your pocket
              </span>
            </h1>
            <p className="text-ink-500 mx-auto mb-10 max-w-2xl text-lg leading-8">
              Find a program, register and pay in minutes, RSVP from one calendar, and follow the
              game live when you can&apos;t be in the gym. One login for every kid, every team,
              every season — free for families.
            </p>
            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/events"
                className="bg-ink-950 hover:bg-ink-800 inline-flex items-center justify-center rounded-2xl px-7 py-3.5 text-[15px] font-semibold text-white shadow-lg transition"
              >
                Find a program near you
              </Link>
              <Link
                href="/sign-up"
                className="border-ink-200 text-ink-700 hover:bg-ink-50 inline-flex items-center justify-center rounded-2xl border bg-white px-7 py-3.5 text-[15px] font-semibold transition"
              >
                Create your free account
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white py-14 sm:py-16">
        <div className="container mx-auto px-4 sm:px-6">
          <SectionHeader
            eyebrow="Watch it work"
            title="Discover, register, pay — then just follow the season"
            accent="hoop"
            align="center"
            className="mb-8"
          />
          <div className="mx-auto max-w-3xl">
            <DemoPlayer title="Parent journey walkthrough" scenes={PARENT_SCENES} />
            <p className="text-ink-400 mt-3 text-center text-sm">
              Every screen is the live design system with demo data — press play or step through.{" "}
              <Link href="/how-it-works" className="text-play-600 font-semibold">
                See the club and league journeys &rarr;
              </Link>
            </p>
          </div>
        </div>
      </section>

      <section className="bg-white py-16 sm:py-20">
        <div className="container mx-auto px-4 sm:px-6">
          <SectionHeader
            eyebrow="From signup to final buzzer"
            title="Everything a sports parent juggles, in one app"
            accent="hoop"
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
          <div className="from-hoop-500 via-hoop-600 to-ink-950 rounded-[34px] bg-gradient-to-br px-8 py-12 text-white sm:px-12">
            <div className="max-w-3xl">
              <h2 className="mb-4 text-3xl font-bold sm:text-4xl">
                Tryout season doesn&apos;t wait.
              </h2>
              <p className="text-hoop-100 mb-8 max-w-2xl leading-7">
                Browse open tryouts and camps near you, or create your free account so you&apos;re
                ready the moment your club sends an invite or an offer.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/events"
                  className="text-ink-950 hover:bg-ink-50 inline-flex items-center justify-center rounded-2xl bg-white px-6 py-3.5 text-sm font-semibold transition"
                >
                  Browse open tryouts
                </Link>
                <Link
                  href="/scores"
                  className="inline-flex items-center justify-center rounded-2xl border border-white/20 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  See live scores now &rarr;
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
