/**
 * DEMO CONTENT GENERATOR — session-cadence feed cards (2026-08-13), LOCAL ONLY.
 *
 * Everything the platform generates today fires at a single game's finalize,
 * which is why the feed goes silent midweek. These kinds are computed across a
 * SESSION instead: league leaderboards, a matchup preview, a rivalry piece.
 *
 * It writes real Post rows with real PostTags, so the normal follow-graph
 * decides who sees them — no special-casing in the feed query. Tagging a
 * league reaches every parent whose kid plays in it; tagging the five listed
 * players also lands the post on their own profiles.
 *
 * `body` carries a JSON payload the card renderer reads; `title` stays
 * human-readable so notifications and share sheets have something sane.
 *
 *   npx tsx scripts/seed-feed-cards.ts            (all demo leagues)
 *   npx tsx scripts/seed-feed-cards.ts --wipe     (remove them again)
 */

import { prisma } from "@youthbasketballhub/db"

const p = prisma as any

const STATS = [
  { key: "points", label: "Points", unit: "PTS" },
  { key: "rebounds", label: "Rebounds", unit: "REB" },
  { key: "assists", label: "Assists", unit: "AST" },
  { key: "steals", label: "Steals", unit: "STL" },
  { key: "blocks", label: "Blocks", unit: "BLK" },
] as const

