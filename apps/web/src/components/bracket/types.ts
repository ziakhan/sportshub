/**
 * Shared bracket view model (owner ruling 2026-08-16: "the playoff brackets
 * look all stacked to the top and not exactly like a tree ... there are no
 * lines in between ... no dark boldness for the teams that are there").
 *
 * One model, every surface. The operator playoff plan and the public league
 * walkthrough both feed THIS shape, so a bracket looks the same wherever it
 * is drawn. Rendering only: nothing here reads the database or the scheduler.
 */

/** Mirrors `SlotRef.type` in lib/scheduler-v2/playoffs.ts, plus TEAM for
 *  surfaces that already know the club and never carried a slot ref. */
export type BracketSlotKind = "SEED" | "WINNER" | "LOSER" | "POOL" | "BEST2ND" | "TEAM"

export interface BracketSlot {
  kind: BracketSlotKind
  /** Printed beside the name. Null when the slot is not seed-derived. */
  seed?: number | null
  /** Structural id of the game that decides this slot ("g3"). The tree draws
   *  a connector for every `from` that resolves inside the same section. */
  from?: string | null
  /** The team, once it is known. Null keeps the slot a ghost. */
  teamName?: string | null
  /** What a ghost slot prints: "Winner of G3", "Loser of G2", "Pool A · 1st". */
  ghostLabel?: string | null
  score?: number | null
  /** Set once the game is final so the card can bold the survivor. */
  outcome?: "WON" | "LOST" | null
}

export interface BracketMatch {
  /** Structural id — the target of other slots' `from`. */
  id: string
  /** Short code printed on the card ("G3"). Defaults to the upper-cased id. */
  code?: string | null
  /** Round name straight from the generator ("Quarterfinal", "Consolation"). */
  round: string
  /** Dependency tier from the generator; drives the column. */
  tier: number
  /** Pre-formatted date line. Preferred over startIso so server and client
   *  never disagree about a locale. */
  whenLabel?: string | null
  startIso?: string | null
  status?: "SCHEDULED" | "LIVE" | "FINAL" | null
  home: BracketSlot
  away: BracketSlot
}

export type BracketSectionKind = "CHAMPIONSHIP" | "PLACEMENT" | "CONSOLATION" | "POOL"

export interface BracketSection {
  key: string
  title: string
  /** One plain sentence under the title. */
  blurb?: string
  kind: BracketSectionKind
  matches: BracketMatch[]
}

const CONSOLATION_RE = /consolation|silver|bronze/i
const THIRD_RE = /3rd place|third place/i
const POOL_RE = /^pool\b/i
const FINAL_RE = /^(gold )?final$/i

/**
 * Split a flat game list into the sections a bracket screen draws: the
 * championship tree, the placement games hanging off it (3rd place), the
 * consolation tree the bottom of the field plays, and any round-robin pools.
 *
 * The championship section is the FINAL plus everything that feeds it through
 * winner slots — the only games that actually converge. Everything else is
 * labelled on its own so "winner of this, loser of that" stops reading as one
 * undifferentiated pile.
 */
export function sectionizeBracket(matches: BracketMatch[]): BracketSection[] {
  const byId = new Map(matches.map((m) => [m.id, m]))
  const pools = matches.filter((m) => POOL_RE.test(m.round))
  const third = matches.filter((m) => THIRD_RE.test(m.round))
  const consolation = matches.filter((m) => CONSOLATION_RE.test(m.round) && !THIRD_RE.test(m.round))
  const taken = new Set([...pools, ...third, ...consolation].map((m) => m.id))

  const rest = matches.filter((m) => !taken.has(m.id))
  // A championship tree only exists where winners actually flow. Placement
  // formats (everyone plays N games, standings decide) have no final and must
  // never be dressed up as one.
  const hasWinnerFlow = rest.some((m) => [m.home, m.away].some((s) => s.kind === "WINNER" && s.from))
  const finalGame = !hasWinnerFlow
    ? null
    : (rest.find((m) => FINAL_RE.test(m.round)) ??
      [...rest].sort((a, b) => b.tier - a.tier || (a.id < b.id ? -1 : 1))[0] ??
      null)

  const championship: BracketMatch[] = []
  if (finalGame) {
    const seen = new Set<string>()
    const walk = (m: BracketMatch) => {
      if (seen.has(m.id)) return
      seen.add(m.id)
      championship.push(m)
      for (const slot of [m.home, m.away]) {
        if (slot.kind !== "WINNER" || !slot.from) continue
        const feeder = byId.get(slot.from)
        if (feeder && !taken.has(feeder.id) && feeder.tier < m.tier) walk(feeder)
      }
    }
    walk(finalGame)
  }
  const inChampionship = new Set(championship.map((m) => m.id))
  const leftovers = rest.filter((m) => !inChampionship.has(m.id))

  const sections: BracketSection[] = []
  if (pools.length > 0) {
    sections.push({
      key: "pools",
      title: "Pool play",
      blurb: "Everyone plays their pool first; the medal rounds are seeded from these results.",
      kind: "POOL",
      matches: pools,
    })
  }
  if (championship.length > 0) {
    sections.push({
      key: "championship",
      title: "Championship bracket",
      blurb: "Winners move right. The final decides the banner.",
      kind: "CHAMPIONSHIP",
      matches: championship,
    })
  }
  if (third.length > 0) {
    sections.push({
      key: "third",
      title: "Third place",
      blurb: "The two beaten semifinalists play for bronze.",
      kind: "PLACEMENT",
      matches: third,
    })
  }
  if (consolation.length > 0) {
    sections.push({
      key: "consolation",
      title: "Consolation bracket",
      blurb: "Everybody plays: teams knocked out early keep playing on their own tree.",
      kind: "CONSOLATION",
      matches: consolation,
    })
  }
  if (leftovers.length > 0) {
    sections.push({
      key: "placement",
      title: "Placement rounds",
      blurb: "No elimination: every team plays the same number of games and the standings decide.",
      kind: "PLACEMENT",
      matches: leftovers,
    })
  }
  return sections
}
