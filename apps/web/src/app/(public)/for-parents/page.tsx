import Link from "next/link"
import { DemoPlayer } from "@/components/demo/demo-player"
import { PARENT_CLIPS } from "@/components/demo/clips"

export const metadata = {
  title: "For Parents & Players | One App for the Whole Season",
  alternates: { canonical: "/for-parents" },
  description:
    "Find programs, register and pay in minutes, RSVP from one calendar, follow games live, and track your kid's season. One login for every kid and every team.",
}

const SECTIONS = [
  {
    id: "find",
    title: "Find the right program",
    body: "Tryouts, camps and house leagues near you, with real dates, fees and age groups on the page. Not a screenshot in a Facebook group.",
    scenes: PARENT_CLIPS.find,
  },
  {
    id: "pay",
    title: "Register and pay in minutes",
    body: "Sign up online, pay by card, keep every receipt. When the offer comes, accept it and pay the deposit in the same flow.",
    scenes: PARENT_CLIPS.pay,
  },
  {
    id: "calendar",
    title: "One calendar that never lies",
    body: "Practices and games with RSVP buttons, synced to your phone. When a game moves, your calendar and the team chat already know.",
    scenes: PARENT_CLIPS.calendar,
  },
  {
    id: "live",
    title: "Follow the game from anywhere",
    body: "Stuck at work or driving the other kid? Live score and play by play in your pocket, full box score at the buzzer.",
    scenes: PARENT_CLIPS.live,
  },
  {
    id: "stats",
    title: "Their season, on the record",
    body: "Game logs and season stats build up all year, and the recaps mention your kid by name. Two kids? One login covers both.",
    scenes: PARENT_CLIPS.stats,
  },
  {
    id: "chat",
    title: "Chat without the chaos",
    body: "Pinned announcements you can find later, polls that count themselves, and mute when you need a quiet night.",
    scenes: PARENT_CLIPS.chat,
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
              every season. Free for families.
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
