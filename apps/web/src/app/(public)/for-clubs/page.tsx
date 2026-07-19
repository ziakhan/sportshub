import Link from "next/link"
import { BrowserShot } from "@/components/marketing/shots"
import { SectionHeader } from "@/components/ui"

export const metadata = {
  title: "For Clubs | Registration, Payments & Live Scoring for Youth Basketball",
  alternates: { canonical: "/for-clubs" },
  description:
    "Tryouts, rosters, offers, payments, live scoring and a public presence families love. One platform for your whole club.",
}

const FEATURES = [
  {
    title: "Tryouts & offers",
    body: "Publish tryouts, collect signups and payments, evaluate players, and send offer packages families accept online.",
    tone: "bg-hoop-500 shadow-hoop-200",
    icon: <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2M9 2h6v4H9z" />,
  },
  {
    title: "Payments built in",
    body: "Online payments, cash and e-transfer bookkeeping, installments, refunds. Every dollar tracked against what's owed.",
    tone: "bg-court-600 shadow-court-200",
    icon: <path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />,
  },
  {
    title: "Live scoring & stats",
    body: "Score games courtside from any phone. Box scores, play-by-play, official scoresheets, and season stats, all automatic.",
    tone: "bg-play-600 shadow-play-200",
    icon: <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />,
  },
  {
    title: "A public face families love",
    body: "Club and team pages, game recaps written automatically, stat leaders, and news. Parents come back between games.",
    tone: "bg-gold-500 shadow-gold-200",
    icon: (
      <>
        <circle cx="12" cy="12" r="10" />
        <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </>
    ),
  },
  {
    title: "Rosters & communication",
    body: "Age-group teams, staff assignments, jersey numbers, announcements and notifications. No more spreadsheet chaos.",
    tone: "bg-sky-500 shadow-sky-200",
    icon: (
      <>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
  },
  {
    title: "League play, connected",
    body: "Register teams into leagues, submit rosters once, and get schedules, standings and results without re-entering anything.",
    tone: "bg-violet-500 shadow-violet-200",
    icon: (
      <>
        <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16" />
        <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
      </>
    ),
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
          </div>
        </div>
      </section>

      <section className="bg-white py-16 sm:py-20">
        <div className="container mx-auto px-4 sm:px-6">
          <SectionHeader
            eyebrow="The whole season"
            title="From first tryout to final buzzer"
            accent="play"
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
          <div className="mb-10 text-center">
            <h2 className="text-ink-950 mb-3 text-3xl font-bold sm:text-4xl">
              This is the real product
            </h2>
            <p className="text-ink-500 mx-auto max-w-xl text-base leading-7">
              Actual screens from a working club on the platform. No mockups.
            </p>
          </div>
          <div className="mx-auto grid max-w-4xl grid-cols-1 gap-10">
            <BrowserShot src="/shots/club-dashboard.png" alt="Club dashboard" caption="The club dashboard. Teams, tryouts, payments and setup, all in one place the moment you sign in." />
            <BrowserShot src="/shots/club-tryouts.png" alt="Tryouts management" caption="Tryout management. Publish a tryout, watch paid signups arrive, and run check-in on the night." />
            <BrowserShot src="/shots/club-payments.png" alt="Payments ledger" caption="The payments view. Every fee, every installment and every family's balance, tracked without a spreadsheet." />
            <BrowserShot src="/shots/club-chat.png" alt="Team chat" caption="Team messaging built in. Announcements reach every family and stay findable later." />
            <BrowserShot src="/shots/coach-team-home.png" alt="Coach team home" caption="The coach's team home. Roster, schedule and chat for their team, nothing else in the way." />
            <BrowserShot src="/shots/public-club-page.png" alt="Public club page" caption="Your public club page. Programs, news and reviews that families find when they search your club's name." />
          </div>
        </div>
      </section>

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
                  href="/for-leagues"
                  className="inline-flex items-center justify-center rounded-2xl border border-white/20 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  Running a league instead? &rarr;
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
