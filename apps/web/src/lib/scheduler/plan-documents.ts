/**
 * Plans as documents, the pure half (owner 2026-08-02: "we can have multiple
 * plans, we can save them, we can name them, we can call one an NPH plan. We
 * should be able to go to the dropdown and choose them. When I do it fresh it
 * should be our own").
 *
 * season-plans.ts holds the server contracts and imports prisma, so step 3 —
 * a client component — cannot read a line of it. Everything the picker and the
 * save controls have to agree on lives here instead: the row shape, the quiet
 * markers a row wears, the name we suggest so nobody has to invent one, and
 * the single sentence that says where the board stands.
 */

/** A row of the dropdown: exactly what GET /api/seasons/[id]/plans returns. */
export interface PlanRow {
  id: string
  name: string
  /** "imported" is the league's own published calendar, and is read only. */
  source: string
  isActive: boolean
  updatedAt: string
}

/** The whole document, as GET /plans/[planId] hands it back. */
export interface PlanDocument extends PlanRow {
  assignment: Record<string, string[]>
  venues: Record<string, Record<string, string>>
  /** The world it was saved in. Null on rows written before plans remembered
   *  one, which every reader has to survive. */
  settings?: PlanSettings | null
}

/* --------------------- the world a plan was made in ---------------------- */

/**
 * A plan remembers its WORLD, not just its calendar (owner 2026-08-02: "a new
 * plan also could have different venues. It could have different settings, so
 * how are you going to save it and how do you remember? It could be a
 * different team combination").
 *
 * These shapes are the planner's own state with the calendar taken out — the
 * assignment and the gyms are the plan's other two columns. They are declared
 * structurally rather than imported so this module stays free of the planner's
 * runtime, and so BOTH a saved snapshot and a live PlannerState satisfy them.
 */
export interface PlanWorldVenue {
  venueId: string
  name: string
  capacityGames: number
  /** DEAD since the 2026-08-03 venue ruling, and only ever read to describe a
   *  plan saved under the old fill-order model. */
  fillOrder: number
  /** Owned ("home") or rented ("pool"). Absent on snapshots taken before the
   *  2026-08-03 ruling, which is exactly how the drift sentence knows to fall
   *  back to talking about fill order. */
  role?: "home" | "pool"
}

export interface PlanWorldWeekend {
  sessionId: string
  label: string
  capacityGames: number
  targetGamesPerTeam: number
  venues: PlanWorldVenue[]
}

export interface PlanWorldWindow {
  label: string
  weekends: PlanWorldWeekend[]
}

export interface PlanWorldUnit {
  key: string
  label: string
  /** The number the plan runs on: the operator's estimate for that grade. */
  teams: number
}

export interface PlanWorld {
  units: PlanWorldUnit[]
  windows: PlanWorldWindow[]
  gamesPerTeam?: number
  /** Which season it was read from. Carried so a snapshot can be read on its
   *  own; the board uses the season it is standing in, never this. */
  seasonId?: string
}

/** What SeasonPlan.settings holds. */
export interface PlanSettings {
  capturedAt: string
  state: PlanWorld
}

/* ------------------------------ drift ------------------------------------ */

const gamesWord = (n: number) => `${n} game${n === 1 ? "" : "s"}`
const teamsWord = (n: number) => `${n} team${n === 1 ? "" : "s"}`

