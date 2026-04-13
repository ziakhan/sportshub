import Link from "next/link"
import { prisma } from "@youthbasketballhub/db"
import { ClubSearch } from "./club-search"

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
        take: 6,
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
    featuredClubs,
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
  const { featuredClubs, upcomingTryouts, stats } = await getHomePageData()
  const logoMarquee = featuredClubs.length > 0 ? [...featuredClubs, ...featuredClubs] : []

  return (
    <>
      <section className="mesh-surface border-ink-100 relative overflow-hidden border-b bg-[#fafafa] pb-24 pt-20 sm:pt-28">
        <div className="bg-play-200/60 absolute left-[-6%] top-[10%] h-72 w-72 rounded-full blur-3xl" />
        <div className="bg-hoop-200/60 absolute right-[-8%] top-[16%] h-72 w-72 rounded-full blur-3xl" />
        <div className="bg-court-200/50 absolute bottom-[8%] left-[28%] h-60 w-60 rounded-full blur-3xl" />

        <div className="container relative z-10 mx-auto px-4 sm:px-6">
          <div className="mx-auto max-w-4xl text-center">
            <div className="border-ink-200 mb-8 inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1.5 shadow-sm">
              <span className="bg-court-500 h-1.5 w-1.5 rounded-full" />
              <span className="text-ink-600 text-xs font-medium">
                {stats.totalClubs}+ clubs across the platform
              </span>
            </div>

            <h1 className="font-display text-ink-950 mb-6 text-balance text-[clamp(2.8rem,6vw,4.8rem)] font-extrabold leading-[1.02]">
              Youth basketball,
              <br />
              <span className="from-play-600 via-hoop-500 to-court-600 bg-gradient-to-r bg-clip-text text-transparent">
                organized beautifully
              </span>
            </h1>

            <p className="text-ink-500 mx-auto mb-10 max-w-2xl text-lg leading-8 sm:text-xl">
              The modern platform where clubs manage teams, parents find tryouts, and the basketball
              community stays connected without spreadsheets and scattered messages.
            </p>

            <div className="mb-14 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/sign-up"
                className="bg-ink-950 shadow-ink-950/10 hover:bg-ink-800 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-7 py-3.5 text-[15px] font-semibold text-white shadow-lg transition sm:w-auto"
              >
                Get started for free
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </Link>
              <Link
                href="/marketplace"
                className="border-ink-200 text-ink-700 hover:bg-ink-50 inline-flex w-full items-center justify-center rounded-2xl border bg-white px-7 py-3.5 text-[15px] font-semibold transition sm:w-auto"
              >
                Browse tryouts
              </Link>
            </div>

            <ClubSearch />
          </div>
        </div>
      </section>

      {logoMarquee.length > 0 && (
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
                href="/marketplace"
                className="text-play-600 hover:text-play-700 hidden text-sm font-semibold transition sm:inline-flex"
              >
                Explore all programs &rarr;
              </Link>
            </div>

            <div className="grid gap-5 lg:grid-cols-3">
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
                      {tryout.fee === 0 ? "Free" : `$${tryout.fee}`}
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

            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
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

      <section className="bg-white py-16 sm:py-20">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="mb-10 max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-3">
              <span className="bg-court-400 h-px w-10" />
              <span className="text-court-600 text-xs font-semibold uppercase tracking-[0.2em]">
                Why it works
              </span>
            </div>
            <h2 className="text-ink-950 mb-3 text-3xl font-bold sm:text-4xl">
              One platform, built for every role around the team
            </h2>
            <p className="text-ink-500 text-base leading-7 sm:text-lg">
              The design direction works best when it still feels useful, so these sections stay
              tied to real workflows already present in the product.
            </p>
          </div>

          <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-4">
            <div className="border-ink-100 shadow-soft rounded-[28px] border bg-white p-6">
              <div className="bg-hoop-50 text-hoop-600 mb-4 inline-flex rounded-2xl p-3">
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M12 14c4.418 0 8-1.79 8-4s-3.582-4-8-4-8 1.79-8 4 3.582 4 8 4Z" />
                  <path d="M4 10v4c0 2.21 3.582 4 8 4s8-1.79 8-4v-4" />
                </svg>
              </div>
              <h3 className="text-ink-950 mb-2 text-xl font-semibold">Parents</h3>
              <p className="text-ink-600 text-sm leading-6">
                Find real clubs, compare tryouts, and keep registration in one organized flow.
              </p>
            </div>
            <div className="border-ink-100 shadow-soft rounded-[28px] border bg-white p-6">
              <div className="bg-court-50 text-court-600 mb-4 inline-flex rounded-2xl p-3">
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M3 21h18" />
                  <path d="M5 21V8l7-5 7 5v13" />
                  <path d="M9 12h6" />
                </svg>
              </div>
              <h3 className="text-ink-950 mb-2 text-xl font-semibold">Clubs</h3>
              <p className="text-ink-600 text-sm leading-6">
                Publish programs, manage staff, track teams, and turn public interest into
                structured operations.
              </p>
            </div>
            <div className="border-ink-100 shadow-soft rounded-[28px] border bg-white p-6">
              <div className="bg-play-50 text-play-600 mb-4 inline-flex rounded-2xl p-3">
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M9 6.75V4.5A2.25 2.25 0 0 1 11.25 2.25h1.5A2.25 2.25 0 0 1 15 4.5v2.25" />
                  <path d="M4.5 9.75h15v9.75a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V9.75Z" />
                </svg>
              </div>
              <h3 className="text-ink-950 mb-2 text-xl font-semibold">Staff</h3>
              <p className="text-ink-600 text-sm leading-6">
                Accept invitations, stay tied to club context, and manage the players and workflows
                assigned to you.
              </p>
            </div>
            <div className="border-ink-100 shadow-soft rounded-[28px] border bg-white p-6">
              <div className="bg-ink-100 text-ink-700 mb-4 inline-flex rounded-2xl p-3">
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M3 5.25A2.25 2.25 0 0 1 5.25 3h13.5A2.25 2.25 0 0 1 21 5.25v13.5A2.25 2.25 0 0 1 18.75 21H5.25A2.25 2.25 0 0 1 3 18.75V5.25Z" />
                  <path d="M7.5 15 10.5 12l2.25 2.25L16.5 9.75" />
                </svg>
              </div>
              <h3 className="text-ink-950 mb-2 text-xl font-semibold">Leagues</h3>
              <p className="text-ink-600 text-sm leading-6">
                Coordinate divisions, visibility, and scheduling with cleaner data moving through
                the platform.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-ink-950 py-16 text-white sm:py-20">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="grid gap-8 rounded-[32px] border border-white/10 bg-white/5 p-8 backdrop-blur-sm lg:grid-cols-[1.2fr_0.8fr] lg:p-12">
            <div>
              <div className="mb-4 inline-flex items-center gap-3">
                <span className="bg-hoop-400 h-px w-10" />
                <span className="text-hoop-300 text-xs font-semibold uppercase tracking-[0.2em]">
                  Platform snapshot
                </span>
              </div>
              <h2 className="mb-4 text-3xl font-bold sm:text-4xl">
                Built to replace the patchwork behind club operations
              </h2>
              <p className="text-ink-300 max-w-2xl text-base leading-7 sm:text-lg">
                Real teams, real tryouts, and real public pages. The design shift is not just
                cosmetic; it makes the product feel credible the moment someone lands on it.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
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
                Bring your club online with a platform that looks as organized as it works.
              </h2>
              <p className="text-play-100 mb-8 max-w-2xl text-base leading-7 sm:text-lg">
                Create a free account, publish your programs, and give families a public-facing
                experience that feels intentional from the first click.
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
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
