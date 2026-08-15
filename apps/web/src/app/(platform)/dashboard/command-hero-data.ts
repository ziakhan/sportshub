import { prisma } from "@youthbasketballhub/db"
import { PUBLISHED_GAME } from "@/lib/games/visibility"
import { loadSeasonProgress } from "@/lib/leagues/season-progress-server"
import { SEASON_SETUP_STATUSES } from "@/lib/leagues/season-progress"
import type { DashboardData } from "./get-dashboard-data"

/**
 * The command hero's state (operator dashboard rebuild, 2026-08-14).
 *
 * The old dashboard opened with a greeting and buried "start a season" two
 * scrolls down in the "Do more" tray. An operator's dashboard has to open on
 * the season: what it is, how far along it is, and the one button that moves
 * it. Exactly ONE state renders, chosen by precedence:
 *
 *   league owner : setup season > running season > nothing yet
 *   club owner   : no club > league open for entry > club in season
 *
 * Every query here is additive and read-only; nothing existing changed shape.
 */

const SETUP: readonly string[] = SEASON_SETUP_STATUSES

export interface LeagueSetupHero {
  kind: "league-setup"
  seasonId: string
  seasonLabel: string
  leagueId: string
  leagueName: string
  status: string
  done: number
  total: number
  nextStep: string | null
  href: string
}

export interface LeagueRunningHero {
  kind: "league-running"
  seasonId: string
  seasonLabel: string
  leagueId: string
  leagueName: string
  status: string
  gamesToday: number
  gamesThisWeek: number
  rostersAwaiting: number
  waiversOutstanding: number
  href: string
}

export interface LeagueEmptyHero {
  kind: "league-empty"
  /** True when leagues exist but no season does: "plan your next season". */
  hasLeague: boolean
  href: string
}

export interface ClubEntryHero {
  kind: "club-entry"
  seasonId: string
  seasonLabel: string
  leagueName: string
  clubName: string
  /** Level 1: the club itself is entered. */
  entered: boolean
  /** Level 2: at least one team registered into that season. */
  teamsRegistered: number
  deadline: Date | null
  otherOpen: number
  href: string
  ctaLabel: string
}

export interface ClubRunningHero {
  kind: "club-running"
  clubId: string
  clubName: string
  nextGame: { id: string; label: string; scheduledAt: Date; venue: string | null } | null
  offersPending: number
  teamsMissingCoach: number
  href: string
}

export interface ClubEmptyHero {
  kind: "club-empty"
  href: string
}

export type CommandHeroState =
  | LeagueSetupHero
  | LeagueRunningHero
  | LeagueEmptyHero
  | ClubEntryHero
  | ClubRunningHero
  | ClubEmptyHero

export async function getCommandHero(input: {
  data: DashboardData
  leagueIds: string[]
  tenantIds: string[]
  hasLeagueRole: boolean
  hasClubRole: boolean
}): Promise<CommandHeroState | null> {
  if (input.hasLeagueRole) {
    const hero = await leagueHero(input.data, input.leagueIds)
    if (hero) return hero
  }
  if (input.hasClubRole) {
    return clubHero(input.data, input.tenantIds)
  }
  return null
}

/* ── League owner ─────────────────────────────────────────────────────────── */

async function leagueHero(
  data: DashboardData,
  leagueIds: string[]
): Promise<CommandHeroState | null> {
  const seasons = data.leagueOwner?.leagues ?? []

  // Newest season still being built wins: that is the one the operator is
  // working on, and it is the first card on the page below.
  const setup = seasons.find((s) => SETUP.includes(s.status))
  if (setup) {
    const progress = await loadSeasonProgress(setup.id)
    if (progress) {
      return {
        kind: "league-setup",
        seasonId: progress.seasonId,
        seasonLabel: progress.seasonLabel,
        leagueId: progress.leagueId,
        leagueName: progress.leagueName,
        status: progress.status,
        done: progress.done,
        total: progress.total,
        nextStep: progress.next?.title ?? null,
        href: `/manage/leagues/${progress.leagueId}/seasons/${progress.seasonId}/manage?tab=overview`,
      }
    }
  }

  const running = seasons.find((s) => s.status === "IN_PROGRESS")
  if (running) {
    const now = new Date()
    const dayEnd = new Date(now)
    dayEnd.setHours(23, 59, 59, 999)
    const weekEnd = new Date(now.getTime() + 7 * 24 * 3600_000)
    const [gamesToday, gamesThisWeek, rostersAwaiting, waiversOutstanding] = await Promise.all([
      prisma.game.count({
        where: {
          seasonId: running.id,
          status: { in: ["SCHEDULED", "LIVE"] },
          scheduledAt: { gte: now, lte: dayEnd },
        },
      }),
      prisma.game.count({
        where: {
          seasonId: running.id,
          status: "SCHEDULED",
          scheduledAt: { gte: now, lte: weekEnd },
        },
      }),
      prisma.teamSubmission.count({ where: { seasonId: running.id, status: "PENDING" } }),
      (prisma as any).waiverSignRequest.count({
        where: { seasonId: running.id, consumedAt: null },
      }),
    ])
    return {
      kind: "league-running",
      seasonId: running.id,
      seasonLabel: running.season,
      leagueId: running.leagueId,
      leagueName: running.name,
      status: running.status,
      gamesToday,
      gamesThisWeek,
      rostersAwaiting,
      waiversOutstanding,
      href: `/manage/leagues/${running.leagueId}/seasons/${running.id}/manage?tab=overview`,
    }
  }

  return { kind: "league-empty", hasLeague: leagueIds.length > 0, href: "/manage/leagues" }
}

