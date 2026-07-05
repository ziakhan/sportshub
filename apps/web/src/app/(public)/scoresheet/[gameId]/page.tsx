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
      season: {
        select: {
          label: true,
          league: { select: { name: true, periodType: true, requireRefereeApproval: true } },
        },
      },
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

  // Scorebook notation, per player per period, in game order: made field
  // goals are written as their digit ("2"/"3"), misses as a struck light
  // digit, free throws as circles — ● made, ○ missed.
  type Mark = { kind: "fg" | "ft"; digit?: 2 | 3; made: boolean }
  const marks = new Map<string, Map<number, Mark[]>>()
  for (const e of fold.playByPlay) {
    if (!e.playerId || !["SCORE_2PT", "SCORE_3PT", "SCORE_FT"].includes(e.eventType)) continue
    const period = e.period ?? 1
    const byPeriod = marks.get(e.playerId) ?? new Map<number, Mark[]>()
    const list = byPeriod.get(period) ?? []
    list.push(
      e.eventType === "SCORE_FT"
        ? { kind: "ft", made: e.made !== false }
        : { kind: "fg", digit: e.eventType === "SCORE_2PT" ? 2 : 3, made: e.made !== false }
    )
    byPeriod.set(period, list)
    marks.set(e.playerId, byPeriod)
  }
  const renderMarks = (playerId: string, period: number) => {
    const list = marks.get(playerId)?.get(period) ?? []
    if (list.length === 0) return <span className="text-gray-300">·</span>
    return list.map((m, i) =>
      m.kind === "ft" ? (
        <span key={i}>{m.made ? "●" : "○"}</span>
      ) : (
        <span key={i} className={m.made ? "font-bold" : "text-gray-400 line-through"}>
          {m.digit}
        </span>
      )
    )
  }

  const teamBlock = (teamId: string, teamName: string) => {
    const lines = Object.values(fold.players)
      .filter((l) => l.teamId === teamId)
      .sort(
        (a, b) =>
          Number(nameById.get(a.playerId)?.jersey) - Number(nameById.get(b.playerId)?.jersey)
      )
    const totals = lines.reduce(
      (t, l) => ({
        pts: t.pts + l.points,
        reb: t.reb + totalRebounds(l),
        ast: t.ast + l.assists,
        pf: t.pf + l.fouls,
        stl: t.stl + l.steals,
        blk: t.blk + l.blocks,
        to: t.to + l.turnovers,
      }),
      { pts: 0, reb: 0, ast: 0, pf: 0, stl: 0, blk: 0, to: 0 }
    )
    return (
      <div>
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b-2 border-black text-left">
              <th className="py-1 pr-1 font-bold" colSpan={2}>
                {teamName}
              </th>
              <th className="px-1 text-center">Fouls</th>
              {periods.map((p) => (
                <th key={p} className="border-l border-gray-400 px-1 text-center">
                  {game.season?.league?.periodType === "HALVES"
                    ? `H${p}`
                    : p <= 4
                      ? `Q${p}`
                      : `OT${p - 4}`}
                </th>
              ))}
              <th className="border-l border-gray-400 px-1 text-right">REB</th>
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
                  <td className="max-w-[130px] truncate py-1 pr-1">
                    {info?.name ?? l.playerId.slice(0, 8)}
                  </td>
                  <td className="whitespace-nowrap px-1 text-center font-mono tracking-widest">
                    {Array.from({ length: FOUL_LIMIT }, (_, i) =>
                      i < l.fouls ? (i < l.fouls - l.technicalFouls ? "☒" : "Ⓣ") : "☐"
                    ).join("")}
                  </td>
                  {periods.map((p) => (
                    <td
                      key={p}
                      className="space-x-0.5 whitespace-nowrap border-l border-gray-400 px-1 text-center tracking-wide"
                    >
                      {renderMarks(l.playerId, p)}
                    </td>
                  ))}
                  <td className="border-l border-gray-400 px-1 text-right">{totalRebounds(l)}</td>
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
              {periods.map((p, i) => (
                <td key={p} className="border-l border-gray-400 px-1 text-center">
                  {lineScore(teamId)[i]}
                </td>
              ))}
              <td className="border-l border-gray-400 px-1 text-right">{totals.reb}</td>
              <td className="px-1 text-right">{totals.ast}</td>
              <td className="px-1 text-right">{totals.pts}</td>
            </tr>
          </tbody>
        </table>
        {(totals.stl > 0 || totals.blk > 0 || totals.to > 0) && (
          <p className="mt-0.5 text-[10px] text-gray-600 print:text-black">
            Team: {totals.stl} STL · {totals.blk} BLK · {totals.to} TO
          </p>
        )}
      </div>
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

        {/* team blocks — stacked like a real book, quarter cells need width */}
        <div className="space-y-5">
          {teamBlock(game.homeTeamId, game.homeTeam.name)}
          {teamBlock(game.awayTeamId, game.awayTeam.name)}
        </div>
        <p className="mt-1 text-[10px] text-gray-600 print:text-black">
          Scoring marks per quarter, in game order: <strong>2</strong>/<strong>3</strong> = made
          field goal · <span className="text-gray-400 line-through">2</span> = missed (where
          tracked) · ● made free throw · ○ missed free throw. Fouls: ☒ personal · Ⓣ technical.
        </p>

        {/* signatures */}
        {final && game.season?.league?.requireRefereeApproval && !game.refereeName && (
          <p className="mt-4 border-2 border-black p-2 text-center text-sm font-bold uppercase">
            Finalized without referee approval
          </p>
        )}
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
