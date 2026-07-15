import { prisma } from "@youthbasketballhub/db"

/**
 * One roster query for every team surface (coach team home, club management
 * dashboard) — schema changes to TeamPlayer land HERE, not in N pages.
 */

export interface RosterEntry {
  id: string
  playerId: string
  jerseyNumber: number | null
  status: string
  joinedAt: Date
  player: { id: string; firstName: string; lastName: string; position: string | null }
}

export async function getTeamRoster(
  teamId: string,
  opts: { activeOnly?: boolean; orderBy?: "jersey" | "joined" } = {}
): Promise<RosterEntry[]> {
  const { activeOnly = false, orderBy = "jersey" } = opts
  return (await prisma.teamPlayer.findMany({
    where: { teamId, ...(activeOnly ? { status: "ACTIVE" } : {}) },
    select: {
      id: true,
      playerId: true,
      jerseyNumber: true,
      status: true,
      joinedAt: true,
      player: { select: { id: true, firstName: true, lastName: true, position: true } },
    },
    orderBy: orderBy === "jersey" ? { jerseyNumber: "asc" } : { joinedAt: "asc" },
  })) as RosterEntry[]
}
