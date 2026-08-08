/**
 * Slack-capacity experiment (owner question, 2026-08-07): would booking
 * EXTRA court capacity dissolve the residual schedule burdens (venue splits,
 * back-to-backs, ugly waits) — and how much slack buys how much relief?
 *
 * Read-only against the DB. Loads the real season's scheduler input ONCE,
 * blanks existingGames (clean-sheet run, so the curve isn't polluted by the
 * committed schedule already on the books), then runs generateSchedule
 * against a series of in-memory deep copies with more capacity:
 *   - HOURS slack: every dayVenue's window gets longer (~+5/10/20/30% more
 *     slots/day, computed from that dayVenue's own open/close arithmetic).
 *   - COURT slack: one extra (duplicated) court per dayVenue-day.
 * Nothing is written back — no DB writes, no commits, no product code
 * touched. Same input, only the in-memory copy changes per variant.
 *
 * Run:
 *   export PATH="<arm64-node-bin>:$PATH"
 *   DATABASE_URL="postgresql://postgres:password@localhost:5432/youthbasketballhub?schema=public" \
 *     npx tsx scripts/analysis/slack-capacity-experiment.ts
 */

import { prisma } from "@youthbasketballhub/db"
import { loadSchedulerInput } from "../../apps/web/src/lib/scheduler/load"
import { generateSchedule, type SchedulerInput, type SchedulerResult } from "../../apps/web/src/lib/scheduler/generate"

const SEASON_ID = "160b2f09-a95a-4a64-9b90-03793cae105b"

// ---------- HH:MM helpers (mirrors generate.ts's own parseHHMM, which isn't
// exported — duplicated here rather than reaching into the module's
// internals) ----------
function parseHHMM(hhmm?: string | null): { h: number; m: number } | null {
  if (!hhmm) return null
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm)
  if (!m) return null
  return { h: parseInt(m[1]), m: parseInt(m[2]) }
}
const toMin = (t: { h: number; m: number }) => t.h * 60 + t.m
function minToHHMM(min: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, Math.round(min)))
  const h = Math.floor(clamped / 60)
  const m = clamped % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

// ---------- slack variants ----------

/**
 * Extend every dayVenue's window so it gains ~pct more game-slots per court
 * per day. Computed from that dayVenue's own resolved open/close (falling
 * back to the season defaults exactly like buildSlots does), so a short
 * Friday-evening window and a full Saturday window each get their own
 * proportional stretch, not a flat number of minutes.
 */
function applyHoursSlack(input: SchedulerInput, pct: number): { input: SchedulerInput; clamped: number } {
  const clone = structuredClone(input)
  const fallbackOpen = parseHHMM(clone.defaultVenueOpenTime) ?? { h: 9, m: 0 }
  const fallbackClose = parseHHMM(clone.defaultVenueCloseTime) ?? { h: 20, m: 0 }
  let clamped = 0
  for (const s of clone.sessions) {
    for (const d of s.days) {
      for (const dv of d.dayVenues) {
        const open = parseHHMM(dv.startTime) ?? fallbackOpen
        const close = parseHHMM(dv.endTime) ?? fallbackClose
        const openMin = toMin(open)
        const closeMin = toMin(close)
        if (closeMin <= openMin) continue
        const slotsPerCourt = Math.floor((closeMin - openMin) / clone.gameSlotMinutes)
        if (slotsPerCourt <= 0) continue
        const addSlots = Math.round(slotsPerCourt * pct)
        if (addSlots <= 0) continue
        const desiredCloseMin = openMin + (slotsPerCourt + addSlots) * clone.gameSlotMinutes
        if (desiredCloseMin > 23 * 60 + 59) clamped++
        // Write both back explicit (not left to fall through to defaults).
        dv.startTime = minToHHMM(openMin)
        dv.endTime = minToHHMM(desiredCloseMin)
      }
    }
  }
  return { input: clone, clamped }
}

