import type { CSSProperties } from "react"
import { cn } from "@/components/ui/cn"
import { CourtBackdropLayer } from "@/components/ui/court-backdrop"
import type { BracketMatch, BracketSection, BracketSlot } from "./types"

/**
 * The bracket, drawn as a real tournament tree.
 *
 * Owner ruling 2026-08-16: "The playoff brackets look all stacked to the top
 * and not exactly like a tree ... They're converging on top and there are no
 * lines in between. There's no dark boldness for the teams that are there:
 * winner of this, winner of that, loser of this, loser of that, the
 * consolation, all that kind of stuff. It is not realistic."
 *
 * How the geometry works — the same arithmetic every printed bracket uses:
 *   1. Every SLOT is one row unit. A slot fed by an earlier game inherits that
 *      game's span; a slot holding a seed (or a bye) takes one row.
 *   2. A game's span is the sum of its two slots, and its centre is the middle
 *      of that span. When both feeders exist the centre lands exactly halfway
 *      between them, so the tree converges toward the final instead of
 *      stacking at the top. Byes fall out of the same rule for free.
 *   3. Connectors are SVG elbows (horizontal, vertical, horizontal) in neutral
 *      grey, drawn on integer pixels so they stay crisp at any zoom.
 *
 * Emphasis is weight and contrast, never colour alone: the advancing team is
 * near-black and bold, the eliminated team dims, and a slot nobody has won yet
 * is a dashed ghost carrying its real reference ("Winner of G3", "Loser of G2").
 */

/* ------------------------------- geometry -------------------------------- */

export interface Scale {
  boxW: number
  gap: number
  /** Height of one slot row unit. Card height must stay under 2 units. */
  row: number
  cardH: number
  teamH: number
  metaH: number
  padY: number
  text: string
  seedW: number
}

const ROOMY: Scale = { boxW: 246, gap: 60, row: 54, cardH: 88, teamH: 28, metaH: 18, padY: 6, text: "text-xs", seedW: 22 }
const COMPACT: Scale = { boxW: 224, gap: 52, row: 44, cardH: 72, teamH: 21, metaH: 16, padY: 6, text: "text-[11px]", seedW: 20 }

const CHAMP_W = 208
/** Neutral grey (ink-200). Connectors carry no meaning, so they carry no hue. */
const LINE = "#d9d9df"

/* ------------------------------- layout ---------------------------------- */

interface Layout {
  center: Map<string, number>
  totalSpan: number
  colIndex: Map<number, number>
  cols: number[]
  roots: BracketMatch[]
  feederOf: (slot: BracketSlot, of: BracketMatch) => BracketMatch | null
}

