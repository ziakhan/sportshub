import Link from "next/link"
import { notFound } from "next/navigation"
import { format } from "date-fns"
import { getServerSession } from "next-auth"
import { prisma } from "@youthbasketballhub/db"
import { authOptions } from "@/lib/auth"
import { formatCurrency } from "@/lib/countries"
import { getPublicSeason } from "@/lib/queries/season"
import { getSeasonStandings } from "@/lib/queries/standings"
import { getSeasonLeaders } from "@/lib/queries/season-stats"
import { getViewerScope, isParticipant } from "@/lib/privacy/participants"
import { playerDisplayName } from "@/lib/privacy/names"
import { Badge, Card, NewsCard, ScoreCard, SectionHeader, StandingsTable } from "@/components/ui"
import { socialLinks } from "@/lib/club-page/blocks"
import { brandStyle } from "@/lib/club-page/brand"
import { FollowButton } from "@/components/follow-button"

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: { params: { id: string } }) {
  const season = await getPublicSeason(params.id)
  if (!season) return { title: "Season not found" }
  const name = season.league?.name || "League Season"
  return {
    title: `${name} ${season.label ?? ""} — Scores, Standings & Leaders`,
    description: `Live scores, standings, stat leaders, schedule and game recaps for ${name}.`,
    alternates: { canonical: `/league/${params.id}` },
  }
}

const gameCardSelect = {
  id: true,
  status: true,
  scheduledAt: true,
  homeScore: true,
  awayScore: true,
  homeTeam: { select: { id: true, name: true, tenant: { select: { branding: { select: { primaryColor: true } } } } } },
  awayTeam: { select: { id: true, name: true, tenant: { select: { branding: { select: { primaryColor: true } } } } } },
  venue: { select: { name: true } },
}