const PALETTE = ["#4f46e5", "#f24e1e", "#16a34a", "#a16642", "#0891b2", "#c026d3", "#ca8a04"]
function colorFor(id: string, branded?: string | null) {
  if (branded) return branded
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return PALETTE[h % PALETTE.length]
}
const crestOf = (name: string) =>
  name
    .replace(/\b(grade|gr\.?)\s*\d+\w*/gi, "")
    .replace(/\bu\d+\b/gi, "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("")

async function main() {
  const wipe = process.argv.includes("--wipe")
  const KINDS = ["LEADERBOARD", "MATCHUP", "RIVALRY"]

  if (wipe) {
    const del = await p.post.deleteMany({ where: { kind: { in: KINDS } } })
    console.log(`removed ${del.count} generated cards`)
    return
  }

  // Seasons the demo families actually play in.
  const seasons = await p.season.findMany({
    where: { games: { some: { status: "COMPLETED" } } },
    select: { id: true, label: true, leagueId: true, league: { select: { name: true } } },
  })

  let made = 0
  for (const season of seasons) {
    const statRows = await p.playerStat.findMany({
      where: { game: { seasonId: season.id, status: "COMPLETED" } },
      select: {
        playerId: true,
        gameId: true,
        points: true,
        rebounds: true,
        assists: true,
        steals: true,
        blocks: true,
        player: { select: { firstName: true, lastName: true } },
      },
    })
    if (statRows.length < 20) continue

    // Which team each player appeared for, plus club colour.
    const playerTeam = new Map<string, string>()
    const tp = await p.teamPlayer.findMany({
      where: { playerId: { in: [...new Set(statRows.map((r: any) => r.playerId))] }, status: "ACTIVE" },
      select: { playerId: true, teamId: true, jerseyNumber: true },
    })
    const jersey = new Map<string, string>()
    for (const r of tp) {
      playerTeam.set(r.playerId, r.teamId)
      jersey.set(r.playerId, r.jerseyNumber ? String(r.jerseyNumber) : "–")
    }
    const teams = await p.team.findMany({
      where: { id: { in: [...new Set([...playerTeam.values()])] } },
      select: {
        id: true,
        name: true,
        tenantId: true,
        tenant: { select: { branding: { select: { primaryColor: true } } } },
      },
    })
    const teamById = new Map(teams.map((t: any) => [t.id, t]))

    // Every team that actually played in this season — the real audience for
    // league-wide content, given the targeting gap described below.
    const seasonGames = await p.game.findMany({
      where: { seasonId: season.id },
      select: { homeTeamId: true, awayTeamId: true },
    })
    const seasonTeamIds = [
      ...new Set(seasonGames.flatMap((g: any) => [g.homeTeamId, g.awayTeamId]).filter(Boolean)),
    ] as string[]

    // ── Leaderboards: one post per stat ────────────────────────────────
    for (const stat of STATS) {
      const totals = new Map<string, { sum: number; games: number; name: string }>()
      for (const r of statRows) {
        const cur = totals.get(r.playerId) ?? {
          sum: 0,
          games: 0,
          name: `${r.player.firstName} ${r.player.lastName}`.trim(),
        }
        cur.sum += r[stat.key] ?? 0
        cur.games += 1
        totals.set(r.playerId, cur)
      }
      const rows = [...totals.entries()]
        .filter(([pid, v]) => v.games >= 2 && playerTeam.has(pid))
        .map(([pid, v]) => {
          const t: any = teamById.get(playerTeam.get(pid)!)
          return {
            playerId: pid,
            rank: 0,
            name: v.name,
            team: t?.name ?? "Unknown",
            teamColor: colorFor(t?.id ?? pid, t?.tenant?.branding?.primaryColor),
            jersey: jersey.get(pid) ?? "–",
            value: Math.round((v.sum / v.games) * 10) / 10,
          }
        })
        .sort((a, b) => b.value - a.value)
        .slice(0, 5)
        .map((r, i) => ({ ...r, rank: i + 1 }))
      if (rows.length < 3) continue

      const slug = `leaderboard-${season.id}-${stat.key}`
      const title = `${stat.label} leaders — ${season.league.name}`
      const post = await p.post.upsert({
        where: { slug },
        update: { title, body: JSON.stringify({ statLabel: stat.label, unit: stat.unit, period: `${season.league.name} · ${season.label}`, rows }) },
        create: {
          kind: "LEADERBOARD",
          title,
          slug,
          body: JSON.stringify({ statLabel: stat.label, unit: stat.unit, period: `${season.league.name} · ${season.label}`, rows }),
          status: "PUBLISHED",
          publishedAt: new Date(Date.now() - Math.random() * 3 * 86_400_000),
          visibility: "PUBLIC",
        },
      })
      await p.postTag.deleteMany({ where: { postId: post.id } })
      await p.postTag.create({ data: { postId: post.id, leagueId: season.leagueId } })
      // Every listed player is tagged, so it reaches their followers too.
      for (const r of rows) {
        await p.postTag.create({ data: { postId: post.id, playerId: r.playerId } })
      }
      // …and every team in the season. This looks redundant next to the
      // league tag, but getFeedTargets() only collects leagueIds from
      // EXPLICIT follows — a parent's kids contribute teamIds only, never
      // the league their team plays in. Without team tags, league-wide
      // content silently reaches nobody's family. Logged as a platform gap.
      for (const t of seasonTeamIds) {
        await p.postTag.create({ data: { postId: post.id, teamId: t } })
      }
      made++
    }

    // ── Matchup preview: the next scheduled game in this season ────────
    const upcoming = await p.game.findFirst({
      where: { seasonId: season.id, status: "SCHEDULED", publishedAt: { not: null } },
      orderBy: { scheduledAt: "asc" },
      select: {
        id: true,
        scheduledAt: true,
        homeTeamId: true,
        awayTeamId: true,
        venue: { select: { name: true } },
        homeTeam: { select: { name: true, tenantId: true, tenant: { select: { branding: { select: { primaryColor: true } } } } } },
        awayTeam: { select: { name: true, tenantId: true, tenant: { select: { branding: { select: { primaryColor: true } } } } } },
      },
    })
    if (upcoming) {
      const h = upcoming.homeTeam
      const a = upcoming.awayTeam
      const payload = {
        home: { name: h.name, short: h.name, record: "", color: colorFor(upcoming.homeTeamId, h.tenant?.branding?.primaryColor), crest: crestOf(h.name) },
        away: { name: a.name, short: a.name, record: "", color: colorFor(upcoming.awayTeamId, a.tenant?.branding?.primaryColor), crest: crestOf(a.name) },
        when: new Date(upcoming.scheduledAt).toLocaleString(undefined, { weekday: "long", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }),
        venue: upcoming.venue?.name ?? "Venue TBC",
        gameId: upcoming.id,
        note: `${h.name} host ${a.name} in ${season.league.name}. Both sides come in off a full session, and the result shapes the table with the season winding on.`,
      }
      const slug = `matchup-${upcoming.id}`
      const title = `Matchup of the week: ${h.name} vs ${a.name}`
      const post = await p.post.upsert({
        where: { slug },
        update: { title, body: JSON.stringify(payload) },
        create: {
          kind: "MATCHUP",
          title,
          slug,
          body: JSON.stringify(payload),
          status: "PUBLISHED",
          publishedAt: new Date(),
          visibility: "PUBLIC",
        },
      })
      await p.postTag.deleteMany({ where: { postId: post.id } })
      await p.postTag.createMany({
        data: [
          { postId: post.id, leagueId: season.leagueId },
          { postId: post.id, gameId: upcoming.id },
          ...seasonTeamIds.map((t) => ({ postId: post.id, teamId: t })),
        ],
      })
      made++
    }

    // ── Rivalry: a pairing that has met more than once ─────────────────
    const played = await p.game.findMany({
      where: { seasonId: season.id, status: "COMPLETED" },
      select: { id: true, homeTeamId: true, awayTeamId: true, homeScore: true, awayScore: true, scheduledAt: true },
      orderBy: { scheduledAt: "asc" },
    })
    const pairs = new Map<string, any[]>()
    for (const g of played) {
      const key = [g.homeTeamId, g.awayTeamId].sort().join("|")
      pairs.set(key, [...(pairs.get(key) ?? []), g])
    }
    const rivalry = [...pairs.entries()].find(([, gs]) => gs.length >= 2)
    if (rivalry) {
      const [key, gs] = rivalry
      const [tA, tB] = key.split("|")
      const A: any = teamById.get(tA) ?? (await p.team.findUnique({ where: { id: tA }, select: { id: true, name: true, tenant: { select: { branding: { select: { primaryColor: true } } } } } }))
      const B: any = teamById.get(tB) ?? (await p.team.findUnique({ where: { id: tB }, select: { id: true, name: true, tenant: { select: { branding: { select: { primaryColor: true } } } } } }))
      if (A && B) {
        let aWins = 0
        let bWins = 0
        const meetings = gs.map((g: any) => {
          const homeWon = (g.homeScore ?? 0) > (g.awayScore ?? 0)
          const winnerId = homeWon ? g.homeTeamId : g.awayTeamId
          if (winnerId === A.id) aWins++
          else bWins++
          const homeName = g.homeTeamId === A.id ? A.name : B.name
          const awayName = g.awayTeamId === A.id ? A.name : B.name
          return {
            date: new Date(g.scheduledAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
            result: `${homeName} ${g.homeScore} — ${g.awayScore} ${awayName}`,
            winnerColor: colorFor(winnerId, (winnerId === A.id ? A : B)?.tenant?.branding?.primaryColor),
          }
        })
        const payload = {
          home: { name: A.name, short: A.name, record: "", color: colorFor(A.id, A.tenant?.branding?.primaryColor), crest: crestOf(A.name) },
          away: { name: B.name, short: B.name, record: "", color: colorFor(B.id, B.tenant?.branding?.primaryColor), crest: crestOf(B.name) },
          seriesLine: aWins === bWins ? `Series tied ${aWins}–${bWins}` : `${aWins > bWins ? A.name : B.name} lead ${Math.max(aWins, bWins)}–${Math.min(aWins, bWins)}`,
          headline: `${A.name} and ${B.name} have unfinished business`,
          lede: `These two have met ${gs.length} times this season and neither night resembled the other. The series below is the whole story so far — and it is why the next meeting matters more than the table suggests.`,
          meetings,
          stakes: "The head-to-head record is the first tiebreaker when seeding is decided.",
          when: "Next meeting to be scheduled",
        }
        const slug = `rivalry-${season.id}-${key.slice(0, 8)}`
        const title = `Rivalry: ${A.name} vs ${B.name}`
        const post = await p.post.upsert({
          where: { slug },
          update: { title, body: JSON.stringify(payload) },
          create: {
            kind: "RIVALRY",
            title,
            slug,
            body: JSON.stringify(payload),
            status: "PUBLISHED",
            publishedAt: new Date(Date.now() - 86_400_000),
            visibility: "PUBLIC",
          },
        })
        await p.postTag.deleteMany({ where: { postId: post.id } })
        await p.postTag.createMany({
          data: [
            { postId: post.id, leagueId: season.leagueId },
            ...seasonTeamIds.map((t) => ({ postId: post.id, teamId: t })),
          ],
        })
        made++
      }
    }

    console.log(`✓ ${season.league.name} / ${season.label}`)
  }

  console.log(`\n${made} generated cards published.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
