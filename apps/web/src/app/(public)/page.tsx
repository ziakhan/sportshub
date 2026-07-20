import Link from "next/link"
import { getServerSession } from "next-auth"
import { prisma } from "@youthbasketballhub/db"
import { authOptions } from "@/lib/auth"
import { getHighlightPosts, getPublicFeed, getScoreboardGames } from "@/lib/queries/content"
import { getFeaturedSeasonId, getSeasonLeaders } from "@/lib/queries/season-stats"
import { getYourTeams } from "@/lib/queries/home"
import { getNavShape } from "@/lib/queries/nav-shape"
import { getViewerScope } from "@/lib/privacy/participants"
import { isTestWorldSlug } from "@/lib/demo-data"
import { ClubSearch } from "./club-search"
import { HighlightsRow, NewsAndLeaders, ScoreboardStrip, YourTeamsRail } from "./home-sections"
import { HomePersonalBand } from "./home-personal-band"
import { formatCurrency } from "@/lib/countries"
import { RealtimeRefresh } from "@/components/realtime-refresh"

export const metadata = {
  title: { absolute: "SportsHub One | Youth Basketball Clubs, Leagues, Camps & Live Scores" },
  description:
    "Find youth basketball clubs, leagues, camps and tryouts near you. Live scores, standings, stat leaders and game recaps.",
  alternates: { canonical: "/" },
}

export const dynamic = "force-dynamic"

async function getHomePageData() {
  const [featuredClubs, rawUpcomingTryouts, totalClubs, totalTeams, totalTryouts] =
    await Promise.all([
      prisma.tenant.findMany({
        where: { status: { in: ["ACTIVE", "UNCLAIMED"] } },
        select: {
          id: true,
          slug: true,
          name: true,
          city: true,
          state: true,
          description: true,
          status: true,
          branding: { select: { primaryColor: true, logoUrl: true } },
          _count: { select: { teams: true, tryouts: true } },
        },
        orderBy: { teams: { _count: "desc" } },
        take: 40,
      }),
      prisma.tryout.findMany({
        where: {
          isPublished: true,
          isPublic: true,
          scheduledAt: { gte: new Date() },
          tenant: { status: { in: ["ACTIVE", "UNCLAIMED"] } },
        },
        select: {
          id: true,
          title: true,
          ageGroup: true,
          location: true,
          scheduledAt: true,
          fee: true,
          tenant: {
            select: {
              name: true,
              slug: true,
              currency: true,
              branding: { select: { primaryColor: true } },
            },
          },
        },
        orderBy: { scheduledAt: "asc" },
        take: 3,
      }),
      prisma.tenant.count({ where: { status: { in: ["ACTIVE", "UNCLAIMED"] } } }),
      prisma.team.count(),
      prisma.tryout.count({ where: { isPublished: true, isPublic: true } }),
    ])

  return {
    featuredClubs: featuredClubs
      .filter((c: any) => !isTestWorldSlug(c.slug))
      .slice(0, 6),
    upcomingTryouts: rawUpcomingTryouts.map((tryout) => ({
      ...tryout,
      fee: Number(tryout.fee),
    })),
    stats: {
      totalClubs,
      totalTeams,
      totalTryouts,
    },
  }
}