function layoutSection(matches: BracketMatch[]): Layout {
  const byId = new Map(matches.map((m) => [m.id, m]))
  const feederOf = (slot: BracketSlot, of: BracketMatch): BracketMatch | null => {
    if (!slot.from) return null
    const feeder = byId.get(slot.from)
    // A feeder must sit in an earlier column, or the tree would fold back on
    // itself (losers dropping into a section they also feed).
    if (!feeder || feeder.id === of.id || feeder.tier >= of.tier) return null
    return feeder
  }

  const spanMemo = new Map<string, number>()
  const walking = new Set<string>()
  const spanOf = (m: BracketMatch): number => {
    const hit = spanMemo.get(m.id)
    if (hit != null) return hit
    if (walking.has(m.id)) return 2
    walking.add(m.id)
    const home = feederOf(m.home, m)
    const away = feederOf(m.away, m)
    const value = (home ? spanOf(home) : 1) + (away ? spanOf(away) : 1)
    walking.delete(m.id)
    spanMemo.set(m.id, value)
    return value
  }

  const referenced = new Set<string>()
  let edgeCount = 0
  for (const m of matches) {
    for (const slot of [m.home, m.away]) {
      const feeder = feederOf(slot, m)
      if (!feeder) continue
      referenced.add(feeder.id)
      edgeCount++
    }
  }

  const cols = [...new Set(matches.map((m) => m.tier))].sort((a, b) => a - b)
  const colIndex = new Map(cols.map((tier, i) => [tier, i]))

  /* Nothing converges (placement rounds: everyone plays the same number of
     games, standings decide). Stack each round from the top of its own column
     rather than cascading games down a diagonal. */
  if (edgeCount === 0) {
    const center = new Map<string, number>()
    let tallest = 1
    for (const tier of cols) {
      const column = matches.filter((m) => m.tier === tier)
      column.forEach((m, i) => center.set(m.id, i * 2 + 1))
      tallest = Math.max(tallest, column.length)
    }
    return {
      center,
      totalSpan: tallest * 2,
      cols,
      colIndex,
      roots: matches,
      feederOf,
    }
  }
  const roots = matches
    .filter((m) => !referenced.has(m.id))
    .sort((a, b) => b.tier - a.tier || (a.id < b.id ? -1 : 1))

  const center = new Map<string, number>()
  const place = (m: BracketMatch, start: number) => {
    const home = feederOf(m.home, m)
    const away = feederOf(m.away, m)
    const homeSpan = home ? spanOf(home) : 1
    const awaySpan = away ? spanOf(away) : 1
    if (home) place(home, start)
    if (away) place(away, start + homeSpan)
    center.set(m.id, start + (homeSpan + awaySpan) / 2)
  }
  let cursor = 0
  for (const root of roots) {
    place(root, cursor)
    cursor += spanOf(root)
  }
  // Safety net: anything the walk missed (a cycle in bad data) still gets a row.
  for (const m of matches) {
    if (center.has(m.id)) continue
    center.set(m.id, cursor + 1)
    cursor += 2
  }

  return {
    center,
    totalSpan: Math.max(cursor, 2),
    cols,
    colIndex,
    roots,
    feederOf,
  }
}

/* -------------------------------- pieces --------------------------------- */

function TrophyIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path
        d="M7 4h10v5a5 5 0 0 1-10 0V4Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M7 5.5H4.6v1.2A3.4 3.4 0 0 0 8 10.1M17 5.5h2.4v1.2A3.4 3.4 0 0 1 16 10.1"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path d="M12 14v3m-3 3h6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
}

