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

/* ------------------------------------------------------------------ *
 * PART 2 — the ORG hypothetical (owner 2026-08-02): add every other
 * league at last year's demand, on the same calendar. Is it enough?
 *
 * Model, from the 2025-26 actuals:
 *  - D1 hub demand per monthly session-weekend: JrBoys ~9 games,
 *    Academy ~15, JrGirls+SrGirls co-hosted ~14. (Scholastic ~15/mo is
 *    EXCLUDED — it lives in school gyms, never the hubs.)
 *  - NPA+WNPA touch the hubs ~5 games/month (homes are FEIA/academies).
 *  - NJC/NSC (published 2026-27 dates) hold ALL of Six Park on
 *    Oct 17, Nov 14, Dec 12, Jan 16, Feb 13 weekends → hub capacity
 *    those weekends = Playground 48 + Haber 32 = 80 slots.
 *  - Months have their real weekend count; SL-free weekends are usable
 *    by D1 (they did exactly that last year, e.g. Nov 8-9 at Six Park).
 * ------------------------------------------------------------------ */
console.log("\n\nPART 2 — whole org on the same calendar (D1 + NPA/WNPA added at last year's volumes)")

const SIX_PARK = 96, PLAYGROUND = 48, HABER = 32
interface Wk { name: string; sl: number; slGrades: string[]; njc: boolean }
const MONTHS: { label: string; weekends: Wk[] }[] = [
  { label: "Oct", weekends: [
    { name: "Oct 3", sl: 0, slGrades: [], njc: false },
    { name: "Oct 10", sl: 0, slGrades: [], njc: false },
    { name: "Oct 17", sl: 0, slGrades: [], njc: true },
    { name: "Oct 24", sl: gamesOf(OFFICIAL["Oct 24"]), slGrades: OFFICIAL["Oct 24"], njc: false },
    { name: "Oct 31", sl: gamesOf(OFFICIAL["Oct 31"]), slGrades: OFFICIAL["Oct 31"], njc: false },
  ]},
  { label: "Nov", weekends: [
    { name: "Nov 7", sl: 0, slGrades: [], njc: false },
    { name: "Nov 14", sl: gamesOf(OFFICIAL["Nov 14"]), slGrades: OFFICIAL["Nov 14"], njc: true },
    { name: "Nov 21", sl: gamesOf(OFFICIAL["Nov 21"]), slGrades: OFFICIAL["Nov 21"], njc: false },
    { name: "Nov 28", sl: gamesOf(OFFICIAL["Nov 28"]), slGrades: OFFICIAL["Nov 28"], njc: false },
  ]},
  { label: "Dec", weekends: [
    { name: "Dec 5", sl: 0, slGrades: [], njc: false },
    { name: "Dec 12", sl: gamesOf(OFFICIAL["Dec 12"]), slGrades: OFFICIAL["Dec 12"], njc: true },
    { name: "Dec 19", sl: gamesOf(OFFICIAL["Dec 19"]), slGrades: OFFICIAL["Dec 19"], njc: false },
  ]},
  { label: "Jan", weekends: [
    { name: "Jan 9", sl: gamesOf(OFFICIAL["Jan 9"]), slGrades: OFFICIAL["Jan 9"], njc: false },
    { name: "Jan 16", sl: gamesOf(OFFICIAL["Jan 16"]), slGrades: OFFICIAL["Jan 16"], njc: true },
    { name: "Jan 23", sl: 0, slGrades: [], njc: false },
    { name: "Jan 30", sl: gamesOf(OFFICIAL["Jan 30"]), slGrades: OFFICIAL["Jan 30"], njc: false },
  ]},
  { label: "Feb", weekends: [
    { name: "Feb 6", sl: gamesOf(OFFICIAL["Feb 6"]), slGrades: OFFICIAL["Feb 6"], njc: false },
    { name: "Feb 13", sl: gamesOf(OFFICIAL["Feb 13"]), slGrades: OFFICIAL["Feb 13"], njc: true },
    { name: "Feb 20", sl: gamesOf(OFFICIAL["Feb 20"]), slGrades: OFFICIAL["Feb 20"], njc: false },
  ]},
]
const D1_CHUNKS = [
  { name: "D1 JrBoys", games: 9 },
  { name: "D1 Academy", games: 15 },
  { name: "D1 Girls (Jr+Sr)", games: 14 },
  { name: "NPA/WNPA", games: 5 },
]

