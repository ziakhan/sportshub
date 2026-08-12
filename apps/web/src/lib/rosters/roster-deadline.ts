import { prisma } from "@youthbasketballhub/db"
// Relative (not "@/") imports throughout: lib/scheduler/load.ts pulls this
// module, and the demo seed reaches load.ts straight through tsx without the
// app's path alias.
import { effectiveSeasonConfig } from "../org/season-defaults"

/**
 * The league's roster deadline and what it enforces (owner ruling 2026-08-11,
 * QA T-017).
 *
 * There is NO new deadline field anywhere: the season's EXISTING registration
 * deadline is the roster-submission deadline — it is the date submit-team.ts
 * already refuses entries after, resolved season → org rulebook the same way
 * every other config read is. A season without one is simply silent: no
 * reminders, no exclusions.
 *
 * "Done" for the draw means the club SUBMITTED the roster to the league
 * (submittedAt), or it is already locked for play (isLocked — a locked
 * roster is a done deal). Submission is the only state the league, the
 * reminders and the draw care about (owner ruling 2026-08-12: the separate
 * finalize action was removed as a state with no consumer).
 */

export interface RosterComplianceInput {
  isLocked?: boolean | null
  submittedAt?: Date | string | null
}

export function isRosterFinal(roster: RosterComplianceInput | null | undefined): boolean {
  if (!roster) return false
  return roster.submittedAt != null || roster.isLocked === true
}

export function isRosterSubmitted(roster: RosterComplianceInput | null | undefined): boolean {
  if (!roster) return false
  return roster.submittedAt != null
}

/** The effective roster deadline for a season row that carries the raw Season
 *  columns plus the org rulebook blob. Null = the league never set one. */
export function effectiveRosterDeadline(
  season: Record<string, unknown>,
  rawOrgDefaults: unknown
): Date | null {
  const { values } = effectiveSeasonConfig(season, rawOrgDefaults)
  const raw = values.registrationDeadline
  if (!raw) return null
  const date = new Date(raw as string | Date)
  return Number.isNaN(date.getTime()) ? null : date
}

export interface RosterDrawExclusion {
  submissionId: string
  teamId: string
  teamName: string
  tenantId: string
  clubName: string | null
  playerCount: number
}

/**
 * Teams the planning draw must leave out (owner ruling 2026-08-11, QA T-017):
 * APPROVED submissions whose roster is not final once the season's roster
 * deadline has passed. Returns null while there is nothing to enforce — no
 * deadline, or the deadline is still ahead.
 */
export async function listRosterDrawExclusions(
  seasonId: string,
  now: Date = new Date()
): Promise<{ deadline: Date; excluded: RosterDrawExclusion[] } | null> {
  const season = (await (prisma as any).season.findUnique({
    where: { id: seasonId },
    select: {
      id: true,
      registrationDeadline: true,
      league: { select: { organization: { select: { seasonDefaults: true } } } },
    },
  })) as any
  if (!season) return null

  const deadline = effectiveRosterDeadline(season, season.league?.organization?.seasonDefaults)
  if (!deadline || deadline.getTime() > now.getTime()) return null

  const submissions = (await (prisma as any).teamSubmission.findMany({
    where: { seasonId, status: "APPROVED" },
    orderBy: { id: "asc" },
    select: {
      id: true,
      teamId: true,
      team: { select: { name: true, tenantId: true, tenant: { select: { name: true } } } },
      roster: {
        select: {
          isLocked: true,
          submittedAt: true,
          _count: { select: { players: true } },
        },
      },
    },
  })) as any[]

  const excluded: RosterDrawExclusion[] = submissions
    .filter((s) => !isRosterFinal(s.roster))
    .map((s) => ({
      submissionId: s.id,
      teamId: s.teamId,
      teamName: s.team?.name ?? s.teamId,
      tenantId: s.team?.tenantId ?? "",
      clubName: s.team?.tenant?.name ?? null,
      playerCount: s.roster?._count?.players ?? 0,
    }))

  return { deadline, excluded }
}
