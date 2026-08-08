/**
 * Scheduler v2 — L1 Feasibility Auditor. Pure function of the snapshot.
 * Infeasibility is discovered HERE, from the plan's own arithmetic, never
 * from a failed solve: if no BLOCK finding exists, the solver may assume
 * every cell fits. Messages follow the design's rules — name the weekend by
 * dates, the grade and gym by name, show the arithmetic, offer options.
 */
import type { Finding, SnapWeekend, WorldSnapshot } from "./types"

const fmtDates = (w: SnapWeekend): string => {
  const ds = w.days.map((d) => new Date(d.date))
  if (ds.length === 0) return w.label ?? w.id.slice(0, 8)
  const mon = (d: Date) => d.toLocaleDateString("en-US", { month: "short" })
  const first = ds[0]
  const last = ds[ds.length - 1]
  return first.getMonth() === last.getMonth()
    ? `${mon(first)} ${first.getDate()}–${last.getDate()}`
    : `${mon(first)} ${first.getDate()} – ${mon(last)} ${last.getDate()}`
}

/** Court-slots a gym offers in a weekend (per day and total). */
export function gymSupply(
  w: SnapWeekend,
  gymId: string,
  slotMinutes: number,
  courtBuffer: number
): { total: number; perDay: Array<{ dayId: string; dateKey: string; slots: number }> } {
  const perDay: Array<{ dayId: string; dateKey: string; slots: number }> = []
  let total = 0
  for (const day of w.days) {
    let slots = 0
    for (const v of day.venues) {
      if (v.gymId !== gymId) continue
      const usable = Math.max(0, v.courts.length - courtBuffer)
      slots += Math.floor((v.closeMin - v.openMin) / slotMinutes) * usable
    }
    perDay.push({ dayId: day.id, dateKey: day.dateKey, slots })
    total += slots
  }
  return { total, perDay }
}

/** Games a grade needs in a weekend hosting it with the given target. */
export function gradeDemand(nTeams: number, target: number): number {
  return Math.ceil((nTeams * target) / 2)
}

