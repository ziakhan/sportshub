/**
 * Validation (owner 2026-08-02): can our planner logic reproduce NPH's
 * OFFICIAL 2026-27 Showcase calendar (the registration graphic) from the
 * same inputs — and where it differs, is ours worse or better?
 *
 * Inputs held identical to their world: the 13 official weekends grouped
 * into 5 monthly session windows (we do NOT choose weekends), last year's
 * real team counts per grade (census, 146), their norm of 2 games per team
 * per session weekend (1/day), and the three gyms (Six Park 6, Playground 3,
 * Haber 2 courts; 8 game slots per court per day → 16 per court-weekend).
 *
 * Run: npx tsx scripts/analysis/validate-nph-calendar.ts
 */

const TEAMS: Record<string, number> = {
  Gr7: 12, Gr8: 9, Gr9: 25, Gr10: 42, Gr11: 24, Gr12: 26, JrGirls: 8,
}
const GRADES = Object.keys(TEAMS)
// games per grade per appearance = teams × 2 games / 2 sides = team count
const gamesOf = (grades: string[]) => grades.reduce((s, g) => s + TEAMS[g], 0)

const SLOTS_PER_COURT_WEEKEND = 16 // 8/day × Sat+Sun (demo-world verified)
const COURTS_TOTAL = 11 // Six Park 6 + Playground 3 + Haber 2

interface Window { label: string; weekends: string[] }
const WINDOWS: Window[] = [
  { label: "Oct", weekends: ["Oct 24", "Oct 31"] },
  { label: "Nov", weekends: ["Nov 14", "Nov 21", "Nov 28"] },
  { label: "Dec", weekends: ["Dec 12", "Dec 19"] },
  { label: "Jan", weekends: ["Jan 9", "Jan 16", "Jan 30"] },
  { label: "Feb", weekends: ["Feb 6", "Feb 13", "Feb 20"] },
]

// THEIR published plan (the graphic, verbatim — note JrGirls: twice in the
// Jan window, absent from Dec; every other grade is once per window).
const OFFICIAL: Record<string, string[]> = {
  "Oct 24": ["Gr7", "Gr8", "Gr9", "Gr11", "JrGirls"],
  "Oct 31": ["Gr10", "Gr12"],
  "Nov 14": ["Gr7"],
  "Nov 21": ["Gr8", "Gr9", "Gr10", "JrGirls"],
  "Nov 28": ["Gr11", "Gr12"],
  "Dec 12": ["Gr8", "Gr11", "Gr12"],
  "Dec 19": ["Gr7", "Gr9", "Gr10"],
  "Jan 9": ["Gr7", "Gr9", "JrGirls"],
  "Jan 16": ["Gr10"],
  "Jan 30": ["Gr8", "Gr11", "Gr12", "JrGirls"],
  "Feb 6": ["Gr9", "JrGirls"],
  "Feb 13": ["Gr7", "Gr8", "Gr10"],
  "Feb 20": ["Gr11", "Gr12"],
}

/** Our grouping rules, as scores (lower = better):
 *  1. balance — minimize the window's peak weekend load (courts are the
 *     scarce thing; a flat month never rents a court it can't fill)
 *  2. Gr11+Gr12 travel/pairing affinity (they share families + gyms)
 *  3. keep the two giants (Gr9, Gr10) on different weekends when free
 *  4. young pair Gr7+Gr8 together when it doesn't cost balance
 */