/**
 * Duplicate one court per dayVenue — the "we rent/borrow one more court"
 * variant. At these venues (6/3/2-court gyms) one extra court is roughly
 * +11% to +17% of that gym's daily capacity.
 */
function applyCourtSlack(input: SchedulerInput): SchedulerInput {
  const clone = structuredClone(input)
  for (const s of clone.sessions) {
    for (const d of s.days) {
      for (const dv of d.dayVenues) {
        if (dv.courts.length === 0) continue
        const template = dv.courts[dv.courts.length - 1]
        const maxOrder = Math.max(...dv.courts.map((c) => c.order ?? 0))
        dv.courts.push({ id: `${template.id}::slack-court`, order: maxOrder + 1 })
      }
    }
  }
  return clone
}

// ---------- metrics ----------

interface Metrics {
  variant: string
  totalGames: number
  unscheduled: number
  splitTeamDays: number
  b2b: number
  monster: number
  mid: number
  maxSplitPerTeam: number
  maxWaitsPerTeam: number
}

const dayKey = (d: Date): string => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`

/**
 * Per-TEAM walk of its own game list (mirrors report.ts's
 * computeFairnessReport structure): group a team's games by calendar day,
 * then within each day, distinct venues => a split-venue team-day, and
 * consecutive-game gaps classify as back-to-back (<=0 empty slots), mid
 * wait (3-4 empty slots), or monster wait (>4 empty slots). 1-2 empty slots
 * is normal breathing room and isn't tracked as a burden here.
 */
function computeMetrics(variant: string, result: SchedulerResult, gameSlotMinutes: number): Metrics {
  const byTeam = new Map<string, SchedulerResult["games"]>()
  for (const g of result.games) {
    for (const id of [g.homeTeamId, g.awayTeamId]) {
      if (!byTeam.has(id)) byTeam.set(id, [])
      byTeam.get(id)!.push(g)
    }
  }
  let splitTeamDays = 0
  let b2b = 0
  let monster = 0
  let mid = 0
  let maxSplitPerTeam = 0
  let maxWaitsPerTeam = 0
  for (const [, list] of byTeam) {
    const sorted = [...list].sort(
      (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
    )
    const byDay = new Map<string, typeof sorted>()
    for (const g of sorted) {
      const dk = dayKey(new Date(g.scheduledAt))
      if (!byDay.has(dk)) byDay.set(dk, [])
      byDay.get(dk)!.push(g)
    }
    let teamSplits = 0
    let teamWaits = 0
    for (const [, dayGames] of byDay) {
      const venues = new Set(dayGames.map((g) => g.venueId ?? "?"))
      if (venues.size > 1) {
        splitTeamDays++
        teamSplits++
      }
      for (let i = 1; i < dayGames.length; i++) {
        const prev = new Date(dayGames[i - 1].scheduledAt).getTime()
        const cur = new Date(dayGames[i].scheduledAt).getTime()
        const gapSlots = (cur - prev) / (gameSlotMinutes * 60000) - 1
        if (gapSlots <= 0) {
          b2b++
        } else if (gapSlots > 4) {
          monster++
          teamWaits++
        } else if (gapSlots >= 3) {
          mid++
          teamWaits++
        }
      }
    }
    maxSplitPerTeam = Math.max(maxSplitPerTeam, teamSplits)
    maxWaitsPerTeam = Math.max(maxWaitsPerTeam, teamWaits)
  }
  return {
    variant,
    totalGames: result.games.length,
    unscheduled: result.unscheduled.length,
    splitTeamDays,
    b2b,
    monster,
    mid,
    maxSplitPerTeam,
    maxWaitsPerTeam,
  }
}

function printTable(rows: Metrics[]) {
  const cols: Array<[keyof Metrics, string, number]> = [
    ["variant", "variant", 16],
    ["totalGames", "games", 6],
    ["unscheduled", "unsched", 8],
    ["splitTeamDays", "splits", 7],
    ["b2b", "b2b", 5],
    ["monster", "monster", 8],
    ["mid", "mid", 5],
  ]
  const header = cols.map(([, label, w]) => label.padEnd(w)).join(" | ")
  console.log(header)
  console.log("-".repeat(header.length))
  for (const r of rows) {
    console.log(
      cols
        .map(([key, , w]) => String(r[key]).padEnd(w))
        .join(" | ")
    )
  }
}

function printPerTeamTable(rows: Metrics[]) {
  const cols: Array<[keyof Metrics, string, number]> = [
    ["variant", "variant", 16],
    ["maxSplitPerTeam", "max splits/team", 16],
    ["maxWaitsPerTeam", "max waits/team", 15],
  ]
  const header = cols.map(([, label, w]) => label.padEnd(w)).join(" | ")
  console.log(header)
  console.log("-".repeat(header.length))
  for (const r of rows) {
    console.log(cols.map(([key, , w]) => String(r[key]).padEnd(w)).join(" | "))
  }
}

async function main() {
  console.log(`Loading scheduler input for season ${SEASON_ID}...`)
  const { input, errors } = await loadSchedulerInput(SEASON_ID)
  if (!input) {
    console.error("Could not load scheduler input:", errors)
    process.exit(1)
  }
  if (errors.length > 0) {
    console.warn("Loader warnings:", errors)
  }

  // Clean-sheet: strip the committed schedule so the curve isn't polluted by
  // what's already on the books.
  const baseInput: SchedulerInput = structuredClone(input)
  baseInput.existingGames = []

  console.log(
    `gamesGuaranteed=${baseInput.gamesGuaranteed} gameSlotMinutes=${baseInput.gameSlotMinutes} ` +
      `divisions=${baseInput.divisions.length} sessions=${baseInput.sessions.length} ` +
      `teams=${baseInput.divisions.reduce((s, d) => s + d.teams.length, 0)}`
  )

  const variants: Array<{ label: string; build: () => SchedulerInput }> = [
    { label: "baseline", build: () => structuredClone(baseInput) },
    { label: "+5% hours", build: () => applyHoursSlack(baseInput, 0.05).input },
    { label: "+10% hours", build: () => applyHoursSlack(baseInput, 0.1).input },
    { label: "+20% hours", build: () => applyHoursSlack(baseInput, 0.2).input },
    { label: "+30% hours", build: () => applyHoursSlack(baseInput, 0.3).input },
    { label: "+1 court/venue", build: () => applyCourtSlack(baseInput) },
  ]

  const rows: Metrics[] = []
  for (const v of variants) {
    const variantInput = v.build()
    const result = generateSchedule(variantInput)
    const metrics = computeMetrics(v.label, result, variantInput.gameSlotMinutes)
    rows.push(metrics)
    console.log(`ran ${v.label}: ${metrics.totalGames} games, ${metrics.unscheduled} unscheduled`)
  }

  console.log("\n=== Table 1: totals per variant ===")
  printTable(rows)

  console.log("\n=== Table 2: per-team max (splits, waits = mid+monster combined) ===")
  printPerTeamTable(rows)

  // Sanity check against today's preview reference (splits ~37, b2b ~9,
  // monster ~9) — note existingGames=[] is an EXPECTED source of deviation
  // (this run is clean-sheet; the preview includes the committed schedule).
  const base = rows[0]
  console.log("\n=== Sanity check ===")
  console.log(
    `baseline: splits=${base.splitTeamDays} b2b=${base.b2b} monster=${base.monster} ` +
      `(reference neighborhood: splits ~37, b2b ~9, monster ~9)`
  )
  const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol
  if (!near(base.splitTeamDays, 37, 20) || !near(base.b2b, 9, 8) || !near(base.monster, 9, 8)) {
    console.log(
      "  NOTE: baseline is outside the loose sanity band. existingGames=[] (clean-sheet) is an " +
        "expected source of difference from the preview reference, which schedules around the " +
        "committed games; if the gap looks larger than that alone would explain, treat these " +
        "numbers as provisional and re-check the input."
    )
  } else {
    console.log("  within the expected neighborhood.")
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
