import { prisma } from "@youthbasketballhub/db"

/**
 * Public leagues directory — ONE source for the web /leagues page and the
 * native Browse → Leagues screen (2026-07-24 drift fix).
 *
 * Root cause of the drift: the mobile route filtered
 * `seasons: { some: { status: { in: [REGISTRATION, IN_PROGRESS] } } } }`
 * while the web page used `seasons: { some: {} } }` (any season, any
 * status) — a brand-new league sitting in DRAFT, or one whose only season
 * had gone REGISTRATION_CLOSED/FINALIZED/COMPLETED, was invisible on iOS
 * while still showing on web. Same class of bug as the prior cover-image
 * drift: two independent queries for what should be one browse surface.
 *
 * This module owns the web's semantics — any league with at least one
 * season, ordered with active content first — and both consumers render
 * off it. Mobile maps the result into its existing JSON shape and may add
 * fields; it must never narrow the underlying set.
 */

export interface DirectoryLeagueSeason {
  id: string
  label: string
  status: string
  startDate: Date | null
  endDate: Date | null
  /** APPROVED team submissions only — matches the web page's team count. */
  teamCount: number
  divisionCount: number
}

export interface DirectoryLeague {
  id: string
  name: string
  description: string | null
  perks: string[]
  /** Latest season by createdAt — the one the card links to. */
  season: DirectoryLeagueSeason
  completedGames: number
  liveGames: number
}

export async function getLeaguesDirectory(): Promise<DirectoryLeague[]> {
  const leagues = await (prisma as any).league.findMany({
    // Any league with a season — NOT narrowed to REGISTRATION/IN_PROGRESS.
    // A league in DRAFT or between seasons still belongs in the directory.
    where: { seasons: { some: {} } },
    select: {
      id: true,
      name: true,
      description: true,
      perks: true,
      seasons: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          label: true,
          status: true,
          startDate: true,
          endDate: true,
          _count: {
            select: {
              teamSubmissions: { where: { status: "APPROVED" } },
              divisions: true,
            },
          },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  })

  const directory = await Promise.all(
    leagues
      .filter((l: any) => l.seasons.length > 0)
      .map(async (l: any) => {
        const season = l.seasons[0]
        const [completedGames, liveGames] = await Promise.all([
          (prisma as any).game.count({ where: { seasonId: season.id, status: "COMPLETED" } }),
          (prisma as any).game.count({ where: { seasonId: season.id, status: "LIVE" } }),
        ])
        const league: DirectoryLeague = {
          id: l.id,
          name: l.name,
          description: l.description,
          perks: l.perks ?? [],
          season: {
            id: season.id,
            label: season.label,
            status: season.status,
            startDate: season.startDate,
            endDate: season.endDate,
            teamCount: season._count.teamSubmissions,
            divisionCount: season._count.divisions,
          },
          completedGames,
          liveGames,
        }
        return league
      })
  )

  // Active content first (live, then most completed games), drafts/quiet
  // leagues last — same ordering the web page has always applied.
  directory.sort((a, b) => b.completedGames + b.liveGames * 10 - (a.completedGames + a.liveGames * 10))
  return directory
}