export default async function HomePage() {
  const session = await getServerSession(authOptions).catch(() => null)
  const userId = (session?.user as any)?.id ?? null

  const [{ featuredClubs, upcomingTryouts, stats }, scoreboard, feed, highlights, featuredSeasonId, yourTeams, scope] =
    await Promise.all([
      getHomePageData(),
      getScoreboardGames(),
      getPublicFeed(8),
      getHighlightPosts(8),
      getFeaturedSeasonId(),
      userId ? getYourTeams(userId) : Promise.resolve([]),
      getViewerScope(userId),
    ])
  const leaders = featuredSeasonId ? await getSeasonLeaders(featuredSeasonId, 5) : null

  const logoMarquee = featuredClubs.length > 0 ? [...featuredClubs, ...featuredClubs] : []

  // Signed-in members get a content-first home — the pitch/feature walls
  // (hero, "three ways in", the org feature bento, "patchwork" + the club
  // CTA) are for prospects only. Their teams, scores, news, leaders and
  // program discovery carry the page (docs/home-redesign-plan.md).
  const marketing = !userId
  // Owner law #4 (2026-07-17): participants get THEIR material first — one
  // compact live-scores link instead of a wall of other games, and news
  // demoted to the bottom. iOS home's content priority, adopted by web.
  const shape = userId ? await getNavShape(userId) : null
  const participantView =
    !!userId &&
    (yourTeams.length > 0 ||
      scope.teamIds.size > 0 ||
      scope.playerIds.size > 0 ||
      scope.leagueIds.size > 0 ||
      !!shape?.isRefereeing ||
      (shape?.coachTeams.length ?? 0) > 0)

  return (
    <>
      {/* Live scoring pings re-render the scoreboard strip (debounced) */}
      <RealtimeRefresh rooms={["scores"]} events={["game.update"]} />
      {userId && <HomePersonalBand userId={userId} />}
      <YourTeamsRail cards={yourTeams} />
      {participantView ? (
        <section className="border-ink-100 border-b bg-white">
          <div className="container mx-auto px-4 py-3 sm:px-6">
            <Link
              href="/scores"
              className="bg-stage text-ink-50 flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-semibold"
            >
              <span>Live scores &amp; this week&rsquo;s games</span>
              <span aria-hidden>&rarr;</span>
            </Link>
          </div>
        </section>
      ) : (
        <ScoreboardStrip games={scoreboard} />
      )}
      {marketing && (
      <section className="mesh-surface border-ink-100 relative overflow-hidden border-b bg-[#fafafa] pb-10 pt-8 sm:pb-16 sm:pt-16">
        <div className="bg-play-200/60 absolute left-[-6%] top-[10%] h-72 w-72 rounded-full blur-3xl" />
        <div className="bg-hoop-200/60 absolute right-[-8%] top-[16%] h-72 w-72 rounded-full blur-3xl" />
        <div className="bg-hoop-200/40 absolute bottom-[8%] left-[28%] h-60 w-60 rounded-full blur-3xl" />

        <div className="container relative z-10 mx-auto px-4 sm:px-6">
          <div className="mx-auto max-w-4xl text-center">
            <div className="border-ink-200 mb-5 inline-flex flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-full border bg-white px-4 py-1.5 shadow-sm">
              <span className="flex items-center gap-1.5">
                <span className="bg-court-500 h-1.5 w-1.5 rounded-full motion-safe:animate-pulse" />
                <span className="text-ink-700 text-xs font-semibold">
                  {stats.totalTryouts} tryouts open now
                </span>
              </span>
              <span className="text-ink-200" aria-hidden="true">
                &middot;
              </span>
              <span className="text-ink-600 text-xs font-medium">{stats.totalClubs} clubs</span>
              <span className="text-ink-200" aria-hidden="true">
                &middot;
              </span>
              <span className="text-ink-600 text-xs font-medium">{stats.totalTeams} teams</span>
            </div>

            <div className="mb-3">
              <span className="text-hoop-500 text-xs font-semibold uppercase tracking-[0.2em]">
                The first complete platform for youth basketball
              </span>
            </div>

            <h1 className="font-display text-ink-950 mb-4 text-balance text-[clamp(2.8rem,6vw,4.8rem)] font-extrabold leading-[1.02]">
              Youth basketball.
              <br />
              <span className="text-play-600">All of it.</span>{" "}
              <span
                aria-label="One"
                className="bg-hoop-500 relative -top-[0.08em] inline-block rounded-[0.16em] px-[0.24em] py-[0.02em] align-middle text-[0.62em] uppercase leading-[1.15] tracking-[0.08em] text-white"
              >
                One
              </span>{" "}
              app.
            </h1>

            <p className="text-ink-500 mx-auto mb-6 max-w-2xl text-base leading-7 sm:mb-8 sm:text-xl sm:leading-8">
              Run tryouts, send offers, and turn them into signed-up, paid rosters. Then
              schedules, live scores and standings all season long. Everything your club or league
              runs on spreadsheets today, in one app.{" "}
              <span className="text-ink-950 font-semibold">Your season runs itself.</span>
            </p>

            <div className="mb-4 flex flex-col items-center gap-2.5">
              <Link
                href="/demo"
                className="from-play-600 to-hoop-500 shadow-play-600/25 inline-flex w-full items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r px-8 py-4 text-base font-semibold text-white shadow-lg transition hover:brightness-105 sm:w-auto"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
                  <path d="M8 5v14l11-7z" />
                </svg>
                Watch the demo
              </Link>
              <p className="text-ink-400 text-[13px] font-medium">
                A whole season, played out click by click on the real product. Parents:{" "}
                <Link href="/demo/parents" className="text-play-700 font-semibold hover:underline">
                  watch your side
                </Link>
                .
              </p>
            </div>

            <div className="mx-auto mb-4 grid max-w-3xl gap-3 text-left sm:grid-cols-3">
              {[
                {
                  href: "/for-clubs",
                  title: "For clubs",
                  body: "Run tryouts, send offers, collect payments and build your rosters.",
                  cta: "See how it works",
                },
                {
                  href: "/for-leagues",
                  title: "For leagues",
                  body: "Registration, scheduling, referees, live scores and standings.",
                  cta: "See how it works",
                },
                {
                  href: "/for-parents",
                  title: "For parents & players",
                  body: "Sign up and pay in minutes, then follow every game live.",
                  cta: "See your side of it",
                },
              ].map((c) => (
                <Link
                  key={c.href}
                  href={c.href}
                  className="border-ink-100 card-lift shadow-soft group flex flex-col rounded-2xl border bg-white p-5 transition"
                >
                  <span className="text-ink-950 text-[15px] font-bold">{c.title}</span>
                  <span className="text-ink-500 mt-1.5 block flex-1 text-[13px] leading-5">{c.body}</span>
                  <span className="bg-play-50 text-play-700 group-hover:bg-play-100 mt-3 inline-flex w-fit items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] font-bold transition-colors">
                    {c.cta}
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                    >
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </span>
                </Link>
              ))}
            </div>


            <p className="text-ink-400 mb-6 text-[13px] font-medium sm:mb-8">
              One account works for parents, coaches, scorekeepers, club owners and league
              commissioners. Same app, every seat in the gym.
            </p>

            <ClubSearch />
          </div>
        </div>
      </section>
      )}

      {!participantView && (
        <NewsAndLeaders feed={feed} leaders={leaders} participantLeagueIds={scope.leagueIds} />
      )}

      <HighlightsRow highlights={highlights} />

      {marketing && (
        <section className="bg-[#fafafa] py-16 sm:py-20">
          <div className="container mx-auto px-4 text-center sm:px-6">
            <div className="mb-4 inline-flex items-center gap-3">
              <span className="bg-hoop-400 h-px w-10" />
              <span className="text-hoop-500 text-xs font-semibold uppercase tracking-[0.2em]">
                Sound familiar?
              </span>
              <span className="bg-hoop-400 h-px w-10" />
            </div>
            <h2 className="font-display text-ink-950 mx-auto mb-8 max-w-2xl text-3xl font-extrabold sm:text-4xl">
              Still running the season on{" "}
              <span className="bg-gold-100 decoration-hoop-400 rounded-md px-1.5 underline decoration-wavy decoration-2 underline-offset-4">
                five apps
              </span>{" "}
              and{" "}
              <span className="bg-gold-100 decoration-hoop-400 rounded-md px-1.5 underline decoration-wavy decoration-2 underline-offset-4">
                a spreadsheet
              </span>
              ?
            </h2>
            <div className="mx-auto mb-8 flex max-w-2xl flex-wrap items-center justify-center gap-2.5">
              {[
                "Registration spreadsheet",
                "Email chains",
                "WhatsApp groups",
                "E-transfer chasing",
                "Paper gamesheets",
                "A separate scoring app",
                "A website builder",
              ].map((item) => (
                <span
                  key={item}
                  className="border-ink-200 text-ink-500 inline-flex items-center gap-1.5 rounded-full border bg-white px-4 py-1.5 text-[13px] font-medium"
                >
                  <span className="font-bold text-red-500" aria-hidden="true">
                    ✗
                  </span>
                  <span className="line-through decoration-red-400 decoration-2">{item}</span>
                </span>
              ))}
              <span className="bg-hoop-500 shadow-hoop-200 inline-flex items-center gap-1.5 rounded-full px-5 py-2 text-sm font-extrabold uppercase tracking-[0.06em] text-white shadow-lg">
                One app ✓
              </span>
            </div>
            <p className="text-ink-500 mx-auto max-w-2xl text-base leading-7 sm:text-lg">
              Every tool you&apos;re duct-taping together, rebuilt as one thing that talks to
              itself. When a game moves, the schedule, the standings, the team chat and every
              parent&apos;s phone <span className="text-play-700 font-bold">already know</span>.{" "}
              <span className="text-ink-950 font-bold">Nobody forwards anything.</span>
            </p>
            <div className="mx-auto mt-10 grid max-w-4xl grid-cols-1 gap-4 text-left sm:grid-cols-2">
              {[
                {
                  cat: "Team chat & RSVPs",
                  repl: "TeamSnap, Spond, the WhatsApp group",
                  tile: "bg-play-600 shadow-play-200",
                  icon: <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />,
                },
                {
                  cat: "Live scoring, box scores & stats",
                  repl: "GameChanger, paper gamesheets",
                  tile: "bg-hoop-500 shadow-hoop-200",
                  icon: <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" />,
                },
                {
                  cat: "Registration, payments & club sites",
                  repl: "SportsEngine, Jersey Watch, the spreadsheet",
                  tile: "bg-court-600 shadow-court-200",
                  icon: <path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />,
                },
                {
                  cat: "League ops: schedules, standings, playoffs, refs",
                  repl: "RAMP, email chains",
                  tile: "bg-gold-500 shadow-gold-100",
                  icon: (
                    <>
                      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
                      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
                      <path d="M4 22h16" />
                      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
                    </>
                  ),
                },
              ].map((row) => (
                <div
                  key={row.cat}
                  className="border-ink-100 shadow-soft flex items-start gap-4 rounded-3xl border bg-white p-6"
                >
                  <span
                    className={`${row.tile} flex h-11 w-11 flex-none items-center justify-center rounded-2xl shadow-lg`}
                  >
                    <svg
                      className="h-5 w-5 text-white"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      {row.icon}
                    </svg>
                  </span>
                  <div>
                    <span className="text-ink-950 text-[15px] font-bold">{row.cat}</span>
                    <p className="text-ink-500 mt-1.5 text-sm">
                      replaces{" "}
                      <span className="text-ink-600 font-semibold line-through decoration-red-400 decoration-2">
                        {row.repl}
                      </span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <p className="font-display text-ink-950 mx-auto mt-10 max-w-2xl text-center text-2xl font-extrabold sm:text-[28px]">
              They each do a piece. <span className="text-hoop-500">Nobody does the whole thing.</span>
              <span className="text-ink-500 mt-1 block text-lg font-semibold sm:text-xl">
                That&apos;s the app you actually wanted.
              </span>
            </p>
          </div>
        </section>
      )}


      {marketing && logoMarquee.length > 0 && (
        <section className="border-ink-100 overflow-hidden border-b bg-white py-6">
          <div className="marquee-track">
            {logoMarquee.map((club, index) => (
              <div key={`${club.id}-${index}`} className="flex items-center gap-4 px-6">
                <span className="text-ink-300 text-sm font-medium">{club.name}</span>
                <span className="text-ink-200">|</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {upcomingTryouts.length > 0 && (
        <section className="bg-white py-16 sm:py-20">
          <div className="container mx-auto px-4 sm:px-6">
            <div className="mb-10 flex items-end justify-between gap-6">
              <div className="max-w-2xl">
                <div className="mb-4 inline-flex items-center gap-3">
                  <span className="bg-hoop-400 h-px w-10" />
                  <span className="text-hoop-500 text-xs font-semibold uppercase tracking-[0.2em]">
                    Live marketplace
                  </span>
                </div>
                <h2 className="text-ink-950 mb-3 text-3xl font-bold sm:text-4xl">
                  Programs families can act on right now
                </h2>
                <p className="text-ink-500 text-base leading-7 sm:text-lg">
                  Pulling from real club data, upcoming tryouts stay visible, searchable, and easy
                  to compare.
                </p>
              </div>
              <Link
                href="/events"
                className="text-play-600 hover:text-play-700 hidden text-sm font-semibold transition sm:inline-flex"
              >
                Explore all programs &rarr;
              </Link>
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
              {upcomingTryouts.map((tryout) => (
                <Link
                  key={tryout.id}
                  href={`/tryout/${tryout.id}`}
                  className="card-lift border-ink-100 shadow-soft rounded-[28px] border bg-white p-6"
                >
                  <div className="mb-5 flex items-center justify-between">
                    <span className="bg-hoop-50 text-hoop-600 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]">
                      Tryout
                    </span>
                    <span className="text-ink-500 text-sm font-semibold">
                      {tryout.fee === 0 ? "Free" : formatCurrency(tryout.fee, tryout.tenant.currency)}
                    </span>
                  </div>
                  <h3 className="text-ink-950 mb-2 text-2xl font-semibold">{tryout.title}</h3>
                  <p className="text-ink-500 mb-6 text-sm leading-6">
                    {tryout.tenant.name} | {tryout.ageGroup} | {tryout.location}
                  </p>
                  <div className="flex items-end justify-between">
                    <div>
                      <div className="text-ink-400 text-xs uppercase tracking-[0.16em]">
                        Next session
                      </div>
                      <div className="text-ink-700 mt-1 text-sm font-medium">
                        {new Date(tryout.scheduledAt).toLocaleDateString("en-CA", {
                          month: "short",
                          day: "numeric",
                        })}
                      </div>
                    </div>
                    <span
                      className="inline-flex h-11 w-11 items-center justify-center rounded-2xl text-white"
                      style={{ backgroundColor: tryout.tenant.branding?.primaryColor || "#4f46e5" }}
                    >
                      <svg
                        className="h-4 w-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                      >
                        <path d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {featuredClubs.length > 0 && (
        <section className="bg-ink-50 py-16 sm:py-20">
          <div className="container mx-auto px-4 sm:px-6">
            <div className="mb-10 max-w-2xl">
              <div className="mb-4 inline-flex items-center gap-3">
                <span className="bg-play-400 h-px w-10" />
                <span className="text-play-500 text-xs font-semibold uppercase tracking-[0.2em]">
                  Featured clubs
                </span>
              </div>
              <h2 className="text-ink-950 mb-3 text-3xl font-bold sm:text-4xl">
                Clubs with active teams, tryouts, and real momentum
              </h2>
              <p className="text-ink-500 text-base leading-7 sm:text-lg">
                Clubs get a better public presence, and families get clearer signals about what is
                active.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
              {featuredClubs.map((club) => (
                <Link
                  key={club.id}
                  href={`/club/${club.slug}`}
                  className="card-lift border-ink-100 shadow-soft overflow-hidden rounded-[30px] border bg-white"
                >
                  <div
                    className="relative h-32 overflow-hidden"
                    style={{
                      background: `linear-gradient(135deg, ${club.branding?.primaryColor || "#4f46e5"}, #18181b)`,
                    }}
                  >
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.22),transparent_32%)]" />
                    <div className="text-ink-950 absolute bottom-4 left-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/95 text-lg font-bold shadow-lg">
                      {club.name.slice(0, 1)}
                    </div>
                  </div>
                  <div className="p-6 pt-5">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-ink-950 text-xl font-bold">{club.name}</h3>
                        <p className="text-ink-500 mt-1 text-sm">
                          {[club.city, club.state].filter(Boolean).join(", ")}
                        </p>
                      </div>
                      <span className="bg-ink-50 text-ink-600 ring-ink-200 rounded-full px-3 py-1 text-xs font-semibold ring-1">
                        {club.status === "UNCLAIMED" ? "Open profile" : "Active"}
                      </span>
                    </div>
                    {club.description && (
                      <p className="text-ink-600 mb-4 line-clamp-2 text-sm leading-6">
                        {club.description}
                      </p>
                    )}
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="bg-court-50 rounded-2xl p-3">
                        <div className="text-court-700 text-xs uppercase tracking-[0.16em]">
                          Teams
                        </div>
                        <div className="text-ink-950 mt-1 text-lg font-semibold">
                          {club._count.teams}
                        </div>
                      </div>
                      <div className="bg-hoop-50 rounded-2xl p-3">
                        <div className="text-hoop-700 text-xs uppercase tracking-[0.16em]">
                          Tryouts
                        </div>
                        <div className="text-ink-950 mt-1 text-lg font-semibold">
                          {club._count.tryouts}
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            <div className="mt-8">
              <Link
                href="/club"
                className="text-play-600 hover:text-play-700 inline-flex text-sm font-semibold transition"
              >
                View all clubs &rarr;
              </Link>
            </div>
          </div>
        </section>
      )}

      {marketing && (
      <>
      <section className="bg-white py-20 sm:py-24">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="mb-14 text-center">
            <div className="bg-play-50 text-play-700 mb-4 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider">
              For organizers
            </div>
            <h2 className="font-display text-ink-950 mb-3 text-3xl font-bold sm:text-4xl">
              Everything you need to run your program
            </h2>
            <p className="text-ink-500 mx-auto max-w-xl">
              From tryout management to live scoring, built for youth basketball clubs
              and leagues.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:[grid-auto-rows:minmax(200px,auto)]">
            <div className="card-lift from-hoop-50 to-hoop-100/50 border-hoop-200/50 group relative overflow-hidden rounded-3xl border bg-gradient-to-br p-8 sm:col-span-2 lg:row-span-2">
              <div className="relative z-10">
                <div className="bg-hoop-500 shadow-hoop-200 mb-5 flex h-12 w-12 items-center justify-center rounded-2xl shadow-lg">
                  <svg
                    className="h-6 w-6 text-white"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <rect x="8" y="2" width="8" height="4" rx="1" />
                    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                  </svg>
                </div>
                <h3 className="font-display text-ink-950 mb-2 text-2xl font-bold">
                  Tryout Management
                </h3>
                <p className="text-ink-500 mb-6 max-w-sm leading-relaxed">
                  Publish tryouts, collect signups, evaluate players, and send offers, all from
                  one dashboard.
                </p>
                <div className="border-ink-100 max-w-sm rounded-2xl border bg-white p-4 shadow-sm">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-ink-950 text-xs font-semibold">
                      U14 Boys Rep Tryout
                    </span>
                    <span className="bg-court-100 text-court-700 rounded-full px-2 py-0.5 text-[10px] font-bold">
                      ACTIVE
                    </span>
                  </div>
                  <div className="mb-3 flex gap-3">
                    <div className="bg-ink-50 flex-1 rounded-xl p-2.5 text-center">
                      <div className="font-display text-ink-950 text-lg font-bold">24</div>
                      <div className="text-ink-400 text-[10px]">signups</div>
                    </div>
                    <div className="bg-ink-50 flex-1 rounded-xl p-2.5 text-center">
                      <div className="font-display text-ink-950 text-lg font-bold">12</div>
                      <div className="text-ink-400 text-[10px]">evaluated</div>
                    </div>
                    <div className="bg-ink-50 flex-1 rounded-xl p-2.5 text-center">
                      <div className="font-display text-ink-950 text-lg font-bold">8</div>
                      <div className="text-ink-400 text-[10px]">offered</div>
                    </div>
                  </div>
                  <div className="bg-ink-100 h-1.5 w-full rounded-full">
                    <div className="bg-hoop-500 h-1.5 w-[65%] rounded-full" />
                  </div>
                </div>
              </div>
            </div>

            <div className="card-lift from-play-50 to-play-100/50 border-play-200/50 rounded-3xl border bg-gradient-to-br p-6 sm:col-span-2">
              <div className="bg-play-600 shadow-play-200 mb-4 flex h-10 w-10 items-center justify-center rounded-xl shadow-lg">
                <svg
                  className="h-5 w-5 text-white"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <h3 className="font-display text-ink-950 mb-1.5 text-xl font-bold">Team Rosters</h3>
              <p className="text-ink-500 text-sm leading-relaxed">
                Organize players by age group, manage rosters, and track assignments across the
                season.
              </p>
            </div>

            <div className="card-lift from-court-50 to-court-100/50 border-court-200/50 rounded-3xl border bg-gradient-to-br p-6 sm:col-span-2">
              <div className="bg-court-600 shadow-court-200 mb-4 flex h-10 w-10 items-center justify-center rounded-xl shadow-lg">
                <svg
                  className="h-5 w-5 text-white"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                  <line x1="4" y1="22" x2="4" y2="15" />
                </svg>
              </div>
              <h3 className="font-display text-ink-950 mb-1.5 text-xl font-bold">Offer Pipeline</h3>
              <p className="text-ink-500 text-sm leading-relaxed">
                Send offers with custom templates, track responses in real-time, and fill your
                rosters fast.
              </p>
            </div>

            <div className="card-lift rounded-3xl border border-amber-200/50 bg-gradient-to-br from-amber-50 to-amber-100/50 p-6">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 shadow-lg shadow-amber-200">
                <svg
                  className="h-5 w-5 text-white"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <line x1="12" y1="1" x2="12" y2="23" />
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              </div>
              <h3 className="font-display text-ink-950 mb-1 text-lg font-bold">Payments</h3>
              <p className="text-ink-500 text-xs leading-relaxed">
                Stripe-powered online payments for tryouts, camps, and registration fees.
              </p>
            </div>

            <div className="card-lift rounded-3xl border border-sky-200/50 bg-gradient-to-br from-sky-50 to-sky-100/50 p-6">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500 shadow-lg shadow-sky-200">
                <svg
                  className="h-5 w-5 text-white"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </div>
              <h3 className="font-display text-ink-950 mb-1 text-lg font-bold">Scheduling</h3>
              <p className="text-ink-500 text-xs leading-relaxed">
                Game schedules, practice times, and venue management in one calendar.
              </p>
            </div>

            <div className="card-lift rounded-3xl border border-rose-200/50 bg-gradient-to-br from-rose-50 to-rose-100/50 p-6">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500 shadow-lg shadow-rose-200">
                <svg
                  className="h-5 w-5 text-white"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
              </div>
              <h3 className="font-display text-ink-950 mb-1 text-lg font-bold">Live Scoring</h3>
              <p className="text-ink-500 text-xs leading-relaxed">
                Real-time game scoring with stats tracking.
              </p>
              <span className="mt-2 inline-block rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-600">
                COMING SOON
              </span>
            </div>

            <div className="card-lift rounded-3xl border border-violet-200/50 bg-gradient-to-br from-violet-50 to-violet-100/50 p-6">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500 shadow-lg shadow-violet-200">
                <svg
                  className="h-5 w-5 text-white"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
              </div>
              <h3 className="font-display text-ink-950 mb-1 text-lg font-bold">Notifications</h3>
              <p className="text-ink-500 text-xs leading-relaxed">
                Email and in-app alerts for signups, offers, invites, and game updates.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-ink-950 py-16 text-white sm:py-20">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 gap-8 rounded-[32px] border border-white/10 bg-white/5 p-8 backdrop-blur-sm lg:grid-cols-[1.2fr_0.8fr] lg:p-12">
            <div>
              <div className="mb-4 inline-flex items-center gap-3">
                <span className="bg-hoop-400 h-px w-10" />
                <span className="text-hoop-300 text-xs font-semibold uppercase tracking-[0.2em]">
                  The receipts
                </span>
              </div>
              <h2 className="mb-4 text-3xl font-bold sm:text-4xl">
                &ldquo;Complete&rdquo; isn&apos;t a slogan here. It&apos;s a checklist.
              </h2>
              <p className="text-ink-300 max-w-2xl text-base leading-7 sm:text-lg">
                Registration to final buzzer. Every job the season throws at you, already built
                and already talking to each other.
              </p>
              <div className="mt-6 flex max-w-2xl flex-wrap gap-2">
                {[
                  "Registration",
                  "Payments & installments",
                  "Tryouts & offers",
                  "Team chat & DMs",
                  "Schedules + calendar sync",
                  "RSVPs",
                  "Live scoring",
                  "Box scores & leaders",
                  "AI game recaps",
                  "Standings & playoff brackets",
                  "Referee assignment",
                  "Club & league pages",
                  "iOS + Android apps",
                  "Guest scorekeeper links",
                ].map((capability) => (
                  <span
                    key={capability}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-[13px] font-medium text-white/85"
                  >
                    <span className="text-hoop-300 font-bold" aria-hidden="true">
                      ✓
                    </span>
                    {capability}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              <div className="bg-white/8 rounded-3xl p-5">
                <div className="text-ink-400 text-xs uppercase tracking-[0.18em]">Clubs</div>
                <div className="mt-2 text-3xl font-bold text-white">{stats.totalClubs}+</div>
              </div>
              <div className="bg-white/8 rounded-3xl p-5">
                <div className="text-ink-400 text-xs uppercase tracking-[0.18em]">Teams</div>
                <div className="mt-2 text-3xl font-bold text-white">{stats.totalTeams}+</div>
              </div>
              <div className="bg-white/8 rounded-3xl p-5">
                <div className="text-ink-400 text-xs uppercase tracking-[0.18em]">
                  Public tryouts
                </div>
                <div className="mt-2 text-3xl font-bold text-white">{stats.totalTryouts}+</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#fafafa] py-16 sm:py-20">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="from-play-600 via-play-700 to-ink-950 shadow-panel rounded-[34px] bg-gradient-to-br px-8 py-12 text-white sm:px-12">
            <div className="max-w-3xl">
              <div className="text-play-100 mb-4 inline-flex rounded-full border border-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em]">
                Start building with it
              </div>
              <h2 className="mb-4 text-3xl font-bold sm:text-5xl">
                Set up takes an evening, not an offseason.
              </h2>
              <p className="text-play-100 mb-8 max-w-2xl text-base leading-7 sm:text-lg">
                Create your club, publish a program, and give families one app instead of five.
                Import your rosters and this season already runs itself.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/sign-up"
                  className="text-ink-950 hover:bg-ink-50 inline-flex items-center justify-center rounded-2xl bg-white px-6 py-3.5 text-sm font-semibold transition"
                >
                  Create your account
                </Link>
                <Link
                  href="/club"
                  className="inline-flex items-center justify-center rounded-2xl border border-white/20 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  Explore club profiles
                </Link>
              </div>
              <p className="text-play-100 mt-6 text-sm">
                Just looking for a place to play?{" "}
                <Link
                  href="/events"
                  className="font-semibold text-white underline underline-offset-4"
                >
                  Find tryouts near you
                </Link>
              </p>
            </div>
          </div>
        </div>
      </section>
      </>
      )}

      {participantView && (
        <NewsAndLeaders feed={feed} leaders={leaders} participantLeagueIds={scope.leagueIds} />
      )}
    </>
  )
}