function planWindow(win: Window): Record<string, string[]> {
  const n = win.weekends.length
  let best: number[] | null = null
  let bestScore = Infinity
  const assign = new Array(GRADES.length).fill(0)
  const total = Math.pow(n, GRADES.length)
  for (let mask = 0; mask < total; mask++) {
    let m = mask
    for (let i = 0; i < GRADES.length; i++) { assign[i] = m % n; m = Math.floor(m / n) }
    const loads = new Array(n).fill(0)
    const at: string[][] = Array.from({ length: n }, () => [])
    for (let i = 0; i < GRADES.length; i++) {
      loads[assign[i]] += TEAMS[GRADES[i]]
      at[assign[i]].push(GRADES[i])
    }
    const peak = Math.max(...loads)
    const w = (g: string) => assign[GRADES.indexOf(g)]
    let score = peak * 1000
    if (w("Gr11") !== w("Gr12")) score += 300 // pairing affinity
    if (w("Gr9") === w("Gr10")) score += 120 // giants apart when free
    if (w("Gr7") !== w("Gr8")) score += 60 // young pair
    if (score < bestScore) { bestScore = score; best = [...assign] }
  }
  const out: Record<string, string[]> = {}
  win.weekends.forEach((wk) => (out[wk] = []))
  GRADES.forEach((g, i) => out[win.weekends[best![i]]].push(g))
  return out
}

function describe(title: string, plan: Record<string, string[]>) {
  console.log(`\n${title}`)
  let seasonPeak = 0
  let peakWk = ""
  for (const win of WINDOWS) {
    for (const wk of win.weekends) {
      const grades = plan[wk] ?? []
      const games = gamesOf(grades)
      const courts = Math.ceil(games / SLOTS_PER_COURT_WEEKEND)
      if (games > seasonPeak) { seasonPeak = games; peakWk = wk }
      const bar = "█".repeat(courts).padEnd(11)
      console.log(
        `  ${wk.padEnd(7)} ${bar} ${String(games).padStart(3)} games · ${courts} courts` +
          (grades.length ? `  [${grades.join(" ")}]` : "  —")
      )
    }
  }
  const totalGames = WINDOWS.flatMap((w) => w.weekends).reduce(
    (s, wk) => s + gamesOf(plan[wk] ?? []), 0)
  console.log(`  season: ${totalGames} games · peak ${peakWk} = ${seasonPeak} games (${Math.ceil(
    seasonPeak / SLOTS_PER_COURT_WEEKEND)} courts of ${COURTS_TOTAL})`)
  return { seasonPeak, totalGames }
}

// ---- run ----
console.log("NPH official 2026-27 calendar vs our planner — identical inputs")
console.log(`teams: ${GRADES.map((g) => `${g} ${TEAMS[g]}`).join(" · ")} (=146)`)

const off = describe("THEIR plan (the published graphic):", OFFICIAL)

const ours: Record<string, string[]> = {}
for (const win of WINDOWS) Object.assign(ours, planWindow(win))
const mine = describe("OUR plan (rules: balance · Gr11+12 together · giants apart · Gr7+8 together):", ours)

// window-by-window agreement
console.log("\nAgreement per window (same grade partition, ignoring which date):")
for (const win of WINDOWS) {
  const norm = (p: Record<string, string[]>) =>
    win.weekends.map((wk) => [...(p[wk] ?? [])].sort().join("+")).filter(Boolean).sort().join(" | ")
  const same = norm(OFFICIAL) === norm(ours)
  console.log(`  ${win.label}: ${same ? "MATCH" : "differs"}   theirs: ${norm(OFFICIAL) || "—"}   ours: ${norm(ours)}`)
}

// capacity headroom under THEIR plan shape
console.log("\nHeadroom (their plan, three gyms, 176 game-slots per weekend):")
const capacity = COURTS_TOTAL * SLOTS_PER_COURT_WEEKEND
let minSlack = Infinity
for (const wk of Object.keys(OFFICIAL)) {
  const games = gamesOf(OFFICIAL[wk])
  if (capacity - games < minSlack) minSlack = capacity - games
}
console.log(`  tightest weekend leaves ${minSlack} free game-slots → about ${minSlack} more teams could appear on that weekend`)
const growth = Math.floor((capacity / off.seasonPeak) * 100 - 100)
console.log(`  uniform growth tolerance: every grade could grow ~${growth}% before the peak weekend outgrows all three gyms`)
console.log(`  Six Park alone (96 slots): peak weekend ${off.seasonPeak > 96 ? "does NOT fit" : "fits"} (${off.seasonPeak} games)`)