/** Things in a sentence: "a", "a and b", "a, b and c". */
function nameList(parts: string[]): string {
  if (parts.length === 0) return ""
  if (parts.length === 1) return parts[0]
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`
}

/** The same, for a list long enough that naming all of it stops being
 *  readable: "Oct 24–25, Nov 7–8 and 4 more". */
function shortList(parts: string[]): string {
  if (parts.length <= 3) return nameList(parts)
  return `${parts.slice(0, 2).join(", ")} and ${parts.length - 2} more`
}

/**
 * WHERE something changed, in the words the difference deserves. "all season"
 * when it moved on every weekend the two worlds share, the weekend itself when
 * it is one weekend, a count when it is a handful: one line per gym, never one
 * line per weekend (a gym whose courts changed everywhere is one fact).
 */
function whichWeekends(labels: string[], everywhere: boolean): string {
  if (everywhere) return "all season"
  if (labels.length === 1) return `on ${labels[0]}`
  if (labels.length === 2) return `on ${labels[0]} and ${labels[1]}`
  return `on ${labels.length} weekends`
}

function weekendsOf(world: PlanWorld): Map<string, PlanWorldWeekend> {
  const out = new Map<string, PlanWorldWeekend>()
  for (const win of world.windows ?? []) {
    for (const w of win.weekends ?? []) out.set(w.sessionId, w)
  }
  return out
}

function venuesOf(weekend: PlanWorldWeekend): Map<string, PlanWorldVenue> {
  return new Map((weekend.venues ?? []).map((v) => [v.venueId, v]))
}

/** The gyms of a whole world in fill order, by the first order each one is
 *  given. One sequence per world, so "which gym fills first" is one fact
 *  rather than one per weekend. */
function fillOrderOf(world: PlanWorld): Map<string, { name: string; order: number }> {
  const out = new Map<string, { name: string; order: number }>()
  for (const win of world.windows ?? []) {
    for (const w of win.weekends ?? []) {
      for (const v of w.venues ?? []) {
        const seen = out.get(v.venueId)
        if (!seen || v.fillOrder < seen.order) out.set(v.venueId, { name: v.name, order: v.fillOrder })
      }
    }
  }
  return out
}

/**
 * The building a world OWNS. `known` is false on a world saved before roles
 * existed — which is a different thing from a world that owns nothing, and the
 * drift sentence has to be able to tell those apart.
 */
function homeGymOf(world: PlanWorld): {
  known: boolean
  home: { venueId: string; name: string } | null
} {
  let known = false
  for (const win of world.windows ?? []) {
    for (const w of win.weekends ?? []) {
      for (const v of w.venues ?? []) {
        if (v.role === undefined) continue
        known = true
        if (v.role === "home") return { known: true, home: { venueId: v.venueId, name: v.name } }
      }
    }
  }
  return { known, home: null }
}

/** How many differences the operator reads before the rest becomes a count. */
export const DRIFT_LIMIT = 6

/**
 * What changed in the world between the plan and the season, in sentences
 * (owner 2026-08-02). A plan is opened under its OWN saved settings, so the
 * board can be honest about the numbers it is drawing; this is the other half
 * of that honesty — saying out loud where those numbers no longer match the
 * season the operator is standing in.
 *
 * Real differences only, most important first, and aggregated per THING rather
 * than per weekend: a gym whose courts changed on every weekend is one line
 * that says "all season", not twenty lines. Everything past the sixth
 * difference becomes a count, because a wall of sentences says nothing.
 */
export function planDrift(saved: PlanWorld, live: PlanWorld): string[] {
  const out: string[] = []
  const savedWeekends = weekendsOf(saved)
  const liveWeekends = weekendsOf(live)
  const shared = [...savedWeekends.keys()].filter((id) => liveWeekends.has(id))
  const sharedCount = shared.length

  /* 1. Weekends the two worlds do not even share. The plan's calendar cannot
        land the same way, which outranks every number inside a weekend. */
  const gone = [...savedWeekends.values()].filter((w) => !liveWeekends.has(w.sessionId))
  const fresh = [...liveWeekends.values()].filter((w) => !savedWeekends.has(w.sessionId))
  if (gone.length === 1) {
    out.push(`${gone[0].label} is not a weekend of this season any more, and this plan uses it.`)
  } else if (gone.length > 1) {
    out.push(
      `${gone.length} weekends this plan uses are not part of the season any more (${shortList(
        gone.map((w) => w.label)
      )}).`
    )
  }
  if (fresh.length === 1) {
    out.push(`${fresh[0].label} is a new weekend the season did not have when this plan was saved.`)
  } else if (fresh.length > 1) {
    out.push(
      `${fresh.length} weekends are new since this plan was saved (${shortList(
        fresh.map((w) => w.label)
      )}).`
    )
  }

  /* 2. Per gym: courts and hours, which is what capacity really is. */
  interface GymDelta {
    name: string
    changed: Array<{ label: string; from: number; to: number }>
    gone: string[]
    fresh: string[]
    /** Weekends both worlds open this gym on: its footprint, which is what
     *  "every weekend it is open" is measured against. */
    both: number
  }
  const gyms = new Map<string, GymDelta>()
  const gymFor = (venueId: string, name: string): GymDelta => {
    const seen = gyms.get(venueId)
    if (seen) return seen
    const made: GymDelta = { name, changed: [], gone: [], fresh: [], both: 0 }
    gyms.set(venueId, made)
    return made
  }
  /** Weekends whose numbers a gym line already explains, so the hours
   *  fallback below never says the same thing twice. */
  const explained = new Set<string>()

  for (const sessionId of shared) {
    const was = savedWeekends.get(sessionId) as PlanWorldWeekend
    const now = liveWeekends.get(sessionId) as PlanWorldWeekend
    const wasVenues = venuesOf(was)
    const nowVenues = venuesOf(now)
    for (const [venueId, venue] of wasVenues) {
      const next = nowVenues.get(venueId)
      if (!next) {
        gymFor(venueId, venue.name).gone.push(was.label)
        explained.add(sessionId)
        continue
      }
      const gym = gymFor(venueId, venue.name)
      gym.both++
      if (next.capacityGames !== venue.capacityGames) {
        gym.changed.push({
          label: was.label,
          from: venue.capacityGames,
          to: next.capacityGames,
        })
        explained.add(sessionId)
      }
    }
    for (const [venueId, venue] of nowVenues) {
      if (wasVenues.has(venueId)) continue
      gymFor(venueId, venue.name).fresh.push(now.label)
      explained.add(sessionId)
    }
  }

  for (const gym of gyms.values()) {
    if (gym.changed.length === 0) continue
    const everywhere = gym.changed.length === sharedCount && sharedCount > 0
    const first = gym.changed[0]
    const uniform = gym.changed.every((c) => c.from === first.from && c.to === first.to)
    // A gym open nine weekends of thirteen that changed on all nine has not
    // changed "all season", and "on 9 weekends" makes the operator count. It
    // changed every weekend it is open, which is the fact.
    const wholeFootprint = !everywhere && gym.changed.length === gym.both && gym.both > 1
    const where = wholeFootprint
      ? "every weekend it is open"
      : whichWeekends(
          gym.changed.map((c) => c.label),
          everywhere
        )
    out.push(
      uniform
        ? `${gym.name} holds ${gamesWord(first.from)} ${where} in this plan; the season now gives it ${first.to}.`
        : `${gym.name} holds a different number of games ${where} now (${first.label}: ${first.from} in this plan, ${first.to} in the season).`
    )
  }

  /* 3. Gyms that came and went. */
  for (const gym of gyms.values()) {
    if (gym.gone.length > 0) {
      const everywhere = gym.gone.length === sharedCount && sharedCount > 0
      out.push(
        everywhere
          ? `The season does not open ${gym.name} any more, and this plan uses it all season.`
          : `The season does not open ${gym.name} ${whichWeekends(gym.gone, false)} any more, and this plan uses it there.`
      )
    }
    if (gym.fresh.length > 0) {
      const everywhere = gym.fresh.length === sharedCount && sharedCount > 0
      out.push(
        everywhere
          ? `The season now opens ${gym.name} every weekend, and this plan never uses it.`
          : `The season now opens ${gym.name} ${whichWeekends(gym.fresh, false)}, and this plan does not use it there.`
      )
    }
  }

  /* 4. Which building the league OWNS (owner ruling 2026-08-03) — the one
        thing about gyms that changes every number on the board, because the
        home gym is the only one that costs nothing. A snapshot from before
        that ruling has no roles, and then the honest comparison is the one it
        was saved under: which gym filled first. */
  const savedRoles = homeGymOf(saved)
  const liveRoles = homeGymOf(live)
  if (savedRoles.known && liveRoles.known) {
    const was = savedRoles.home
    const now = liveRoles.home
    if (was && now && was.venueId !== now.venueId) {
      out.push(`This plan treats ${was.name} as the home gym; the season now owns ${now.name}.`)
    } else if (was && !now) {
      out.push(`This plan treats ${was.name} as the home gym; the season now rents every gym.`)
    } else if (!was && now) {
      out.push(`The season now owns ${now.name}; this plan rents every gym.`)
    }
  } else {
    const savedOrder = fillOrderOf(saved)
    const liveOrder = fillOrderOf(live)
    const common = [...savedOrder.keys()].filter((id) => liveOrder.has(id))
    if (common.length > 1) {
      const sequence = (from: Map<string, { name: string; order: number }>) =>
        common
          .map((id) => from.get(id) as { name: string; order: number })
          .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, "en"))
          .map((v) => v.name)
      const before = sequence(savedOrder)
      const after = sequence(liveOrder)
      if (before.join("|") !== after.join("|")) {
        out.push(
          `This plan fills ${before.join(", then ")}; the season now fills ${after.join(", then ")}.`
        )
      }
    }
  }

  /* 5. The teams each grade plans on, which is the demand side of every
        meter on the board. */
  const savedUnits = new Map((saved.units ?? []).map((u) => [u.key, u]))
  const liveUnits = new Map((live.units ?? []).map((u) => [u.key, u]))
  for (const [key, unit] of savedUnits) {
    const next = liveUnits.get(key)
    if (!next || next.teams === unit.teams) continue
    out.push(`${unit.label} planned at ${teamsWord(unit.teams)}; the season now expects ${next.teams}.`)
  }

  /* 6. Grades that arrived or left entirely. */
  const droppedGrades = [...savedUnits.values()].filter((u) => !liveUnits.has(u.key))
  const addedGrades = [...liveUnits.values()].filter((u) => !savedUnits.has(u.key))
  if (droppedGrades.length > 0) {
    out.push(
      `${nameList(droppedGrades.map((u) => u.label))} ${
        droppedGrades.length === 1 ? "is in this plan but is" : "are in this plan but are"
      } not in the season any more.`
    )
  }
  if (addedGrades.length > 0) {
    out.push(
      `The season has added ${nameList(addedGrades.map((u) => u.label))}, which this plan never placed.`
    )
  }

  /* 7. Games per team: the other half of demand. */
  const targetMoves: Array<{ label: string; from: number; to: number }> = []
  for (const sessionId of shared) {
    const was = savedWeekends.get(sessionId) as PlanWorldWeekend
    const now = liveWeekends.get(sessionId) as PlanWorldWeekend
    if (was.targetGamesPerTeam !== now.targetGamesPerTeam) {
      targetMoves.push({
        label: was.label,
        from: was.targetGamesPerTeam,
        to: now.targetGamesPerTeam,
      })
    }
  }
  if (targetMoves.length > 0) {
    const first = targetMoves[0]
    const everywhere = targetMoves.length === sharedCount && sharedCount > 0
    const uniform = targetMoves.every((m) => m.from === first.from && m.to === first.to)
    const where = whichWeekends(
      targetMoves.map((m) => m.label),
      everywhere
    )
    out.push(
      uniform
        ? `Each team played ${gamesWord(first.from)} a weekend ${where} in this plan; the season now plans ${first.to}.`
        : `Each team plays a different number of games ${where} now (${first.label}: ${first.from} in this plan, ${first.to} in the season).`
    )
  }
  if (
    saved.gamesPerTeam !== undefined &&
    live.gamesPerTeam !== undefined &&
    saved.gamesPerTeam !== live.gamesPerTeam
  ) {
    out.push(
      `Every team was promised ${gamesWord(saved.gamesPerTeam)} this season in the plan; the season now promises ${live.gamesPerTeam}.`
    )
  }

  /* 8. A weekend whose total moved with no gym of its own to blame. The
        fallback for a world that carries no per-gym detail. */
  const hoursMoves: Array<{ label: string; from: number; to: number }> = []
  for (const sessionId of shared) {
    if (explained.has(sessionId)) continue
    const was = savedWeekends.get(sessionId) as PlanWorldWeekend
    const now = liveWeekends.get(sessionId) as PlanWorldWeekend
    if (was.capacityGames !== now.capacityGames) {
      hoursMoves.push({ label: was.label, from: was.capacityGames, to: now.capacityGames })
    }
  }
  if (hoursMoves.length === 1) {
    out.push(
      `${hoursMoves[0].label} holds ${gamesWord(hoursMoves[0].from)} in this plan; the season now gives it ${hoursMoves[0].to}.`
    )
  } else if (hoursMoves.length > 1) {
    const first = hoursMoves[0]
    out.push(
      `${hoursMoves.length} weekends hold a different number of games now (${first.label}: ${first.from} in this plan, ${first.to} in the season).`
    )
  }

  if (out.length <= DRIFT_LIMIT) return out
  const rest = out.length - DRIFT_LIMIT
  return [...out.slice(0, DRIFT_LIMIT), `and ${rest} more difference${rest === 1 ? "" : "s"}.`]
}

/** The imported snapshot is the only record of what the league actually
 *  published, so the board reads it and never writes back onto it. */
export const isReferencePlan = (plan: Pick<PlanRow, "source"> | null | undefined): boolean =>
  plan?.source === "imported"

/**
 * The quiet words a row wears next to its name. Both are facts about the plan
 * rather than decoration: one plan drives the season, and one plan cannot be
 * written to. Everything else in the list is just a name.
 */
export function planMarkers(plan: PlanRow): string[] {
  const marks: string[] = []
  if (plan.isActive) marks.push("active")
  if (isReferencePlan(plan)) marks.push("reference")
  return marks
}

/** What the API takes, so the box can stop the operator before the server has
 *  to. */
export const PLAN_NAME_MAX = 60

/**
 * The name to put in the box: the base, or the first free number after it.
 * Saving your work should never start with inventing a word for it.
 */
export function suggestPlanName(plans: Array<Pick<PlanRow, "name">>, base = "Our plan"): string {
  const taken = new Set(plans.map((p) => p.name.trim().toLowerCase()))
  const root = (base.trim() || "Our plan").slice(0, PLAN_NAME_MAX).trim()
  if (!taken.has(root.toLowerCase())) return root
  let candidate = root
  for (let n = 2; n <= 999; n++) {
    const suffix = ` ${n}`
    candidate = `${root.slice(0, PLAN_NAME_MAX - suffix.length).trim()}${suffix}`
    if (!taken.has(candidate.toLowerCase())) return candidate
  }
  return candidate
}

/** The words the step says about plans, in one place so the picker, the save
 *  controls and the confirmations cannot drift apart. */
export const PLAN_COPY = {
  /** Said before anybody tries to save onto the reference, not after. */
  reference: "Reference plan, save changes as your own.",
  discard:
    "The board has changes you have not saved. Opening another plan throws them away. Open it anyway?",
  activate: (name: string) =>
    `Use ${name} for the season? The calendar everyone sees becomes this one.`,
  /** Under the save button, when saving writes straight through. */
  writeThrough: "This is the season's calendar, so saving updates it everywhere.",
  saveFirst: "Save your changes first.",
  /** The first plan of a season that has never kept a calendar. */
  takesOver: "Nothing runs this season yet, so this becomes its calendar.",
  /** Above the board, when the plan on screen was saved in a world the season
   *  has since moved on from. */
  drift: (first: string, more: number) =>
    `Saved under different settings: ${first}${more > 0 ? ` (+${more} more)` : ""}`,
  /** A plan from before plans remembered their settings. Said once, quietly:
   *  there is nothing to compare, and that is not the operator's fault. */
  driftUnknown: "Saved before plans remembered their settings, so this one does not know the gyms, hours or estimates it was made under.",
  /** The board is drawing the plan's own numbers, not the season's. */
  driftBoard: "The board is showing this plan's own settings, so every number here is the world it was saved in.",
  /** Said of the plan the season runs, whose board is the live world. */
  driftActive: "The board is showing the season's settings, because this is the plan the season runs.",
  /** What activating does NOT do. Settings write-back is a later phase, so the
   *  warning has to name what stays put. */
  activateKeeps:
    "Activating applies this plan's calendar. The season keeps its current gyms, hours and estimates.",
  /** The levers solve against the season's world, so they have nothing honest
   *  to say about a board drawn in a saved one. */
  leverSnapshot:
    "Levers use the season's current settings. Make this plan active, or start a new plan.",
}

/**
 * What the confirmation says before a plan with drift takes over the season.
 * The differences first, because they are the reason to stop and read, then
 * the plain statement of what activating does and does not change.
 */
export function activateConfirmText(name: string, drift: string[]): string {
  if (drift.length === 0) return PLAN_COPY.activate(name)
  return [
    PLAN_COPY.activate(name),
    "",
    "This plan was saved under different settings:",
    ...drift.map((line) => `• ${line}`),
    "",
    PLAN_COPY.activateKeeps,
  ].join("\n")
}

/**
 * Where the board stands, in one line: whose plan is on screen, whether it is
 * saved, and whether the season is actually running it. The old line only knew
 * "saved" and "not saved", which is now two thirds of the answer.
 */
export function planStateLine({
  selected,
  active,
  dirty,
}: {
  selected: PlanRow | null
  active: PlanRow | null
  dirty: boolean
}): string {
  if (dirty) {
    if (!selected) return "Nothing is saved until you name it and save it."
    if (isReferencePlan(selected)) return "Changes are not saved. Keep them as a plan of your own."
    return `Changes to ${selected.name} are not saved yet.`
  }
  if (!selected) return "This calendar is saved."
  if (selected.isActive) return `${selected.name} is the season's calendar.`
  if (active) return `Saved to ${selected.name}. The season still runs ${active.name}.`
  return `Saved to ${selected.name}.`
}
