import { prisma } from "@youthbasketballhub/db"

// Limited-launch demo world plumbing (limited-launch-demo-build-2026-08.md).
// One switch, one derivation rule: an entity is demo iff its Tenant or
// League is flagged. Children never carry their own flag.

const SWITCH_TTL_MS = 60_000

let cached: { value: boolean; at: number } | null = null

/** The kill switch. OFF hides every demo surface; data stays, unlisted. */
export async function isDemoModeEnabled(): Promise<boolean> {
  if (cached && Date.now() - cached.at < SWITCH_TTL_MS) return cached.value
  const settings = await prisma.platformSettings.findUnique({
    where: { id: "default" },
    select: { demoModeEnabled: true },
  })
  const value = settings?.demoModeEnabled ?? false
  cached = { value, at: Date.now() }
  return value
}

/** Test/admin escape hatch so a flipped switch is visible immediately. */
export function invalidateDemoModeCache() {
  cached = null
}

/**
 * Where-clause fragment that keeps demo tenants out of real public listings.
 * Use on any public directory/browse query over Tenant.
 */
export const excludeDemoTenants = { isDemo: false } as const

/** Same for League-based listings. */
export const excludeDemoLeagues = { isDemo: false } as const

/**
 * Demo tenants for the labeled "Preview" directory section. Returns [] when
 * the switch is off so callers need no extra guard.
 */
export async function demoTenantsForDirectory() {
  if (!(await isDemoModeEnabled())) return []
  return prisma.tenant.findMany({
    where: { isDemo: true, status: "ACTIVE" },
    orderBy: { name: "asc" },
  })
}

/** Demo leagues for the leagues directory "Preview" section. */
export async function demoLeaguesForDirectory() {
  if (!(await isDemoModeEnabled())) return []
  return prisma.league.findMany({
    where: { isDemo: true },
    orderBy: { name: "asc" },
  })
}

/**
 * Scoreboard for the welcome modal: what the seeded demo world actually
 * contains. A feature list can only claim breadth; these numbers prove a
 * real season is already sitting behind the button. Returns null when the
 * switch is off or nothing is seeded, so the strip simply hides.
 */
export async function demoSeasonStats(): Promise<{
  clubs: number
  teams: number
  games: number
} | null> {
  if (!(await isDemoModeEnabled())) return null
  const [clubs, teams, games] = await Promise.all([
    prisma.tenant.count({ where: { isDemo: true, status: "ACTIVE" } }),
    prisma.team.count({ where: { tenant: { isDemo: true } } }),
    prisma.game.count({
      where: { status: "COMPLETED", season: { league: { isDemo: true } } },
    }),
  ])
  if (clubs === 0 && teams === 0 && games === 0) return null
  return { clubs, teams, games }
}

/** Derivation for surfaces that only hold a game id. */
export async function isDemoGame(gameId: string): Promise<boolean> {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { season: { select: { league: { select: { isDemo: true } } } } },
  })
  return (game as any)?.season?.league?.isDemo ?? false
}

/** Derivation for surfaces that only hold a season id. */
export async function isDemoSeason(seasonId: string): Promise<boolean> {
  const season = await prisma.season.findUnique({
    where: { id: seasonId },
    select: { league: { select: { isDemo: true } } },
  })
  return season?.league?.isDemo ?? false
}