export function audit(snapshot: WorldSnapshot): Finding[] {
  const findings: Finding[] = []
  const { config } = snapshot
  const gradeById = new Map(snapshot.grades.map((g) => [g.id, g]))
  const teamById = new Map(snapshot.teams.map((t) => [t.id, t]))
  const gymName = (id: string) => id // venue names not in snapshot; renderer may map later

  /* 1. Cell capacity (H1, H7) — the check that would have caught v1's
        wandering games before they existed. */
  for (const w of snapshot.weekends) {
    const byGym = new Map<string, string[]>()
    for (const h of w.hosting) {
      if (!byGym.has(h.gymId)) byGym.set(h.gymId, [])
      byGym.get(h.gymId)!.push(h.gradeId)
    }
    for (const [gymId, gradeIds] of [...byGym.entries()].sort()) {
      const supply = gymSupply(w, gymId, config.slotMinutes, config.courtBuffer)
      let demand = 0
      const parts: string[] = []
      for (const gid of gradeIds) {
        const g = gradeById.get(gid)
        if (!g) continue
        const d = gradeDemand(g.teamIds.length, w.target)
        demand += d
        parts.push(`${g.name}: ${d}`)
      }
      if (demand > supply.total) {
        findings.push({
          severity: "BLOCK",
          code: "grade-does-not-fit",
          weekendId: w.id,
          gymId,
          arithmetic: { demand, supply: supply.total, short: demand - supply.total },
          message:
            `Weekend of ${fmtDates(w)}: ${parts.join(", ")} — ${demand} games need this gym, ` +
            `but the booking holds ${supply.total}` +
            ` (${supply.perDay.map((p) => `${p.slots}`).join(" + ")} slots by day` +
            `${config.courtBuffer > 0 ? `, ${config.courtBuffer} court(s) held back` : ""}). ` +
            `Short by ${demand - supply.total} games.`,
          options: [
            `Add about ${Math.ceil(((demand - supply.total) * config.slotMinutes) / 60)} court-hours at this gym that weekend.`,
            `Move a grade to a gym with more room that weekend.`,
            w.target > 1 ? `Lower the weekend target from ${w.target} games per team to ${w.target - 1} in Planning.` : `Host fewer grades at this gym that weekend.`,
          ],
        })
      }
    }
  }

  /* 2. Promise arithmetic (H2): reachable games per team from the weekends
        its grade is hosted, minus full-weekend blackouts. */
  const promise = config.promiseDefault
  for (const grade of snapshot.grades) {
    const hostedWeekends = snapshot.weekends.filter((w) =>
      w.hosting.some((h) => h.gradeId === grade.id)
    )
    if (hostedWeekends.length === 0) {
      findings.push({
        severity: "BLOCK",
        code: "no-games-planned",
        gradeId: grade.id,
        arithmetic: { weekends: 0, promise },
        message: `${grade.name}: the plan gives this grade no weekends at all, so its ${grade.teamIds.length} teams would get 0 of the promised ${promise} games.`,
        options: [
          `Host ${grade.name} on at least ${Math.ceil(promise / 2)} weekends in Planning.`,
        ],
      })
      continue
    }
    const planTotal = hostedWeekends.reduce((acc, w) => acc + w.target, 0)
    if (planTotal < promise) {
      findings.push({
        severity: "BLOCK",
        code: "plan-promises-fewer",
        gradeId: grade.id,
        arithmetic: { planTotal, promise },
        message:
          `${grade.name}: the plan adds up to ${planTotal} games per team this season; the promise is ${promise}. ` +
          `Options below — or record ${planTotal} as this grade's promised number so families see it up front.`,
        options: [
          `Add a ${grade.name} weekend in Planning.`,
          `Raise a weekend from 1 game per team to 2 for ${grade.name}.`,
        ],
      })
    }
    for (const teamId of grade.teamIds) {
      const team = teamById.get(teamId)
      if (!team || team.blackouts.length === 0) continue
      let reachable = 0
      for (const w of hostedWeekends) {
        const openDays = w.days.filter(
          (d) => !team.blackouts.some((b) => b.dateKey === d.dateKey && !b.startMin && !b.endMin)
        )
        reachable += openDays.length === 0 ? 0 : w.target
      }
      if (reachable < promise && reachable < planTotal) {
        findings.push({
          severity: "BLOCK",
          code: "promise-unreachable",
          gradeId: grade.id,
          teamIds: [teamId],
          arithmetic: { reachable, promise },
          message:
            `${team.name}: approved blackouts leave only ${reachable} reachable games of the promised ${promise}, ` +
            `and catch-up room is not guaranteed. Open room on another ${grade.name} weekend, or record ${reachable} as this team's number.`,
          options: [
            `Open room on a later ${grade.name} weekend.`,
            `Record ${reachable} as this team's promised number.`,
          ],
        })
      }
    }
  }

  /* 3. Blackout day-pileups (H4 × H1): teams forced onto one day must fit
        that day's supply. */
  for (const w of snapshot.weekends) {
    const byGym = new Map<string, string[]>()
    for (const h of w.hosting) {
      if (!byGym.has(h.gymId)) byGym.set(h.gymId, [])
      byGym.get(h.gymId)!.push(h.gradeId)
    }
    for (const [gymId, gradeIds] of [...byGym.entries()].sort()) {
      const supply = gymSupply(w, gymId, config.slotMinutes, config.courtBuffer)
      for (const day of supply.perDay) {
        // Teams whose only open day this weekend is `day`.
        let forcedGames = 0
        const forcedTeams: string[] = []
        for (const gid of gradeIds) {
          const g = gradeById.get(gid)
          if (!g) continue
          for (const teamId of g.teamIds) {
            const t = teamById.get(teamId)
            if (!t || t.blackouts.length === 0) continue
            const openDays = w.days.filter(
              (d) => !t.blackouts.some((b) => b.dateKey === d.dateKey && !b.startMin && !b.endMin)
            )
            if (openDays.length === 1 && openDays[0].id === day.dayId) {
              forcedGames += w.target
              forcedTeams.push(teamId)
            }
          }
        }
        const lower = Math.ceil(forcedGames / 2)
        if (lower > day.slots) {
          findings.push({
            severity: "BLOCK",
            code: "day-pileup",
            weekendId: w.id,
            gymId,
            teamIds: forcedTeams,
            arithmetic: { forced: lower, daySlots: day.slots },
            message:
              `Weekend of ${fmtDates(w)}: blackouts force at least ${lower} games onto one day at ${gymName(gymId)}, which holds ${day.slots}. ` +
              `${lower - day.slots} cannot fit.`,
            options: [
              `Extend that day's hours at ${gymName(gymId)}.`,
              `Move one blacked-out team's games to another weekend.`,
            ],
          })
        }
      }
    }
  }

  /* 4. Pin consistency (H5, H7). */
  const pins = snapshot.existingGames.filter((g) => g.state === "PIN")
  const seenSlot = new Map<string, string>()
  const seenTeamTime = new Map<string, string>()
  for (const pin of pins) {
    if (pin.courtId) {
      const k = `${pin.courtId}|${pin.startIso}`
      const other = seenSlot.get(k)
      if (other) {
        findings.push({
          severity: "BLOCK",
          code: "pin-conflict",
          arithmetic: { court: pin.courtId ?? "?", start: pin.startIso },
          message: `Two locked or played games overlap on the same court at ${pin.startIso}. The engine never moves them — unlock one, or move it by hand first.`,
          options: ["Unlock one of the games.", "Move one by hand first."],
        })
      } else {
        seenSlot.set(k, pin.id)
      }
    }
    for (const teamId of [pin.teamAId, pin.teamBId]) {
      const k = `${teamId}|${pin.startIso}`
      const other = seenTeamTime.get(k)
      if (other) {
        findings.push({
          severity: "BLOCK",
          code: "pin-conflict",
          teamIds: [teamId],
          arithmetic: { start: pin.startIso },
          message: `A team holds two locked/played games at the same time (${pin.startIso}). Unlock or move one by hand first.`,
          options: ["Unlock one of the games.", "Move one by hand first."],
        })
      } else {
        seenTeamTime.set(k, pin.id)
      }
    }
  }

  return findings
}

export const hasBlock = (findings: Finding[]): boolean =>
  findings.some((f) => f.severity === "BLOCK")
