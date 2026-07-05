import { notFound } from "next/navigation"
import { prisma } from "@youthbasketballhub/db"
import { foldEvents, totalRebounds, FOUL_LIMIT, type FoldEvent } from "@/lib/scoring/fold"
import { PrintButton } from "./print-button"

export const dynamic = "force-dynamic"

/**
 * The official scoresheet — a paper-style game record referenceable anywhere
 * on the web, designed to print onto one page (black on white, signature
 * lines, foul boxes, quarter line score). Public, like the live page.
 */
export default async function ScoresheetPage({ params }: { params: { gameId: string } }) {
  const game = await (prisma as any).game.findUnique({
    where: { id: params.gameId },
    select: {
      id: true,
      seasonId: true,
      status: true,
      scheduledAt: true,
      homeScore: true,
      awayScore: true,
      finalizedAt: true,
      refereeName: true,
      refereeSignedAt: true,
      homeTeamId: true,
      awayTeamId: true,
      homeTeam: { select: { name: true } },
      awayTeam: { select: { name: true } },
      venue: { select: { name: true } },
      court: { select: { name: true } },
      season: { select: { label: true, league: { select: { name: true, periodType: true } } } },
    },
  })
  if (!game) notFound()

  const [rows, submissions] = await Promise.all([
    (prisma as any).gameEvent.findMany({
      where: { gameId: params.gameId },
      orderBy: { sequence: "asc" },
    }),
    (prisma as any).teamSubmission.findMany({
      where: {
        seasonId: game.seasonId ?? undefined,
        teamId: { in: [game.homeTeamId, game.awayTeamId] },
        status: "APPROVED",
      },
      select: {
        roster: {
          select: {
            players: {
              select: {
                playerId: true,
                jerseyNumber: true,
                player: { select: { firstName: true, lastName: true } },
              },
            },
          },
        },
      },
    }),
  ])

  const events: FoldEvent[] = rows.map((e: any) => ({
    eventType: e.eventType,
    teamId: e.teamId,
    playerId: e.playerId,
    made: e.made,
    period: e.period,
    voided: e.voided,
    sequence: e.sequence,
    metadata: e.metadata ?? null,
  }))
  const fold = foldEvents(events, { homeTeamId: game.homeTeamId, awayTeamId: game.awayTeamId })

  const nameById = new Map<string, { name: string; jersey: string }>()
  for (const s of submissions) {
    for (const p of s.roster?.players ?? []) {
      nameById.set(p.playerId, {
        name: `${p.player.firstName} ${p.player.lastName}`.trim(),
        jersey: p.jerseyNumber != null ? String(p.jerseyNumber) : "?",
      })
    }
  }

  // Quarter-by-quarter line score from the (non-voided) scoring events
  const periods = Array.from(
    new Set(fold.playByPlay.filter((e) => e.period).map((e) => e.period as number))
  ).sort((a, b) => a - b)
  const lineScore = (teamId: string) =>
    periods.map((p) =>
      fold.playByPlay
        .filter(
          (e) =>
            e.teamId === teamId &&
            e.period === p &&
            e.made !== false &&
            ["SCORE_2PT", "SCORE_3PT", "SCORE_FT"].includes(e.eventType)
        )
        .reduce(
          (sum, e) => sum + (e.eventType === "SCORE_2PT" ? 2 : e.eventType === "SCORE_3PT" ? 3 : 1),
          0
        )
    )

  const final = game.status === "COMPLETED"
  const homeScore = final && game.homeScore != null ? game.homeScore : fold.homeScore
  const awayScore = final && game.awayScore != null ? game.awayScore : fold.awayScore

  const teamBlock = (teamId: string, teamName: string) => {
    const lines = Object.values(fold.players)
      .filter((l) => l.teamId === teamId)
      .sort((a, b) => Number(nameById.get(a.playerId)?.jersey) - Number(nameById.get(b.playerId)?.jersey))
    const totals = lines.reduce(
      (t, l) => ({
        pts: t.pts + l.points,
        reb: t.reb + totalRebounds(l),
        ast: t.ast + l.assists,
        pf: t.pf + l.fouls,
      }),
      { pts: 0, reb: 0, ast: 0, pf: 0 }
    )
    return (
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="border-b-2 border-black text-left">
            <th className="py-1 pr-1 font-bold" colSpan={2}>
              {teamName}
            </th>
            <th className="px-1 text-center">Fouls</th>
            <th className="px-1 text-right">2P</th>
            <th className="px-1 text-right">3P</th>
            <th className="px-1 text-right">FT</th>
            <th className="px-1 text-right">REB</th>
            <th className="px-1 text-right">AST</th>
            <th className="px-1 text-right">PTS</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => {
            const info = nameById.get(l.playerId)
            return (
              <tr key={l.playerId} className="border-b border-gray-400">
                <td className="w-8 py-1 pr-1 font-bold">#{info?.jersey ?? "?"}</td>
                <td className="py-1 pr-1">{info?.name ?? l.playerId.slice(0, 8)}</td>
                <td className="px-1 text-center font-mono tracking-widest">
                  {Array.from({ length: FOUL_LIMIT }, (_, i) =>
                    i < l.fouls ? (i < l.fouls - l.technicalFouls ? "☒" : "Ⓣ") : "☐"
                  ).join("")}
                </td>
                <td className="px-1 text-right">
                  {l.fgMade2}
                  {l.fgMiss2 > 0 ? `/${l.fgMade2 + l.fgMiss2}` : ""}
                </td>
                <td className="px-1 text-right">
                  {l.fgMade3}
                  {l.fgMiss3 > 0 ? `/${l.fgMade3 + l.fgMiss3}` : ""}
                </td>
                <td className="px-1 text-right">
                  {l.ftMade}
                  {l.ftMiss > 0 ? `/${l.ftMade + l.ftMiss}` : ""}
                </td>
                <td className="px-1 text-right">{totalRebounds(l)}</td>
                <td className="px-1 text-right">{l.assists}</td>
                <td className="px-1 text-right font-bold">{l.points}</td>
              </tr>
            )
          })}
          <tr className="border-t-2 border-black font-bold">
            <td colSpan={2} className="py-1 pr-1">
              TOTALS
            </td>
            <td className="px-1 text-center">{totals.pf}</td>
            <td colSpan={3}></td>
            <td className="px-1 text-right">{totals.reb}</td>
            <td className="px-1 text-right">{totals.ast}</td>
            <td className="px-1 text-right">{totals.pts}</td>
          </tr>
        </tbody>
      </table>
    )
  }

  return (
    <div className="mx-auto max-w-3xl bg-white p-6 text-black print:max-w-none print:p-0">
      {!final && (
        <p className="mb-3 rounded border border-amber-400 bg-amber-50 p-2 text-center text-xs font-bold text-amber-800 print:bg-white">
          UNOFFICIAL — GAME NOT FINALIZED
        </p>
      )}

      <div className="border-2 border-black p-4">
        {/* header */}
        <div className="flex items-start justify-between border-b-2 border-black pb-2">
          <div>
            <h1 className="text-lg font-bold uppercase">Official Scoresheet</h1>
            <p className="text-xs">
              {game.season?.league?.name ?? "—"}
              {game.season?.label ? ` · ${game.season.label}` : ""}
            </p>
          </div>
          <div className="text-right text-xs">
            <p>{new Date(game.scheduledAt).toLocaleString()}</p>
            <p>
              {game.venue?.name ?? ""}
              {game.court?.name ? ` · ${game.court.name}` : ""}
            </p>
          </div>
        </div>

        {/* score + line score */}
        <div className="my-3 flex items-center justify-between gap-4">
          <div className="text-center">
            <p className="text-sm font-bold">{game.homeTeam.name}</p>
            <p className="text-4xl font-bold">{homeScore}</p>
          </div>
          <table className="border-collapse text-center text-xs">
            <thead>
              <tr>
                <th className="border border-black px-2 py-0.5"></th>
                {periods.map((p) => (
                  <th key={p} className="border border-black px-2 py-0.5">
                    {game.season?.league?.periodType === "HALVES" ? `H${p}` : p <= 4 ? `Q${p}` : `OT${p - 4}`}
                  </th>
                ))}
                <th className="border border-black px-2 py-0.5">F</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-black px-2 py-0.5 text-left font-bold">
                  {game.homeTeam.name.slice(0, 12)}
                </td>
                {lineScore(game.homeTeamId).map((s, i) => (
                  <td key={i} className="border border-black px-2 py-0.5">
                    {s}
                  </td>
                ))}
                <td className="border border-black px-2 py-0.5 font-bold">{homeScore}</td>
              </tr>
              <tr>
                <td className="border border-black px-2 py-0.5 text-left font-bold">
                  {game.awayTeam.name.slice(0, 12)}
                </td>
                {lineScore(game.awayTeamId).map((s, i) => (
                  <td key={i} className="border border-black px-2 py-0.5">
                    {s}
                  </td>
                ))}
                <td className="border border-black px-2 py-0.5 font-bold">{awayScore}</td>
              </tr>
            </tbody>
          </table>
          <div className="text-center">
            <p className="text-sm font-bold">{game.awayTeam.name}</p>
            <p className="text-4xl font-bold">{awayScore}</p>
          </div>
        </div>

        {/* team blocks */}
        <div className="grid gap-4 md:grid-cols-2 print:grid-cols-2">
          {teamBlock(game.homeTeamId, game.homeTeam.name)}
          {teamBlock(game.awayTeamId, game.awayTeam.name)}
        </div>
        <p className="mt-1 text-[10px] text-gray-600 print:text-black">
          Fouls: ☒ personal · Ⓣ technical. Shooting columns show makes (or makes/attempts where
          misses were tracked).
        </p>

        {/* signatures */}
        <div className="mt-6 grid grid-cols-2 gap-8 text-xs">
          <div>
            <p className="border-t border-black pt-1">
              Referee{game.refereeName ? `: ${game.refereeName}` : ""}
              {game.refereeSignedAt
                ? ` — signed ${new Date(game.refereeSignedAt).toLocaleString()}`
                : ""}
            </p>
          </div>
          <div>
            <p className="border-t border-black pt-1">
              Scorekeeper
              {game.finalizedAt ? ` — finalized ${new Date(game.finalizedAt).toLocaleString()}` : ""}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 flex justify-center gap-3 print:hidden">
        <PrintButton />
        <a
          href={`/live/${game.id}`}
          className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          Box score &amp; play-by-play
        </a>
      </div>
    </div>
  )
}
