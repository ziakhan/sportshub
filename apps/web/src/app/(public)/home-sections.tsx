import Link from "next/link"
import { format } from "date-fns"
import { Badge, NewsCard, ScoreCard, SectionHeader } from "@/components/ui"
import type { FeedItem, HighlightItem, ScoreboardGame } from "@/lib/queries/content"
import type { SeasonLeaders } from "@/lib/queries/season-stats"
import type { YourTeamCard } from "@/lib/queries/home"
import { playerDisplayName } from "@/lib/privacy/names"

/**
 * Homepage content sections (plan §3). All density-graceful: each section
 * renders nothing when it has no data, so a cold platform still shows the
 * acquisition-focused homepage below.
 */

export function ScoreboardStrip({ games }: { games: ScoreboardGame[] }) {
  if (games.length === 0) return null
  return (
    <section className="border-ink-100 border-b bg-white py-5">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-ink-400 text-xs font-semibold uppercase tracking-[0.2em]">
            Scoreboard
          </span>
          {games.some((g) => g.status === "LIVE") && <Badge tone="live" dot>Live now</Badge>}
        </div>
        <div className="-mx-1 flex gap-4 overflow-x-auto px-1 pb-2">
          {games.map((g) => (
            <Link key={g.id} href={`/live/${g.id}`} className="w-72 shrink-0">
              <ScoreCard
                status={g.status}
                home={{ name: g.home.name, color: g.home.color ?? undefined, score: g.home.score }}
                away={{ name: g.away.name, color: g.away.color ?? undefined, score: g.away.score }}
                dateLabel={format(new Date(g.dateISO), "EEE · h:mm a")}
                venue={[g.leagueName, g.venue].filter(Boolean).join(" · ") || undefined}
                className="hover:border-play-200 h-full transition-colors"
              />
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}

export function NewsAndLeaders({
  feed,
  leaders,
  participantLeagueIds,
}: {
  feed: FeedItem[]
  leaders: SeasonLeaders | null
  participantLeagueIds: Set<string>
}) {
  const hasLeaders = !!leaders && leaders.categories.length > 0
  if (feed.length === 0 && !hasLeaders) return null

  const railCategories = hasLeaders
    ? leaders!.categories.filter((c) => ["ppg", "rpg", "apg"].includes(c.key))
    : []
  const participant = hasLeaders && participantLeagueIds.has(leaders!.season.leagueId)

  return (
    <section className="bg-[#fafafa] py-14 sm:py-16">
      <div className="container mx-auto px-4 sm:px-6">
        <div className={`grid gap-8 ${hasLeaders ? "lg:grid-cols-[1.6fr_1fr]" : ""}`}>
          {feed.length > 0 && (
            <div>
              <SectionHeader
                eyebrow="Around the hub"
                title="Latest news & recaps"
                accent="play"
                className="mb-6"
                action={
                  <Link href="/news" className="text-play-600 hover:text-play-700 text-sm font-semibold">
                    All news &rarr;
                  </Link>
                }
              />
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                {feed.slice(0, 4).map((item) => (
                  <NewsCard
                    key={`${item.type}-${item.id}`}
                    title={item.title}
                    excerpt={item.excerpt}
                    coverUrl={item.coverUrl}
                    dateLabel={format(new Date(item.dateISO), "MMM d")}
                    author={item.author ?? undefined}
                    href={item.href ?? undefined}
                  />
                ))}
              </div>
            </div>
          )}

          {hasLeaders && (
            <div>
              <SectionHeader
                eyebrow={`${leaders!.season.leagueName} ${leaders!.season.label}`}
                title="Stat leaders"
                accent="gold"
                className="mb-6"
              />
              <div className="space-y-4">
                {railCategories.map((cat) => (
                  <div key={cat.key} className="border-ink-100 shadow-soft rounded-2xl border bg-white p-4">
                    <div className="mb-2 flex items-baseline justify-between">
                      <h3 className="text-ink-950 text-sm font-bold">{cat.label}</h3>
                      <span className="text-ink-400 text-[10px] font-semibold uppercase tracking-[0.14em]">
                        per game
                      </span>
                    </div>
                    <ol className="space-y-1.5">
                      {cat.rows.slice(0, 5).map((row, i) => (
                        <li key={row.playerId} className="flex items-center gap-2.5 text-sm">
                          <span className={`w-4 text-center text-xs font-bold tabular-nums ${i === 0 ? "text-gold-600" : "text-ink-300"}`}>
                            {i + 1}
                          </span>
                          <Link
                            href={`/player/${row.playerId}`}
                            className="text-ink-950 hover:text-play-600 min-w-0 flex-1 truncate font-medium"
                          >
                            {playerDisplayName(row, participant)}
                            <span className="text-ink-400 ml-1.5 text-xs font-normal">{row.teamName}</span>
                          </Link>
                          <span className="font-display text-ink-950 font-bold tabular-nums">
                            {row.value.toFixed(1)}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </div>
                ))}
                <Link
                  href={`/league/${leaders!.season.id}/leaders`}
                  className="text-play-600 hover:text-play-700 inline-flex text-sm font-semibold"
                >
                  Full leaders board &rarr;
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

export function HighlightsRow({ highlights }: { highlights: HighlightItem[] }) {
  if (highlights.length === 0) return null
  return (
    <section className="bg-ink-950 py-14 sm:py-16">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="mb-6 flex items-end justify-between gap-6">
          <div>
            <div className="mb-3 inline-flex items-center gap-3">
              <span className="bg-hoop-400 h-px w-10" />
              <span className="text-hoop-300 text-xs font-semibold uppercase tracking-[0.2em]">
                Highlights
              </span>
            </div>
            <h2 className="text-3xl font-bold text-white sm:text-4xl">Watch the best plays</h2>
          </div>
          <Link href="/news" className="text-hoop-300 hover:text-hoop-200 hidden text-sm font-semibold sm:inline-flex">
            All highlights &rarr;
          </Link>
        </div>
        <div className="-mx-1 flex gap-4 overflow-x-auto px-1 pb-2">
          {highlights.map((h) => (
            <Link key={h.id} href={`/news/${h.slug}`} className="group w-80 shrink-0">
              <div className="relative overflow-hidden rounded-2xl">
                <div className="bg-ink-800 aspect-video w-full">
                  {h.posterUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={h.posterUrl}
                      alt=""
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                    />
                  )}
                </div>
                <span className="absolute inset-0 flex items-center justify-center bg-ink-950/20 transition group-hover:bg-ink-950/10">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 shadow-lg">
                    <svg className="text-ink-950 ml-0.5 h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </span>
                </span>
              </div>
              <p className="mt-3 line-clamp-2 text-sm font-semibold text-white">{h.title}</p>
              <p className="text-ink-400 mt-0.5 text-xs">{format(new Date(h.dateISO), "MMM d, yyyy")}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}

export function YourTeamsRail({ cards }: { cards: YourTeamCard[] }) {
  if (cards.length === 0) return null
  return (
    <section className="border-ink-100 border-b bg-white py-10">
      <div className="container mx-auto px-4 sm:px-6">
        <SectionHeader eyebrow="Your teams" title="Catch up on your squad" accent="hoop" className="mb-6" />
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => (
            <div key={card.teamId} className="card-lift border-ink-100 shadow-soft rounded-[24px] border bg-white p-5">
              <Link href={`/team/${card.teamId}`} className="mb-4 flex items-center gap-3">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
                  style={{ backgroundColor: card.color || "#4f46e5" }}
                >
                  {card.teamName.slice(0, 1)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="text-ink-950 hover:text-play-600 block truncate font-bold transition-colors">
                    {card.teamName}
                  </span>
                  <span className="text-ink-400 block text-xs">
                    {[card.clubName, card.ageGroup].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
                    card.kidNames.length > 0
                      ? "bg-hoop-50 text-hoop-700 ring-hoop-100 ring-1"
                      : "bg-ink-100 text-ink-500 ring-ink-200 ring-1"
                  }`}
                >
                  {card.kidNames.length > 0 ? `${card.kidNames.join(" & ")}'s team` : "Following"}
                </span>
              </Link>

              {card.lastGame ? (
                <Link href={`/live/${card.lastGame.gameId}`} className="bg-ink-50 hover:bg-ink-100 mb-2 block rounded-xl px-3.5 py-2.5 transition-colors">
                  <span className="flex items-center justify-between text-sm">
                    <span className="text-ink-500">
                      Last game · {format(new Date(card.lastGame.dateISO), "MMM d")}
                    </span>
                    <span
                      className={`font-bold ${
                        card.lastGame.result === "W"
                          ? "text-court-600"
                          : card.lastGame.result === "L"
                            ? "text-live-600"
                            : "text-ink-600"
                      }`}
                    >
                      {card.lastGame.result} {card.lastGame.us}–{card.lastGame.them}
                    </span>
                  </span>
                  <span className="text-ink-700 block truncate text-sm font-medium">
                    vs {card.lastGame.opponent}
                  </span>
                </Link>
              ) : (
                <div className="bg-ink-50 text-ink-400 mb-2 rounded-xl px-3.5 py-2.5 text-sm">
                  No games played yet
                </div>
              )}

              {card.kidLines.map((line) => (
                <Link
                  key={line.playerId}
                  href={`/player/${line.playerId}`}
                  className="bg-hoop-50 text-hoop-700 hover:bg-hoop-100 mb-2 block rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-colors"
                >
                  {line.name}: {line.points} PTS · {line.rebounds} REB · {line.assists} AST &rarr;
                </Link>
              ))}

              {card.nextGame && (
                <div className="text-ink-500 flex items-center gap-2 px-1 pt-1 text-sm">
                  <svg className="text-ink-400 h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  <span className="truncate">
                    Next: vs {card.nextGame.opponent} ·{" "}
                    {format(new Date(card.nextGame.dateISO), "EEE MMM d, h:mm a")}
                    {card.nextGame.venue ? ` · ${card.nextGame.venue}` : ""}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