export default async function PublicLeagueHubPage({ params }: { params: { id: string } }) {
  const season = await getPublicSeason(params.id)
  if (!season) notFound()
  const leagueId = season.league?.id
  const leagueName = season.league?.name
  const brand: any = leagueId
    ? await (prisma as any).league.findUnique({
        where: { id: leagueId },
        select: {
          ownerId: true,
          logoUrl: true,
          bannerUrl: true,
          tagline: true,
          primaryColor: true,
          socials: true,
        },
      })
    : null

  const session = await getServerSession(authOptions).catch(() => null)
  const viewerId = (session?.user as any)?.id ?? null

  const now = new Date()
  const [standings, leaders, liveGames, recentGames, upcomingGames, posts, scope, leagueFollowed] =
    await Promise.all([
      getSeasonStandings(params.id),
      getSeasonLeaders(params.id, 5),
      (prisma as any).game.findMany({
        where: { seasonId: params.id, status: "LIVE" },
        select: gameCardSelect,
        orderBy: { scheduledAt: "asc" },
        take: 4,
      }),
      (prisma as any).game.findMany({
        where: { seasonId: params.id, status: "COMPLETED" },
        select: gameCardSelect,
        orderBy: { scheduledAt: "desc" },
        take: 6,
      }),
      (prisma as any).game.findMany({
        where: { seasonId: params.id, status: "SCHEDULED", scheduledAt: { gte: now } },
        select: gameCardSelect,
        orderBy: { scheduledAt: "asc" },
        take: 4,
      }),
      leagueId
        ? (prisma as any).post.findMany({
            where: { status: "PUBLISHED", tags: { some: { leagueId } } },
            select: {
              id: true,
              title: true,
              slug: true,
              body: true,
              publishedAt: true,
              kind: true,
              media: { select: { type: true, url: true, posterUrl: true }, orderBy: { sortOrder: "asc" as const }, take: 1 },
            },
            orderBy: { publishedAt: "desc" },
            take: 4,
          })
        : [],
      getViewerScope(viewerId),
      viewerId && leagueId
        ? (prisma as any).follow
            .findFirst({ where: { userId: viewerId, leagueId }, select: { id: true } })
            .then((f: any) => !!f)
        : false,
    ])

  const participant = leagueId ? isParticipant(scope, { leagueId }) : false
  const approvedTeams = (season.teamSubmissions ?? []).filter((t: any) => t.status === "APPROVED")
  const isOpen = season.status === "REGISTRATION"
  const deadlinePassed =
    season.registrationDeadline && new Date(season.registrationDeadline) < new Date()
  const completedCount = standings
    ? standings.divisions.reduce((acc, d) => acc + d.rows.reduce((a, r) => a + r.gamesPlayed, 0), 0) / 2
    : 0
  const topScorers = leaders?.categories.find((c) => c.key === "ppg")?.rows.slice(0, 3) ?? []

  // League owners/managers (or platform admins) get an inline "Edit page" link.
  const canManageLeague =
    viewerId && leagueId
      ? brand?.ownerId === viewerId ||
        (await prisma.userRole.count({
          where: {
            userId: viewerId,
            OR: [
              { role: "PlatformAdmin" as any },
              { leagueId, role: { in: ["LeagueOwner", "LeagueManager"] as any } },
            ],
          },
        })) > 0
      : false

  const leagueStats: Array<{ value: string; label: string }> = [
    { value: String(approvedTeams.length), label: approvedTeams.length === 1 ? "Team" : "Teams" },
    { value: String(Math.round(completedCount)), label: "Games played" },
    { value: String(season.divisions?.length || 0), label: "Divisions" },
    liveGames.length > 0
      ? { value: String(liveGames.length), label: "Live now" }
      : { value: String(upcomingGames.length), label: "Upcoming" },
  ]

  // Teams grouped by division for the browse grid
  const teamsByDivision = new Map<string, Array<{ id: string; name: string; clubName?: string; clubSlug?: string }>>()
  for (const t of approvedTeams) {
    const key = t.division?.name ?? "Teams"
    const list = teamsByDivision.get(key) ?? []
    list.push({ id: t.team.id, name: t.team.name, clubName: t.team.tenant?.name, clubSlug: t.team.tenant?.slug })
    teamsByDivision.set(key, list)
  }

  return (
    <div
      className="container font-barlow mx-auto px-4 py-10 sm:px-6"
      style={brandStyle(brand?.primaryColor)}
    >
      <div className="mb-6 flex items-center justify-between gap-4">
        <Link
          href="/leagues"
          className="brand-focus text-[color:var(--brand-ink)] text-sm font-semibold hover:underline"
        >
          &larr; All leagues
        </Link>
      </div>

      {/* Branded league hero (customizable — docs/roadmap/customizable-pages.md) */}
      <header
        className="relative mb-10 overflow-hidden rounded-3xl text-white"
        style={{ backgroundColor: brand?.primaryColor || "#1d4ed8" }}
      >
        {brand?.bannerUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={brand.bannerUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-br from-black/25 via-black/45 to-black/80" />
        <div aria-hidden className="absolute -right-16 -top-20 h-72 w-72 rounded-full bg-white/10 blur-2xl" />
        <div className="relative p-6 sm:p-8">
          {canManageLeague && leagueId && (
            <Link
              href={`/manage/leagues/${leagueId}/customize`}
              className="brand-focus absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-lg border border-white/40 bg-white/15 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur transition hover:bg-white/25"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
                <path d="M4 20h4L18 10l-4-4L4 16v4z" strokeLinejoin="round" />
                <path d="M13.5 6.5l4 4" strokeLinecap="round" />
              </svg>
              Edit page
            </Link>
          )}
          <div className="flex flex-wrap items-end gap-4">
            {brand?.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={brand.logoUrl}
                alt={`${leagueName} logo`}
                className="h-16 w-16 flex-shrink-0 rounded-2xl border-2 border-white/50 bg-white object-cover shadow sm:h-24 sm:w-24"
              />
            )}
            <div className="min-w-0 flex-1">
              <h1 className="font-condensed text-3xl font-bold uppercase leading-[0.95] tracking-tight drop-shadow sm:text-5xl">
                {leagueName ?? "League"}
              </h1>
              {brand?.tagline && (
                <p className="mt-2 text-sm font-medium text-white/90 drop-shadow sm:text-base">
                  {brand.tagline}
                </p>
              )}
              <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs">
                {season.status === "IN_PROGRESS" && (
                  <span className="bg-gold-400 text-ink-950 rounded-full px-2.5 py-1 font-bold uppercase tracking-wide">
                    Season underway
                  </span>
                )}
                {isOpen && !deadlinePassed && (
                  <span className="bg-court-400 text-court-950 inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-bold uppercase tracking-wide">
                    <span aria-hidden className="bg-court-700 h-1.5 w-1.5 rounded-full" />
                    Registration open
                  </span>
                )}
                {season.label && (
                  <span className="rounded-full bg-white/15 px-2.5 py-1 font-medium backdrop-blur">
                    {season.label}
                  </span>
                )}
              </div>
            </div>
            {leagueId && (
              <FollowButton
                leagueId={leagueId}
                initialFollowing={leagueFollowed}
                isAuthenticated={!!viewerId}
                variant="banner"
              />
            )}
          </div>
          {season.league?.description && (
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/85 line-clamp-3">
              {season.league.description}
            </p>
          )}
          {socialLinks(brand?.socials).length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {socialLinks(brand?.socials).map((l) => (
                <a
                  key={l.key}
                  href={l.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="brand-focus inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/30 bg-white/10 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-white/20"
                >
                  <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-white/70" />
                  {l.label}
                </a>
              ))}
            </div>
          )}
          {/* Quick-stats strip */}
          <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/15 bg-white/10 sm:grid-cols-4">
            {leagueStats.map((s) => (
              <div key={s.label} className="bg-black/10 px-4 py-3 backdrop-blur">
                <div className="font-condensed text-3xl font-bold leading-none">{s.value}</div>
                <div className="mt-1 text-[11px] font-medium uppercase tracking-wide text-white/75">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="space-y-10 lg:col-span-2">
          {(liveGames.length > 0 || recentGames.length > 0 || upcomingGames.length > 0) && (
            <section>
              <SectionHeader title="Scores & schedule" accent="play" className="mb-5" />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {liveGames.map((g: any) => (
                  <Link key={g.id} href={`/live/${g.id}`} className="block">
                    <ScoreCard
                      status="LIVE"
                      home={{ name: g.homeTeam.name, color: g.homeTeam.tenant?.branding?.primaryColor, score: g.homeScore }}
                      away={{ name: g.awayTeam.name, color: g.awayTeam.tenant?.branding?.primaryColor, score: g.awayScore }}
                      venue={g.venue?.name}
                      className="hover:border-play-200 transition-colors"
                    />
                  </Link>
                ))}
                {upcomingGames.map((g: any) => (
                  <Link key={g.id} href={`/live/${g.id}`} className="block">
                    <ScoreCard
                      status="SCHEDULED"
                      home={{ name: g.homeTeam.name, color: g.homeTeam.tenant?.branding?.primaryColor }}
                      away={{ name: g.awayTeam.name, color: g.awayTeam.tenant?.branding?.primaryColor }}
                      dateLabel={format(new Date(g.scheduledAt), "EEE MMM d · h:mm a")}
                      venue={g.venue?.name}
                      className="hover:border-play-200 transition-colors"
                    />
                  </Link>
                ))}
                {recentGames.map((g: any) => (
                  <Link key={g.id} href={`/live/${g.id}`} className="block">
                    <ScoreCard
                      status="FINAL"
                      home={{ name: g.homeTeam.name, color: g.homeTeam.tenant?.branding?.primaryColor, score: g.homeScore }}
                      away={{ name: g.awayTeam.name, color: g.awayTeam.tenant?.branding?.primaryColor, score: g.awayScore }}
                      venue={g.venue?.name}
                      className="hover:border-play-200 transition-colors"
                    />
                  </Link>
                ))}
              </div>
            </section>
          )}

          {standings && standings.divisions.some((d) => d.rows.length > 0) && (
            <section>
              <SectionHeader title="Standings" accent="gold" className="mb-5" />
              {standings.tiebreakerOrder.length === 0 && (
                <p className="text-ink-400 -mt-2 mb-4 text-xs">
                  Tied teams are shown in win-percentage order — this league hasn&apos;t configured
                  tiebreaker rules yet.
                </p>
              )}
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                {standings.divisions
                  .filter((d) => d.rows.length > 0)
                  .map((division) => (
                    <div key={division.divisionId}>
                      <h3 className="text-ink-950 mb-2 px-1 text-sm font-bold uppercase tracking-wide">
                        {division.divisionName}
                      </h3>
                      <StandingsTable
                        rows={division.rows.map((row, i) => {
                          const leader = division.rows[0]
                          const gb = ((leader.wins - row.wins) + (row.losses - leader.losses)) / 2
                          return {
                            rank: i + 1,
                            name: row.name,
                            href: `/team/${row.teamId}`,
                            wins: row.wins,
                            losses: row.losses,
                            pct: row.winPct,
                            gamesBack: i === 0 ? "—" : gb.toFixed(1).replace(/\.0$/, ""),
                            streak: standings.streaks[row.teamId],
                          }
                        })}
                      />
                    </div>
                  ))}
              </div>
            </section>
          )}

          {posts.length > 0 && (
            <section>
              <SectionHeader
                title="League news"
                accent="hoop"
                className="mb-5"
                action={
                  <Link href="/news" className="text-play-600 hover:text-play-700 text-sm font-semibold">
                    All news &rarr;
                  </Link>
                }
              />
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                {posts.map((p: any) => (
                  <NewsCard
                    key={p.id}
                    title={p.title}
                    excerpt={p.body.replace(/\s+/g, " ").slice(0, 140)}
                    coverUrl={p.media?.[0]?.url ?? p.media?.[0]?.posterUrl ?? null}
                    dateLabel={p.publishedAt ? format(new Date(p.publishedAt), "MMM d, yyyy") : ""}
                    author={p.kind === "RECAP_AI" ? "Game recap" : p.kind === "VIDEO" ? "Highlights" : undefined}
                    href={`/news/${p.slug}`}
                  />
                ))}
              </div>
            </section>
          )}

          {teamsByDivision.size > 0 && (
            <section>
              <SectionHeader title="Teams" accent="court" className="mb-5" />
              <div className="space-y-5">
                {[...teamsByDivision.entries()].map(([divisionName, teams]) => (
                  <div key={divisionName}>
                    <h3 className="text-ink-400 mb-2 px-1 text-xs font-bold uppercase tracking-[0.14em]">
                      {divisionName}
                    </h3>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {teams.map((t) => (
                        <Link
                          key={t.id}
                          href={`/team/${t.id}`}
                          className="border-ink-100 hover:border-play-200 hover:bg-ink-50/50 flex items-center justify-between rounded-xl border bg-white px-4 py-3 transition"
                        >
                          <span className="text-ink-950 min-w-0 truncate text-sm font-semibold">{t.name}</span>
                          {t.clubName && <span className="text-ink-400 ml-3 shrink-0 text-xs">{t.clubName}</span>}
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <div className="space-y-6">
          {topScorers.length > 0 && (
            <Card>
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="text-ink-950 text-lg font-bold">Scoring leaders</h2>
                <span className="text-ink-400 text-[10px] font-semibold uppercase tracking-[0.14em]">PPG</span>
              </div>
              <ol className="space-y-2">
                {topScorers.map((row, i) => (
                  <li key={row.playerId} className="flex items-center gap-2.5 text-sm">
                    <span className={`w-4 text-center text-xs font-bold ${i === 0 ? "text-gold-600" : "text-ink-300"}`}>
                      {i + 1}
                    </span>
                    <Link
                      href={`/player/${row.playerId}`}
                      className="text-ink-950 hover:text-play-600 min-w-0 flex-1 truncate font-medium"
                    >
                      {playerDisplayName(row, participant)}
                      <span className="text-ink-400 ml-1.5 text-xs font-normal">{row.teamName}</span>
                    </Link>
                    <span className="font-display font-bold tabular-nums">{row.value.toFixed(1)}</span>
                  </li>
                ))}
              </ol>
              <Link
                href={`/league/${params.id}/leaders`}
                className="text-play-600 hover:text-play-700 mt-4 inline-flex text-sm font-semibold"
              >
                Full leaders board &rarr;
              </Link>
            </Card>
          )}

          <Card>
            <h2 className="text-ink-950 mb-4 text-lg font-bold">Season</h2>
            <div className="space-y-3 text-sm">
              {season.startDate && (
                <div className="flex justify-between">
                  <span className="text-ink-500">Dates</span>
                  <span className="font-medium">
                    {format(new Date(season.startDate), "MMM d")} –{" "}
                    {season.endDate ? format(new Date(season.endDate), "MMM d") : "TBD"}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-ink-500">Teams</span>
                <span className="font-medium tabular-nums">{approvedTeams.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-500">Divisions</span>
                <span className="font-medium tabular-nums">{season.divisions?.length || 0}</span>
              </div>
              {season.gamesGuaranteed && (
                <div className="flex justify-between">
                  <span className="text-ink-500">Games guaranteed</span>
                  <span className="font-medium tabular-nums">{season.gamesGuaranteed}</span>
                </div>
              )}
              {season.playoffFormat && (
                <div className="flex justify-between">
                  <span className="text-ink-500">Playoffs</span>
                  <span className="font-medium">{season.playoffFormat.replace(/_/g, " ")}</span>
                </div>
              )}
            </div>
          </Card>

          {(isOpen || season.teamFee) && (
            <Card>
              {season.teamFee && (
                <div className="mb-4 text-center">
                  <div className="font-condensed text-[color:var(--brand-ink)] text-4xl font-bold leading-none">
                    {formatCurrency(season.teamFee)}
                  </div>
                  <p className="text-ink-500 mt-1 text-xs">per team</p>
                </div>
              )}
              {isOpen && !deadlinePassed ? (
                <>
                  <Link
                    href={`/browse-leagues/${params.id}`}
                    className="brand-focus block w-full rounded-xl bg-[var(--brand)] px-4 py-3 text-center font-bold uppercase tracking-wide text-[color:var(--brand-on)] transition-opacity hover:opacity-90"
                  >
                    Register your team
                  </Link>
                  {season.registrationDeadline && (
                    <p className="text-ink-400 mt-2 text-center text-xs">
                      Deadline {format(new Date(season.registrationDeadline), "MMM d, yyyy")}
                    </p>
                  )}
                </>
              ) : (
                <div className="bg-ink-100 text-ink-600 rounded-2xl p-4 text-center text-sm">
                  {deadlinePassed ? "Registration is closed." : "Registration is not open."}
                </div>
              )}
            </Card>
          )}

          {season.status === "IN_PROGRESS" && (
            <div className="bg-court-50 text-court-800 rounded-2xl p-4 text-sm">
              <Badge tone="court" className="mb-2">In season</Badge>
              <p>
                Games are scored live — tap any final for the full box score and play-by-play, or
                follow the league to see it on your homepage.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
