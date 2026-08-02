import { prisma } from "@youthbasketballhub/db"

/**
 * "13 last season" (planner step 1, owner-approved mock 2026-08-02).
 *
 * The only number an operator can actually check their August guess against
 * is what showed up last year, per grade. Nothing else in the product knows
 * it: the ?from= season-create prefill deliberately copies structure but
 * never team counts, because a copied count reads as a commitment.
 *
 * Truth here is APPROVED team submissions only — pending and withdrawn ones
 * never took the floor. Grades with nothing approved are left out entirely
 * rather than reported as zero: a hint we cannot stand behind is worse than
 * no hint, and step 1 hides the whole column when this returns null.
 */

/** Approved teams per ageGroup in the season before this one.
 *  Null when this is the league's first season (no history to show). */
export async function lastSeasonTeamCounts(
  seasonId: string
): Promise<Record<string, number> | null> {
  const season = await (prisma as any).season.findUnique({
    where: { id: seasonId },
    select: { id: true, leagueId: true, createdAt: true },
  })
  if (!season) return null

  // The season before this one, by creation. Restricted to seasons that came
  // BEFORE the current one so planning a summer season after next winter's
  // shell exists still reads the season that actually played.
  const prior = await (prisma as any).season.findFirst({
    where: {
      leagueId: season.leagueId,
      id: { not: season.id },
      createdAt: { lt: season.createdAt },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, label: true },
  })
  if (!prior) return null

  const divisions = await (prisma as any).division.findMany({
    where: { seasonId: prior.id },
    select: { id: true, ageGroup: true },
  })
  if (divisions.length === 0) return {}

  const ageByDivision = new Map<string, string>(
    divisions.map((d: any) => [d.id as string, d.ageGroup as string])
  )
  const grouped = await (prisma as any).teamSubmission.groupBy({
    by: ["divisionId"],
    where: {
      seasonId: prior.id,
      status: "APPROVED",
      divisionId: { in: [...ageByDivision.keys()] },
    },
    _count: { _all: true },
  })

  // Grade clusters, not divisions: two Grade 10 divisions were one grade to
  // the operator last season and they are one row on the step-1 grid now.
  const counts: Record<string, number> = {}
  for (const row of grouped) {
    const ageGroup = ageByDivision.get(row.divisionId as string)
    if (!ageGroup) continue
    const n = row._count?._all ?? 0
    if (n <= 0) continue
    counts[ageGroup] = (counts[ageGroup] ?? 0) + n
  }
  return counts
}