let orgTight: { name: string; free: number } | null = null
for (const month of MONTHS) {
  const cap = (w: Wk) => (w.njc ? 0 : SIX_PARK) + PLAYGROUND + HABER
  const used = new Map(month.weekends.map((w) => [w.name, w.sl]))
  const placed = new Map<string, string[]>()
  // greedy: each league chunk takes the month's weekend with most room
  for (const chunk of D1_CHUNKS) {
    const pick = [...month.weekends].sort(
      (a, b) => (cap(b) - used.get(b.name)!) - (cap(a) - used.get(a.name)!)
    )[0]
    used.set(pick.name, used.get(pick.name)! + chunk.games)
    placed.set(pick.name, [...(placed.get(pick.name) ?? []), chunk.name])
  }
  console.log(`\n  ${month.label}`)
  for (const w of month.weekends) {
    const total = used.get(w.name)!
    const c = cap(w)
    const free = c - total
    if (!orgTight || free < orgTight.free) orgTight = { name: w.name, free }
    const parts = [
      w.sl ? `SL ${w.sl} [${w.slGrades.join(" ")}]` : "",
      ...(placed.get(w.name) ?? []),
    ].filter(Boolean)
    console.log(
      `    ${w.name.padEnd(7)}${w.njc ? " (Six Park → NJC/NSC)" : ""}`.padEnd(32) +
        `${String(total).padStart(3)} of ${String(c).padStart(3)} slots · ${parts.join(" + ") || "idle"}`
    )
  }
}
console.log(`\n  VERDICT: tightest weekend of the whole org = ${orgTight!.name} with ${orgTight!.free} slots to spare.`)
console.log("  Note how the official SL calendar puts small, Playground-sized loads on exactly")
console.log("  the NJC/NSC weekends — the peaks exist because those weekends aren't fully theirs.")

/* ------------------------------------------------------------------ *
 * PART 2b — owner hypothetical: NPA + WNPA moved ENTIRELY onto the
 * weekends at the hubs (today they're mostly weekday games at FEIA and
 * academy gyms). Regular-season volumes from 2025-26 actuals, minus the
 * March playoffs at Humber: NPA ~65 games → 13/month, WNPA ~46 → 9/month.
 * Scholastic stays excluded (owner: "not the high school games").
 * ------------------------------------------------------------------ */
console.log("\n\nPART 2b — hypothetical: NPA + WNPA run fully on weekends too")
const FULL_CHUNKS = [
  { name: "D1 JrBoys", games: 9 },
  { name: "D1 Academy", games: 15 },
  { name: "D1 Girls (Jr+Sr)", games: 14 },
  { name: "NPA (all games)", games: 13 },
  { name: "WNPA (all games)", games: 9 },
]
let tight2: { name: string; free: number } | null = null
for (const month of MONTHS) {
  const cap = (w: Wk) => (w.njc ? 0 : SIX_PARK) + PLAYGROUND + HABER
  const used = new Map(month.weekends.map((w) => [w.name, w.sl]))
  const placed = new Map<string, string[]>()
  for (const chunk of FULL_CHUNKS) {
    const pick = [...month.weekends].sort(
      (a, b) => (cap(b) - used.get(b.name)!) - (cap(a) - used.get(a.name)!)
    )[0]
    used.set(pick.name, used.get(pick.name)! + chunk.games)
    placed.set(pick.name, [...(placed.get(pick.name) ?? []), chunk.name])
  }
  console.log(`  ${month.label}`)
  for (const w of month.weekends) {
    const total = used.get(w.name)!
    const c = cap(w)
    const free = c - total
    if (!tight2 || free < tight2.free) tight2 = { name: w.name, free }
    const parts = [
      w.sl ? `SL ${w.sl}` : "",
      ...(placed.get(w.name) ?? []),
    ].filter(Boolean)
    console.log(
      `    ${w.name.padEnd(7)}${w.njc ? " (NJC)" : "      "} ${String(total).padStart(3)} of ${String(c).padStart(3)} · ${parts.join(" + ") || "idle"}`
    )
  }
}
console.log(`  VERDICT: still fits — tightest weekend ${tight2!.name}, ${tight2!.free} slots free.`)