/* ── Club owner ───────────────────────────────────────────────────────────── */

async function clubHero(
  data: DashboardData,
  tenantIds: string[]
): Promise<CommandHeroState | null> {
  const tenants = data.clubOwner?.tenants ?? []
  if (tenants.length === 0 || tenantIds.length === 0) {
    return { kind: "club-empty", href: "/clubs/create" }
  }

  const entry = await clubEntryHero(data, tenantIds, tenants[0].name)
  if (entry) return entry

  const teamIds = (data.clubOwner?.teams ?? []).map((t) => t.id)
  const nextGame = teamIds.length
    ? await prisma.game.findFirst({
        where: {
          OR: [{ homeTeamId: { in: teamIds } }, { awayTeamId: { in: teamIds } }],
          status: { in: ["SCHEDULED", "LIVE"] },
          scheduledAt: { gte: new Date() },
          ...PUBLISHED_GAME,
        },
        select: {
          id: true,
          scheduledAt: true,
          homeTeam: { select: { name: true } },
          awayTeam: { select: { name: true } },
          venue: { select: { name: true } },
        },
        orderBy: { scheduledAt: "asc" },
      })
    : null

  const teamsMissingCoach = (data.clubOwner?.teams ?? []).filter(
    (t) => t.staff.length === 0
  ).length

  return {
    kind: "club-running",
    clubId: tenants[0].id,
    clubName: tenants[0].name,
    nextGame: nextGame
      ? {
          id: nextGame.id,
          label: `${nextGame.homeTeam.name} vs ${nextGame.awayTeam.name}`,
          scheduledAt: nextGame.scheduledAt,
          venue: nextGame.venue?.name ?? null,
        }
      : null,
    offersPending: data.clubOwner?.offerPipeline.pending ?? 0,
    teamsMissingCoach,
    href: `/clubs/${tenants[0].id}`,
  }
}

/**
 * A league season the club can still act on: entry not submitted, or entered
 * with no team registered yet. Ranked by the deadline that lands first, so
 * the hero always shows the entry that closes soonest.
 */
async function clubEntryHero(
  data: DashboardData,
  tenantIds: string[],
  clubName: string
): Promise<ClubEntryHero | null> {
  const now = new Date()
  const openSeasons = await (prisma as any).season.findMany({
    where: {
      status: "REGISTRATION",
      OR: [{ registrationDeadline: null }, { registrationDeadline: { gte: now } }],
    },
    select: {
      id: true,
      label: true,
      startDate: true,
      registrationDeadline: true,
      league: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 25,
  })
  if (openSeasons.length === 0) return null

  const seasonIds = openSeasons.map((s: any) => s.id)
  const [entries, submissions] = await Promise.all([
    (prisma as any).clubSeasonEntry.findMany({
      where: { seasonId: { in: seasonIds }, tenantId: { in: tenantIds } },
      select: { seasonId: true },
    }),
    prisma.teamSubmission.findMany({
      where: { seasonId: { in: seasonIds }, team: { tenantId: { in: tenantIds } } },
      select: { seasonId: true },
    }),
  ])
  const enteredIds = new Set(entries.map((e: any) => e.seasonId))
  const teamCounts = new Map<string, number>()
  for (const s of submissions) {
    teamCounts.set(s.seasonId, (teamCounts.get(s.seasonId) ?? 0) + 1)
  }

  const open = openSeasons
    .map((s: any) => ({
      season: s,
      entered: enteredIds.has(s.id),
      teams: teamCounts.get(s.id) ?? 0,
      // Deadline first, else tip-off, else far future so dated ones lead.
      when: s.registrationDeadline ?? s.startDate ?? null,
    }))
    .filter((row: any) => !(row.entered && row.teams > 0))

  if (open.length === 0) return null
  open.sort((a: any, b: any) => {
    const at = a.when ? new Date(a.when).getTime() : Number.MAX_SAFE_INTEGER
    const bt = b.when ? new Date(b.when).getTime() : Number.MAX_SAFE_INTEGER
    return at - bt
  })

  const target = open[0]
  const entered = target.entered
  return {
    kind: "club-entry",
    seasonId: target.season.id,
    seasonLabel: target.season.label,
    leagueName: target.season.league?.name ?? "League",
    clubName,
    entered,
    teamsRegistered: target.teams,
    deadline: target.season.registrationDeadline ?? null,
    otherOpen: open.length - 1,
    href: entered ? `/browse-leagues/${target.season.id}` : `/seasons/${target.season.id}/enter`,
    ctaLabel: entered ? "Register your teams" : "Enter the league",
  }
}
