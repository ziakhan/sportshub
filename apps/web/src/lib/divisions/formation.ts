/**
 * Division formation (owner rulings 2026-08-09): divisions are a
 * SCHEDULING-time decision made from real registered teams — planning only
 * ever needed grade counts. This module is the one implementation of
 * split/merge: create or reuse Division rows, reassign submissions to an
 * explicit membership map, keep every non-empty division hosted wherever
 * the grade already plays, and delete divisions left empty. Used by the
 * guided "Create divisions" dialog; deterministic given its inputs (any
 * randomness lives in the UI's "deal randomly" button, before this runs).
 */
import { prisma } from "@youthbasketballhub/db"

export interface DivisionSpec {
  /** Existing division id to reuse, or null to create. */
  id: string | null
  name: string
  teamIds: string[]
}

export interface FormationResult {
  ok: boolean
  error?: string
  divisions: Array<{ id: string; name: string; teams: number }>
  deletedEmpty: number
}

export async function formDivisions(
  seasonId: string,
  ageGroup: string,
  specs: DivisionSpec[]
): Promise<FormationResult> {
  const existing = await (prisma as any).division.findMany({
    where: { seasonId, ageGroup },
    orderBy: { name: "asc" },
    include: { teamSubmissions: { where: { status: "APPROVED" }, select: { id: true, teamId: true } } },
  })
  if (existing.length === 0) {
    return { ok: false, error: "No such grade.", divisions: [], deletedEmpty: 0 }
  }

  /* Every approved team of the grade must be assigned exactly once. */
  const allSubs = existing.flatMap((d: any) => d.teamSubmissions)
  const subByTeam = new Map<string, string>(allSubs.map((s: any) => [s.teamId, s.id]))
  const assigned = new Set<string>()
  for (const spec of specs) {
    for (const teamId of spec.teamIds) {
      if (!subByTeam.has(teamId)) {
        return { ok: false, error: "A team in the assignment is not in this grade.", divisions: [], deletedEmpty: 0 }
      }
      if (assigned.has(teamId)) {
        return { ok: false, error: "A team is assigned to two divisions.", divisions: [], deletedEmpty: 0 }
      }
      assigned.add(teamId)
    }
  }
  if (assigned.size !== subByTeam.size) {
    return {
      ok: false,
      error: `${subByTeam.size - assigned.size} team(s) are not assigned to any division.`,
      divisions: [],
      deletedEmpty: 0,
    }
  }
  if (specs.some((s) => s.teamIds.length < 2)) {
    return { ok: false, error: "Every division needs at least 2 teams.", divisions: [], deletedEmpty: 0 }
  }

  const out: FormationResult["divisions"] = []
  let deletedEmpty = 0
  await (prisma as any).$transaction(async (tx: any) => {
    /* Create or reuse rows; rename reused ones to the spec. */
    const targetIds: string[] = []
    for (const spec of specs) {
      if (spec.id) {
        await tx.division.update({ where: { id: spec.id }, data: { name: spec.name } })
        targetIds.push(spec.id)
      } else {
        const created = await tx.division.create({
          data: { seasonId, name: spec.name, ageGroup, tier: existing[0].tier ?? 1 },
        })
        targetIds.push(created.id)
      }
    }
    /* Reassign memberships. */
    for (let i = 0; i < specs.length; i++) {
      for (const teamId of specs[i].teamIds) {
        await tx.teamSubmission.update({
          where: { id: subByTeam.get(teamId)! },
          data: { divisionId: targetIds[i] },
        })
      }
      out.push({ id: targetIds[i], name: specs[i].name, teams: specs[i].teamIds.length })
    }
    /* Hosting: every weekend where ANY of the grade's divisions played,
       every target division plays too — SPREAD across that weekend's
       booked gyms (deterministic cycle). All-in-one-gym would make a big
       split grade unschedulable: one gym cannot hold 4 divisions' games,
       and the auditor would rightly block it. */
    const gradeDivIds = new Set(existing.map((d: any) => d.id))
    for (const id of targetIds) gradeDivIds.add(id)
    const sessions = await tx.seasonSession.findMany({
      where: { seasonId, phase: "REGULAR" },
      select: {
        id: true,
        unitVenues: true,
        days: { select: { dayVenues: { select: { id: true, venueId: true } } } },
      },
    })
    for (const sess of sessions) {
      const uv = { ...((sess.unitVenues ?? {}) as Record<string, string>) }
      const hostedGyms = Object.entries(uv)
        .filter(([k]) => k.startsWith("division:") && gradeDivIds.has(k.slice(9)))
        .map(([, v]) => v)
      if (hostedGyms.length === 0) continue
      /* The weekend's bookable gyms, stable order; the grade's current
         gyms first so an unsplit grade keeps its home. */
      const booked: string[] = []
      for (const day of sess.days ?? []) {
        for (const dv of [...(day.dayVenues ?? [])].sort((a: any, b: any) =>
          String(a.id).localeCompare(String(b.id))
        )) {
          if (!booked.includes(dv.venueId)) booked.push(dv.venueId)
        }
      }
      const cycle = [
        ...hostedGyms.filter((g, i) => hostedGyms.indexOf(g) === i),
        ...booked.filter((v) => !hostedGyms.includes(v)),
      ]
      let changed = false
      /* Reused divisions keep their home gym; only NEW divisions get
         placed, preferring gyms no sibling division already uses. */
      const used = new Set(
        targetIds.map((id) => uv[`division:${id}`]).filter(Boolean) as string[]
      )
      let ci = 0
      for (const id of targetIds) {
        if (uv[`division:${id}`]) continue
        const free = cycle.filter((g) => !used.has(g))
        const gym = free.length > 0 ? free[ci % free.length] : cycle[ci % Math.max(1, cycle.length)] ?? hostedGyms[0]
        uv[`division:${id}`] = gym
        used.add(gym)
        ci++
        changed = true
      }
      /* Divisions about to be deleted lose their keys. */
      for (const d of existing) {
        if (!targetIds.includes(d.id) && uv[`division:${d.id}`]) {
          delete uv[`division:${d.id}`]
          changed = true
        }
      }
      if (changed) {
        await tx.seasonSession.update({ where: { id: sess.id }, data: { unitVenues: uv } })
      }
    }
    /* Delete grade divisions left with no approved teams (merge support).
       Games reference teams, never divisions, so this is safe. */
    for (const d of existing) {
      if (targetIds.includes(d.id)) continue
      const remaining = await tx.teamSubmission.count({ where: { divisionId: d.id } })
      if (remaining === 0) {
        await tx.division.delete({ where: { id: d.id } })
        deletedEmpty++
      }
    }
  })
  return { ok: true, divisions: out, deletedEmpty }
}