/* ------------------------------------------------------------------ *
 * PART 3 — rerun OUR planner, now given the input we were missing:
 * per-weekend venue availability (Six Park absent on NJC weekends).
 * Objective becomes: minimize peak UTILIZATION of what's actually
 * available each weekend; overflow is forbidden. If the planner now
 * drifts toward their shape, the missing ingredient was availability —
 * exactly the venue-calendar object the product design added.
 * ------------------------------------------------------------------ */
console.log("\n\nPART 3 — our planner re-run WITH weekend availability (NJC weekends = 80 slots)")
const CAP: Record<string, number> = {
  "Oct 24": 176, "Oct 31": 176,
  "Nov 14": 80, "Nov 21": 176, "Nov 28": 176,
  "Dec 12": 80, "Dec 19": 176,
  "Jan 9": 176, "Jan 16": 80, "Jan 30": 176,
  "Feb 6": 176, "Feb 13": 80, "Feb 20": 176,
}
function planWindowCapped(win: Window): Record<string, string[]> {
  const n = win.weekends.length
  let best: number[] | null = null
  let bestScore = Infinity
  const assign = new Array(GRADES.length).fill(0)
  for (let mask = 0; mask < Math.pow(n, GRADES.length); mask++) {
    let m = mask
    for (let i = 0; i < GRADES.length; i++) { assign[i] = m % n; m = Math.floor(m / n) }
    const loads = new Array(n).fill(0)
    for (let i = 0; i < GRADES.length; i++) loads[assign[i]] += TEAMS[GRADES[i]]
    let overflow = false
    let peakUtil = 0
    for (let k = 0; k < n; k++) {
      const cap = CAP[win.weekends[k]]
      if (loads[k] > cap) { overflow = true; break }
      peakUtil = Math.max(peakUtil, loads[k] / cap)
    }
    if (overflow) continue
    const w = (g: string) => assign[GRADES.indexOf(g)]
    let score = Math.round(peakUtil * 100) * 1000
    if (w("Gr11") !== w("Gr12")) score += 300
    if (w("Gr9") === w("Gr10")) score += 120
    if (w("Gr7") !== w("Gr8")) score += 60
    if (score < bestScore) { bestScore = score; best = [...assign] }
  }
  const out: Record<string, string[]> = {}
  win.weekends.forEach((wk) => (out[wk] = []))
  GRADES.forEach((g, i) => out[win.weekends[best![i]]].push(g))
  return out
}
const capped: Record<string, string[]> = {}
for (const win of WINDOWS) Object.assign(capped, planWindowCapped(win))
for (const win of WINDOWS) {
  for (const wk of win.weekends) {
    const g = capped[wk]
    const games = gamesOf(g)
    const officialGames = gamesOf(OFFICIAL[wk] ?? [])
    console.log(
      `  ${wk.padEnd(7)}${CAP[wk] === 80 ? " (NJC wkend, 80 cap)" : "".padEnd(20)}  ours: ${String(games).padStart(3)} [${g.join(" ") || "—"}]  · theirs: ${String(officialGames).padStart(3)} [${(OFFICIAL[wk] ?? []).join(" ")}]`
    )
  }
}
