/**
 * Which gyms a season actually has on each weekend (owner 2026-08-02: "right
 * now we're making assumptions that both gyms are available"). The season
 * strip on plan step 3 draws a gym row above the grades, and this is the one
 * place that decides what it says.
 *
 * Pure on purpose (no prisma, no React): the step-2 grid is the operator's
 * own answer about availability, and the planner state is what the solver
 * could see. When they disagree the grid wins, because that is the sentence
 * the operator typed. Structural inputs, so a test can hand it three objects
 * instead of a whole VenueGrid.
 */

export interface StripVenue {
  venueId: string
  /** The gym's real name, which always travels with its colour. */
  name: string
  /** "Six Park" — what fits in a weekend column. */
  short: string
}

/** The shape of the step-2 grid this module needs, and nothing more. */
export interface VenueGridLike {
  venues: Array<{
    venueId: string
    name: string
    city?: string | null
    cells: Array<{ sessionId: string | null; state: "on" | "off" | "custom" }>
  }>
}

/** The shape of a planner weekend this module needs. */
export interface StripWeekendLike {
  sessionId: string
  venues: Array<{ venueId: string; name: string }>
}

/** Words that name a building type rather than the gym anybody says out loud. */
const FACILITY_WORDS = new Set([
  "academy",
  "arena",
  "athletics",
  "center",
  "centre",
  "club",
  "complex",
  "facility",
  "fieldhouse",
  "gym",
  "gymnasium",
  "high",
  "school",
  "secondary",
  "sport",
  "sports",
  "sportsplex",
])

/** What a weekend column can hold before it wraps. */
const MAX_SHORT = 14

const words = (value: string): string[] => value.trim().split(/\s+/).filter(Boolean)

/**
 * A gym in column shorthand: "Six Park East" → "Six Park", "The Playground"
 * in Burlington → "Playground". The city goes because the column is already
 * this season's gyms, the article goes because nobody says it, and a building
 * word goes because "Community Centre" is not which gym it is.
 *
 * Deterministic and total: the same name always shortens the same way, and a
 * name that shortens to nothing keeps its first word.
 */
export function venueShortName(name: string, city?: string | null): string {
  let parts = words(name ?? "")
  if (parts.length === 0) return ""

  const cityParts = words((city ?? "").toLowerCase())
  if (cityParts.length > 0 && parts.length > cityParts.length) {
    const tail = parts
      .slice(-cityParts.length)
      .map((w) => w.toLowerCase().replace(/[.,]/g, ""))
    if (tail.join(" ") === cityParts.join(" ")) parts = parts.slice(0, -cityParts.length)
  }

  if (parts.length > 1 && /^the$/i.test(parts[0])) parts = parts.slice(1)
  while (parts.length > 1 && FACILITY_WORDS.has(parts[parts.length - 1].toLowerCase())) {
    parts = parts.slice(0, -1)
  }

  let short = parts.slice(0, 2).join(" ")
  if (short.length > MAX_SHORT) short = parts[0]
  if (short.length > MAX_SHORT) short = `${short.slice(0, MAX_SHORT - 1)}…`
  return short
}

/**
 * Every gym the season plays at, in one stable order: the step-2 grid's order
 * (home gym first) ahead of anything only the planner knows about. Colours are
 * handed out by this order, so a gym keeps its colour for the whole season.
 */
export function seasonVenueOrder(
  grid: VenueGridLike | null | undefined,
  weekends: StripWeekendLike[]
): StripVenue[] {
  const out: StripVenue[] = []
  const seen = new Set<string>()
  for (const row of grid?.venues ?? []) {
    if (seen.has(row.venueId)) continue
    seen.add(row.venueId)
    out.push({
      venueId: row.venueId,
      name: row.name,
      short: venueShortName(row.name, row.city),
    })
  }
  for (const w of weekends) {
    for (const v of w.venues) {
      if (seen.has(v.venueId)) continue
      seen.add(v.venueId)
      out.push({ venueId: v.venueId, name: v.name, short: venueShortName(v.name) })
    }
  }
  return out
}

/**
 * Weekend → the gyms that are on that weekend, in season order.
 *
 * The grid is the answer when it knows the weekend, INCLUDING when its answer
 * is "none": an operator who released both gyms for a weekend must see an
 * empty weekend, not the gyms the solver last had capacity from. A weekend the
 * grid has never heard of falls back to the planner's own venues, so the strip
 * still draws before step 2 has been opened.
 */
export function resolveWeekendVenues(
  grid: VenueGridLike | null | undefined,
  weekends: StripWeekendLike[]
): Map<string, StripVenue[]> {
  const order = seasonVenueOrder(grid, weekends)
  const byId = new Map(order.map((v) => [v.venueId, v]))
  const rank = new Map(order.map((v, i) => [v.venueId, i]))

  const known = new Set<string>()
  const onBySession = new Map<string, string[]>()
  for (const row of grid?.venues ?? []) {
    for (const cell of row.cells) {
      if (!cell.sessionId) continue
      known.add(cell.sessionId)
      if (cell.state === "off") continue
      onBySession.set(cell.sessionId, [...(onBySession.get(cell.sessionId) ?? []), row.venueId])
    }
  }

  const out = new Map<string, StripVenue[]>()
  for (const w of weekends) {
    const ids = known.has(w.sessionId)
      ? (onBySession.get(w.sessionId) ?? [])
      : w.venues.map((v) => v.venueId)
    const venues = ids
      .map((id) => byId.get(id))
      .filter((v): v is StripVenue => Boolean(v))
      .sort((a, b) => (rank.get(a.venueId) ?? 0) - (rank.get(b.venueId) ?? 0))
    out.set(w.sessionId, venues)
  }
  return out
}

/**
 * The ONE gym a grade plays in on one weekend (owner 2026-08-02: a grade plays
 * one building per weekend, and a family drives to one address).
 *
 * The plan's own answer wins — what was saved, or what the operator switched
 * the grade to. Null when nothing has been decided, or when the decided gym is
 * not one this weekend runs (a leftover from before the operator released it),
 * and the caller falls back to describing the weekend's gyms instead.
 */
export function resolveUnitVenue(
  weekendVenues: StripVenue[],
  assignedVenueId: string | null | undefined
): StripVenue | null {
  if (!assignedVenueId) return null
  return weekendVenues.find((v) => v.venueId === assignedVenueId) ?? null
}

/**
 * A gym's colour slot: its place in the season's gym order, wrapped into
 * however many colour families the palette has. Deterministic, and two gyms
 * never share a colour until the season has more gyms than the palette does.
 */
export function venueHueSlots(
  orderedVenueIds: string[],
  families: number
): Map<string, number> {
  const out = new Map<string, number>()
  orderedVenueIds.forEach((id, i) => {
    if (!out.has(id)) out.set(id, families > 0 ? i % families : 0)
  })
  return out
}

/**
 * The gym row's sentence for one weekend: "Six Park + Playground", "Six Park
 * only" when a two-gym season runs one of them, and "no gym" when the season
 * has that weekend off.
 */
export function venueLine(venues: StripVenue[], seasonVenueCount: number): string {
  if (venues.length === 0) return "no gym"
  if (venues.length === 1) return seasonVenueCount > 1 ? `${venues[0].short} only` : venues[0].short
  return venues.map((v) => v.short).join(" + ")
}
