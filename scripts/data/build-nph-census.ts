/**
 * Census codegen (demo-journey plan, owner 2026-08-01): parses the NPH
 * team-entry census CSV (docs/research/sheets/team_entries.csv — pulled
 * from NPH's own standings API, 2025-26 season) into a typed data module
 * the full-scale demo seeder consumes. REAL club/team names; players are
 * always generated elsewhere (owner ruling: fictional minors).
 *
 * Run: npx tsx scripts/data/build-nph-census.ts   (writes nph-census.ts)
 * Fails loudly when totals drift from the census document
 * (docs/research/census-nph-2025-26.md): SL 146 · D1 60 · NPA 14 · WNPA 10.
 */
import { readFileSync, writeFileSync } from "fs"
import { join } from "path"

interface Entry {
  club: string
  league: "SL" | "D1" | "NPA" | "WNPA"
  division: string // SL: Gr7..Gr12, JrGirls · D1: JrGirls/SrGirls/JrBoys/Scholastic/Academy · NPA/WNPA: Main
  conference?: string // SL big grades: ARETE / DMV CHILL / GAME SPEAKS / PRIME
  teamLabel?: string // explicit suffix when the census names one (FEIA Red, RWI Kings…)
}

const CSV = join(__dirname, "../../docs/research/sheets/team_entries.csv")

function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  for (const line of text.split("\n")) {
    if (!line.trim()) continue
    const cells: string[] = []
    let cur = ""
    let inQ = false
    for (const ch of line) {
      if (ch === '"') inQ = !inQ
      else if (ch === "," && !inQ) {
        cells.push(cur)
        cur = ""
      } else cur += ch
    }
    cells.push(cur)
    rows.push(cells.map((c) => c.trim()))
  }
  return rows
}

const CONF_NAMES: Record<string, string> = {
  ARETE: "ARETE",
  DMV: "DMV CHILL",
  "DMV CHILL": "DMV CHILL",
  GS: "GAME SPEAKS",
  "GAME SPEAKS": "GAME SPEAKS",
  PRIME: "PRIME",
}

const D1_DIVS: Record<string, string> = {
  JrG: "Junior Girls",
  SrG: "Senior Girls",
  JrB: "Junior Boys",
  Scholastic: "Scholastic",
  Academy: "Academy",
}

/**
 * The CSV writes one row per TEAM; a club with two Gr9 teams shows the row
 * "Gr9 (ARETE, PRIME)" twice — the parenthetical lists the conferences of
 * the club's entries at that grade collectively, assigned in listed order.
 */
function parseSlDetail(raw: string): {
  division: string
  confs: string[]
  conference?: string
  label?: string
  reassign?: Entry
} {
  const detail = raw.replace(/\*+$/, "").trim() // registered-0-games stars still count
  // Six rows sit under NPH-SL but describe D1/WNPA entries — reassign.
  const REASSIGN: Record<string, { league: Entry["league"]; division: string; label?: string }> = {
    JrB: { league: "D1", division: "Junior Boys" },
    SrG: { league: "D1", division: "Senior Girls" },
    Scholastic: { league: "D1", division: "Scholastic" },
    "Scholastic (Varsity)": { league: "D1", division: "Scholastic", label: "Varsity" },
    "Academy (National)": { league: "D1", division: "Academy", label: "National" },
    "D1 Academy": { league: "D1", division: "Academy" },
    WNPA: { league: "WNPA", division: "Main" },
  }
  if (REASSIGN[detail]) {
    const r = REASSIGN[detail]
    return {
      division: r.division,
      confs: [],
      reassign: { club: "", league: r.league, division: r.division, teamLabel: r.label },
    }
  }
  // "SL Gr10 ARETE" — league-prefixed with a direct conference word
  const m3 = /^SL (Gr\d+|JrGirls)\s+(ARETE|DMV CHILL|DMV|GAME SPEAKS|GS|PRIME)$/.exec(detail)
  if (m3) return { division: m3[1], confs: [], conference: CONF_NAMES[m3[2]] ?? m3[2] }
  const m = /^(?:SL )?(Gr\d+|JrGirls)\s*(?:\(([^)]*)\))?$/.exec(detail)
  if (m) {
    const tokens = (m[2] ?? "")
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean)
    const allConfs = tokens.length > 0 && tokens.every((t) => CONF_NAMES[t] !== undefined)
    if (allConfs) return { division: m[1], confs: tokens.map((t) => CONF_NAMES[t]) }
    if (tokens.length > 0) return { division: m[1], confs: [], label: tokens.join(", ") }
    return { division: m[1], confs: [] }
  }
  return { division: detail, confs: [] }
}