function AdvanceCaret() {
  return (
    <svg viewBox="0 0 12 12" className="h-3 w-3 shrink-0" aria-hidden="true" fill="none">
      <path d="M4 2.5 8 6l-4 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function SlotRow({ slot, scale }: { slot: BracketSlot; scale: Scale }) {
  const won = slot.outcome === "WON"
  const lost = slot.outcome === "LOST"
  const known = !!slot.teamName
  return (
    <div className="flex items-center gap-1.5" style={{ height: scale.teamH }}>
      <span
        aria-hidden={slot.seed == null}
        style={{ width: scale.seedW }}
        className={cn(
          "shrink-0 rounded text-center text-[10px] font-bold leading-[16px]",
          slot.seed == null
            ? "opacity-0"
            : won
              ? "bg-ink-950 text-white"
              : lost
                ? "bg-ink-100 text-ink-400"
                : "bg-ink-100 text-ink-600"
        )}
      >
        {slot.seed ?? ""}
      </span>
      {known ? (
        <span
          className={cn(
            "min-w-0 flex-1 truncate",
            won ? "text-ink-950 font-bold" : lost ? "text-ink-400 font-medium" : "text-ink-900 font-semibold"
          )}
        >
          {slot.teamName}
        </span>
      ) : (
        <span className="min-w-0 flex-1">
          <span className="border-ink-300 text-ink-400 inline-block max-w-full truncate rounded-md border border-dashed px-1.5 text-[10px] font-bold uppercase leading-[17px] tracking-wide">
            {slot.ghostLabel ?? "To be decided"}
          </span>
        </span>
      )}
      {slot.score != null && (
        <span className={cn("shrink-0 tabular-nums", won ? "text-ink-950 font-bold" : "text-ink-400 font-semibold")}>
          {slot.score}
        </span>
      )}
      {won ? (
        <span className="text-court-600 shrink-0">
          <AdvanceCaret />
        </span>
      ) : (
        <span className="w-3 shrink-0" aria-hidden="true" />
      )}
    </div>
  )
}

const slotText = (slot: BracketSlot): string =>
  [slot.seed != null ? `seed ${slot.seed}` : null, slot.teamName ?? slot.ghostLabel ?? "to be decided", slot.score != null ? String(slot.score) : null]
    .filter(Boolean)
    .join(" ")

export function MatchCard({
  match,
  scale = COMPACT,
  emphasis = "normal",
  style,
  className,
}: {
  match: BracketMatch
  scale?: Scale
  /** `final` gets the gold treatment; the rest ride the neutral card. */
  emphasis?: "normal" | "final"
  style?: CSSProperties
  className?: string
}) {
  const resolved = !!match.home.teamName && !!match.away.teamName
  const played = match.status === "FINAL" || match.home.outcome != null || match.away.outcome != null
  const rail = played ? "bg-court-500" : match.status === "LIVE" ? "bg-live-500" : resolved ? "bg-play-400" : "bg-ink-200"
  const code = (match.code ?? match.id).toUpperCase()
  return (
    <div
      role="group"
      aria-label={`${code}, ${match.round}: ${slotText(match.home)} versus ${slotText(match.away)}${match.whenLabel ? `, ${match.whenLabel}` : ""}`}
      style={{ height: scale.cardH, ...style }}
      className={cn(
        "relative overflow-hidden rounded-xl border shadow-[0_2px_6px_-3px_rgba(15,23,42,0.35)]",
        emphasis === "final"
          ? "border-gold-400 bg-gold-50"
          : resolved
            ? "border-ink-200 bg-white"
            : "border-ink-200/80 border-dashed bg-white/85",
        scale.text,
        className
      )}
    >
      <span aria-hidden="true" className={cn("absolute inset-y-0 left-0 w-[3px]", rail)} />
      <div className="flex h-full flex-col justify-center pl-2.5 pr-2" style={{ paddingTop: scale.padY, paddingBottom: scale.padY }}>
        <SlotRow slot={match.home} scale={scale} />
        <SlotRow slot={match.away} scale={scale} />
        <p
          className="text-ink-400 flex items-center gap-1.5 truncate text-[10px] font-semibold"
          style={{ height: scale.metaH, lineHeight: `${scale.metaH}px` }}
        >
          <span className="text-ink-500">{code}</span>
          {match.whenLabel ? <span className="text-ink-300">·</span> : null}
          <span className="truncate font-medium">{match.whenLabel ?? match.round}</span>
        </p>
      </div>
    </div>
  )
}

/* --------------------------------- tree ---------------------------------- */

function roundLabel(section: BracketSection, matches: BracketMatch[], index: number, columnCount: number): string {
  const names = [...new Set(matches.map((m) => m.round))]
  if (names.length === 1) {
    const only = names[0]
    if (section.kind === "CHAMPIONSHIP" && index === 0 && columnCount > 1 && /^round of/i.test(only)) {
      return "Opening round"
    }
    return only
  }
  return names.sort().join(" · ")
}

export function BracketTree({
  section,
  championLabel,
  className,
}: {
  section: BracketSection
  /** The winner's name once the final is decided; the champion node always draws. */
  championLabel?: string | null
  className?: string
}) {
  const matches = section.matches
  const layout = layoutSection(matches)
  const columnCount = layout.cols.length
  const scale = layout.totalSpan > 14 || columnCount > 3 ? COMPACT : ROOMY
  const showChampion = section.kind === "CHAMPIONSHIP" && layout.roots.length === 1
  // A one-column placement or consolation block already says what it is in the
  // section title; repeating it as a column header is noise.
  const showColumnHeads = columnCount > 1 || section.kind === "CHAMPIONSHIP"
  const width =
    (columnCount - 1) * (scale.boxW + scale.gap) + scale.boxW + (showChampion ? scale.gap + CHAMP_W : 0)
  const height = layout.totalSpan * scale.row

  const xOf = (m: BracketMatch) => (layout.colIndex.get(m.tier) ?? 0) * (scale.boxW + scale.gap)
  const midY = (m: BracketMatch) => Math.round((layout.center.get(m.id) ?? 0) * scale.row)
  const yOf = (m: BracketMatch) => midY(m) - scale.cardH / 2

  const edges: Array<{ key: string; d: string }> = []
  for (const m of matches) {
    for (const [side, slot] of [["h", m.home], ["a", m.away]] as const) {
      const feeder = layout.feederOf(slot, m)
      if (!feeder) continue
      const x1 = xOf(feeder) + scale.boxW
      const y1 = midY(feeder)
      const x2 = xOf(m)
      const y2 = midY(m)
      const mid = Math.round(x1 + (x2 - x1) / 2)
      edges.push({
        key: `${m.id}-${side}`,
        d: y1 === y2 ? `M ${x1} ${y1} H ${x2}` : `M ${x1} ${y1} H ${mid} V ${y2} H ${x2}`,
      })
    }
  }

  const champRoot = showChampion ? layout.roots[0] : null
  if (champRoot) {
    const x1 = xOf(champRoot) + scale.boxW
    const y1 = midY(champRoot)
    edges.push({ key: "champion", d: `M ${x1} ${y1} H ${x1 + scale.gap}` })
  }

  const byColumn = layout.cols.map((tier) => matches.filter((m) => m.tier === tier))

  return (
    <section className={cn("min-w-0", className)} aria-label={section.title}>
      <div className="mb-2">
        <div className="flex items-baseline gap-2">
          <span aria-hidden="true" className="bg-play-500 inline-block h-3.5 w-1 rounded-full" />
          <h3 className="text-ink-900 text-xs font-bold uppercase tracking-[0.14em]">{section.title}</h3>
          <span className="text-ink-400 text-[11px] font-semibold">
            {matches.length} game{matches.length === 1 ? "" : "s"}
          </span>
        </div>
        {section.blurb ? <p className="text-ink-500 mt-1 text-xs">{section.blurb}</p> : null}
      </div>

      <div
        tabIndex={0}
        role="region"
        aria-label={`${section.title} tree. Scroll sideways to reach later rounds.`}
        className="border-ink-100 bg-ink-50/40 focus-visible:ring-play-500/50 relative overflow-x-auto rounded-2xl border p-3 focus-visible:outline-none focus-visible:ring-2"
      >
        <div style={{ width, minWidth: width }}>
          <div className={cn("flex", showColumnHeads ? "mb-2" : "sr-only")} style={{ gap: scale.gap }}>
            {byColumn.map((column, i) => (
              <div key={layout.cols[i]} style={{ width: scale.boxW }} className="shrink-0">
                <p className="text-ink-600 truncate text-[11px] font-bold uppercase tracking-[0.1em]">
                  {roundLabel(section, column, i, columnCount)}
                </p>
                <p className="text-ink-400 text-[10px] font-semibold">
                  {column.length} game{column.length === 1 ? "" : "s"}
                </p>
              </div>
            ))}
            {showChampion ? (
              <div style={{ width: CHAMP_W }} className="shrink-0">
                <p className="text-gold-600 truncate text-[11px] font-bold uppercase tracking-[0.1em]">Champion</p>
                <p className="text-ink-400 text-[10px] font-semibold">the banner</p>
              </div>
            ) : null}
          </div>

          <div className="relative" style={{ height }}>
            {/* The court system's quietest setting: maple grain at 5% under the
                cards, so a bracket canvas is never a sheet of plain white. */}
            <CourtBackdropLayer intensity="ambient" floor="planks" />
            <svg
              className="pointer-events-none absolute left-0 top-0"
              width={width}
              height={height}
              viewBox={`0 0 ${width} ${height}`}
              aria-hidden="true"
              shapeRendering="crispEdges"
            >
              {edges.map((e) => (
                <path key={e.key} d={e.d} fill="none" stroke={LINE} strokeWidth={1.5} />
              ))}
            </svg>
            {matches.map((m) => (
              <MatchCard
                key={m.id}
                match={m}
                scale={scale}
                emphasis={m.id === champRoot?.id ? "final" : "normal"}
                style={{ position: "absolute", left: xOf(m), top: yOf(m), width: scale.boxW }}
              />
            ))}
            {champRoot ? (
              <div
                style={{
                  position: "absolute",
                  left: xOf(champRoot) + scale.boxW + scale.gap,
                  top: midY(champRoot) - scale.cardH / 2,
                  width: CHAMP_W,
                  height: scale.cardH,
                }}
                className="border-gold-400 bg-gold-50 flex flex-col justify-center rounded-xl border px-3"
              >
                <p className="text-gold-600 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em]">
                  <TrophyIcon className="h-3.5 w-3.5" />
                  Champion
                </p>
                <p className={cn("mt-0.5 truncate", championLabel ? "text-ink-950 text-xs font-bold" : "text-ink-400 text-[11px] font-semibold")}>
                  {championLabel ?? "Decided by the final"}
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  )
}

/* --------------------------- pools (no tree) ------------------------------ */

/** Pool play does not converge, so it is drawn honestly: one labelled block of
 *  round-robin games per pool, on the same cards as the tree. */
export function BracketPools({ section, className }: { section: BracketSection; className?: string }) {
  const groups = new Map<string, BracketMatch[]>()
  for (const m of section.matches) {
    if (!groups.has(m.round)) groups.set(m.round, [])
    groups.get(m.round)!.push(m)
  }
  return (
    <section className={cn("min-w-0", className)} aria-label={section.title}>
      <div className="mb-2 flex items-baseline gap-2">
        <span aria-hidden="true" className="bg-play-500 inline-block h-3.5 w-1 rounded-full" />
        <h3 className="text-ink-900 text-xs font-bold uppercase tracking-[0.14em]">{section.title}</h3>
        <span className="text-ink-400 text-[11px] font-semibold">
          {section.matches.length} game{section.matches.length === 1 ? "" : "s"}
        </span>
      </div>
      {section.blurb ? <p className="text-ink-500 mb-2 text-xs">{section.blurb}</p> : null}
      <div
        tabIndex={0}
        role="region"
        aria-label={`${section.title}. Scroll sideways for more pools.`}
        className="border-ink-100 bg-ink-50/40 focus-visible:ring-play-500/50 overflow-x-auto rounded-2xl border p-3 focus-visible:outline-none focus-visible:ring-2"
      >
        <div className="flex gap-4">
          {[...groups.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([round, games]) => (
            <div key={round} className="shrink-0" style={{ width: COMPACT.boxW }}>
              <p className="text-ink-600 mb-1.5 text-[11px] font-bold uppercase tracking-[0.1em]">{round}</p>
              <div className="space-y-1.5">
                {games.map((m) => (
                  <MatchCard key={m.id} match={m} scale={COMPACT} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/** One board: every section of a bracket, in reading order. */
export function BracketBoard({
  sections,
  championLabel,
  className,
}: {
  sections: BracketSection[]
  championLabel?: string | null
  className?: string
}) {
  return (
    <div className={cn("min-w-0 space-y-5", className)}>
      {sections.map((section) =>
        section.kind === "POOL" ? (
          <BracketPools key={section.key} section={section} />
        ) : (
          <BracketTree key={section.key} section={section} championLabel={championLabel} />
        )
      )}
    </div>
  )
}

/** The one-line key that sits above a board. */
export function BracketLegend({ className }: { className?: string }) {
  return (
    <p className={cn("text-ink-500 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]", className)}>
      <span className="flex items-center gap-1.5">
        <span aria-hidden="true" className="border-ink-200 inline-block h-2.5 w-2.5 rounded-sm border bg-white" />
        teams decided
      </span>
      <span className="flex items-center gap-1.5">
        <span aria-hidden="true" className="border-ink-300 inline-block h-2.5 w-2.5 rounded-sm border border-dashed" />
        waiting on an earlier result
      </span>
      <span className="flex items-center gap-1.5">
        <span aria-hidden="true" className="bg-ink-100 text-ink-600 inline-block h-3.5 w-4 rounded text-center text-[9px] font-bold leading-[14px]">
          1
        </span>
        seed
      </span>
      <span className="flex items-center gap-1.5">
        <span aria-hidden="true" className="bg-court-500 inline-block h-2.5 w-[3px] rounded-sm" />
        played
      </span>
    </p>
  )
}
