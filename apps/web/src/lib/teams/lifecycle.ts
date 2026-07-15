import { prisma } from "@youthbasketballhub/db"

/**
 * Active league involvement for a team — the guard for lifecycle actions
 * (owner 2026-07-15: you can't archive or roll over a team that's mid-
 * season). A team counts as involved while it has a live submission
 * (PENDING/APPROVED) into a season that hasn't COMPLETED. Shared by the
 * archive + rollover APIs and the dashboard UI so they can never disagree.
 */
export async function getActiveSeasonInvolvement(
  teamId: string
): Promise<Array<{ seasonLabel: string; leagueName: string }>> {
  const submissions = await (prisma as any).teamSubmission.findMany({
    where: {
      teamId,
      status: { in: ["PENDING", "APPROVED"] },
      season: { status: { in: ["REGISTRATION", "REGISTRATION_CLOSED", "FINALIZED", "IN_PROGRESS"] } },
    },
    select: {
      season: { select: { label: true, league: { select: { name: true } } } },
    },
  })
  return submissions.map((s: any) => ({
    seasonLabel: s.season.label,
    leagueName: s.season.league?.name ?? "league",
  }))
}

export function lifecycleLockReason(
  involvement: Array<{ seasonLabel: string; leagueName: string }>
): string | null {
  if (involvement.length === 0) return null
  const names = involvement.map((i) => `${i.leagueName} — ${i.seasonLabel}`).join(", ")
  return `This team is in an active season (${names}). Archiving and season rollover unlock when the season ends or the submission is withdrawn.`
}