function parseD1Detail(raw: string): { division: string; label?: string } {
  const detail = raw.replace(/\*+$/, "").trim()
  const m = /^D1\s+(\w+)\s*(?:\(([^)]*)\))?$/.exec(detail)
  if (!m) return { division: detail }
  return { division: D1_DIVS[m[1]] ?? m[1], label: m[2] || undefined }
}

function main() {
  const rows = parseCsv(readFileSync(CSV, "utf8")).slice(1) // drop header
  const entries: Entry[] = []
  // Per club+grade conference queues so duplicate rows consume the
  // parenthetical list in order.
  const confQueue = new Map<string, string[]>()

  for (const [club, league, detail] of rows) {
    if (!club || club === "club") continue
    if (league === "NPH-SL") {
      const parsed = parseSlDetail(detail)
      if (parsed.reassign) {
        entries.push({ ...parsed.reassign, club })
        continue
      }
      let conference = parsed.conference
      if (!conference && parsed.confs.length > 0) {
        const qk = `${club}|${parsed.division}`
        if (!confQueue.has(qk)) confQueue.set(qk, [...parsed.confs])
        conference = confQueue.get(qk)!.shift()
      }
      entries.push({
        club,
        league: "SL",
        division: parsed.division,
        conference,
        teamLabel: parsed.label,
      })
    } else if (league === "NPH-D1") {
      const parsed = parseD1Detail(detail)
      entries.push({ club, league: "D1", division: parsed.division, teamLabel: parsed.label })
    } else if (league === "NPA") {
      entries.push({ club, league: "NPA", division: "Main" })
    } else if (league === "WNPA") {
      entries.push({ club, league: "WNPA", division: "Main" })
    }
  }

  // ── Reconciliation patches vs docs/research/census-nph-2025-26.md ──
  // (the census document is authoritative; the CSV export drifted on a few
  // rows — patches are reviewed by hand against the doc)
  const PATCHES: { add: Entry[]; dropKey: string[] } = {
    add: [],
    dropKey: [],
  }
  for (const e of PATCHES.add) entries.push(e)
  for (const key of PATCHES.dropKey) {
    const i = entries.findIndex((e) => `${e.club}|${e.league}|${e.division}` === key)
    if (i >= 0) entries.splice(i, 1)
  }

  // ── Assertions vs the census doc ──
  const byLeague = (l: string) => entries.filter((e) => e.league === l)
  const slByDiv = new Map<string, number>()
  for (const e of byLeague("SL"))
    slByDiv.set(e.division, (slByDiv.get(e.division) ?? 0) + 1)
  const d1ByDiv = new Map<string, number>()
  for (const e of byLeague("D1"))
    d1ByDiv.set(e.division, (d1ByDiv.get(e.division) ?? 0) + 1)

  console.log("SL by division:", Object.fromEntries([...slByDiv.entries()].sort()))
  console.log("D1 by division:", Object.fromEntries([...d1ByDiv.entries()].sort()))
  console.log(
    `Totals: SL ${byLeague("SL").length} · D1 ${byLeague("D1").length} · NPA ${byLeague("NPA").length} · WNPA ${byLeague("WNPA").length}`
  )

  const EXPECT = { SL: 146, D1: 60, NPA: 14, WNPA: 10 }
  const drift: string[] = []
  for (const [l, n] of Object.entries(EXPECT)) {
    if (byLeague(l).length !== n) drift.push(`${l}: got ${byLeague(l).length}, census says ${n}`)
  }
  if (drift.length > 0) {
    console.error("CENSUS DRIFT — fix PATCHES:\n" + drift.join("\n"))
    process.exit(1)
  }

  const out = `/**
 * GENERATED by scripts/data/build-nph-census.ts — do not edit by hand.
 * Real NPH 2025-26 team entries (their own standings data); players are
 * always FICTIONAL (owner ruling — real players are minors).
 */
export interface NphCensusEntry {
  club: string
  league: "SL" | "D1" | "NPA" | "WNPA"
  division: string
  conference?: string
  teamLabel?: string
}

export const NPH_CENSUS: NphCensusEntry[] = ${JSON.stringify(entries, null, 2)}
`
  writeFileSync(join(__dirname, "nph-census.ts"), out)
  console.log(`Wrote nph-census.ts (${entries.length} entries)`)
}

main()
