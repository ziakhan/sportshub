import { prisma } from "@youthbasketballhub/db"
import { weekendLabel } from "@/lib/scheduler/planner-core"

/**
 * The gyms-and-weekends grid (planner step 2, owner 2026-08-02). One row per
 * gym on the season, one column per weekend, and a state per cell:
 *
 *   on      the gym is attached to that weekend's days
 *   off     it is not — either the operator released it, or nobody has turned
 *           that weekend on yet. Nothing here pre-marks a weekend unavailable.
 *   custom  attached, but on a window that differs from the season's default
 *           for that weekday (a one-weekend exception)
 *
 * Owner ruling 2026-08-02: "you're only selecting one weekend per month. Let's
 * make it open for every month, all weekends, and people can choose because we
 * currently don't have visibility." So the columns are no longer the weekends
 * that happen to exist as sessions — they are EVERY Saturday–Sunday across the
 * season's span, grouped by month. A weekend with no session yet is virtual:
 * every cell reads off, and turning one on creates the session (see
 * ensureWeekendSession in venue-propagation.ts).
 *
 * Deliberately NOT built on buildPlannerState/buildSlots: step 2 runs before
 * registration, where loadSchedulerInput legitimately returns no input (no
 * approved teams yet) and the whole grid would come back empty. This reads
 * the substrate directly, so the grid works from the moment a season has
 * dates or a gym.
 */

export type VenueCellState = "on" | "off" | "custom"

export interface VenueGridWeekend {
  /** Stable column key: the Saturday, or the session when it sits off-weekend. */
  key: string
  /** The Saturday this weekend starts on, UTC midnight ISO. Null only for a
   *  session whose days are not a Sat/Sun (kept so nothing disappears). */
  satDateISO: string | null
  /** The session backing this column, or null when the weekend is virtual. */
  sessionId: string | null
  phase: "REGULAR" | "PLAYOFF" | null
  /** "Oct 24–25" — the full human label. */
  label: string
  /** "24–25" — the label without the month, which heads the column group. */
  dayLabel: string
  /** "Oct" — the month header this column sits under. */
  month: string
  /** First day of the column, for ordering. */
  dateISO: string
  dayCount: number
}

export interface VenueGridCell {
  /** Null when the weekend has no session yet — attaching creates one. */
  sessionId: string | null
  satDateISO: string | null
  state: VenueCellState
  /** Days of the weekend this gym is on (0 = off). */
  daysOn: number
  dayCount: number
  /** Courts wired in on the busiest day of the weekend. */
  courts: number
  startTime: string | null
  endTime: string | null
  /** Short cell caption for a custom window: "to 21:00", "from 07:00". */
  hoursLabel: string | null
}

export interface VenueGridHours {
  dayOfWeek: number
  openTime: string | null
  closeTime: string | null
}

export interface VenueGridRow {
  seasonVenueId: string
  venueId: string
  name: string
  city: string | null
  isPrimary: boolean
  /** Which gym the league fills FIRST (0 = first choice, null = nobody has
   *  ordered it yet). The rows arrive in this order, so the top card on step
   *  2 is the building the planner packs into before opening another. */
  fillOrder: number | null
  courtsAvailable: number | null
  courtCount: number
  /** Full court list so the card can hand VenueEditor its usual props. */
  courts: Array<{ id: string; name: string; displayOrder: number }>
  /** The season's private scheduling hours at this gym (the editable set). */
  defaultHours: VenueGridHours[]
  /** The gym's own posted hours, reference only. */
  postedHours: VenueGridHours[]
  /** "Sat–Sun 8:00 – 20:00" across the weekdays this season actually plays. */
  defaultWindowLabel: string | null
  /** The ONE window the card edits: same hours every weekend (owner
   *  2026-08-02). Saturday's, falling back to Sunday's, then the gym's
   *  posted hours. */
  simpleOpen: string | null
  simpleClose: string | null
  /** True when Saturday and Sunday currently disagree, so the card can say
   *  saving will make them the same instead of silently flattening one. */
  hoursVary: boolean
  cells: VenueGridCell[]
}

export interface VenueGrid {
  seasonId: string
  seasonLabel: string | null
  leagueName: string | null
  weekends: VenueGridWeekend[]
  venues: VenueGridRow[]
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const DAY_MS = 24 * 60 * 60 * 1000

/** Midnight UTC of a date, so every key and every created day agrees. */
function utcMidnight(value: Date | string): Date {
  const d = new Date(value)
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

function shortMonth(d: Date): string {
  return d.toLocaleString("en-CA", { month: "short", timeZone: "UTC" })
}

/** "24–25", or "31–Nov 1" when the weekend straddles two months. */
function dayLabelFor(days: Date[]): string {
  if (days.length === 0) return ""
  const first = days[0]
  const last = days[days.length - 1]
  if (days.length === 1) return `${first.getUTCDate()}`
  return first.getUTCMonth() === last.getUTCMonth()
    ? `${first.getUTCDate()}–${last.getUTCDate()}`
    : `${first.getUTCDate()}–${shortMonth(last)} ${last.getUTCDate()}`
}

/** The Saturday a session sits on, or null when its first day is Mon–Fri. */
function saturdayOf(day: Date): Date | null {
  const dow = day.getUTCDay()
  if (dow === 6) return day
  if (dow === 0) return new Date(day.getTime() - DAY_MS)
  return null
}

export interface SeasonWeekendInput {
  start?: Date | string | null
  end?: Date | string | null
  sessions: Array<{ id: string; phase?: string | null; days: Array<Date | string> }>
}

/**
 * Every Sat–Sun weekend across a season's span, in date order (pure — unit
 * tested in venue-grid.test.ts).
 *
 * The span is the widest of the season's own start/end dates and the days it
 * already has sessions on, widened to whole months: the 1st of the first
 * month to the last day of the last month. A season with dates but no
 * sessions still gets a full grid (that is the case the owner hit: adding a
 * gym before any weekend exists), and a season whose real weekends run
 * outside its declared dates never loses one.
 *
 * A weekend that already has a session carries its id and phase; the rest are
 * virtual. Sessions whose days are NOT a Sat/Sun keep their own column so
 * nothing the season already has disappears.
 */
export function enumerateSeasonWeekends(input: SeasonWeekendInput): VenueGridWeekend[] {
  const sessions = input.sessions
    .map((s) => ({
      id: s.id,
      phase: (s.phase === "PLAYOFF" ? "PLAYOFF" : "REGULAR") as "REGULAR" | "PLAYOFF",
      days: s.days.map(utcMidnight).sort((a, b) => a.getTime() - b.getTime()),
    }))
    .filter((s) => s.days.length > 0)
    .sort((a, b) => a.days[0].getTime() - b.days[0].getTime())

  // Span candidates: the season's declared dates and every day it plays.
  const marks: Date[] = []
  for (const value of [input.start, input.end]) {
    if (value) {
      const d = utcMidnight(value)
      if (!Number.isNaN(d.getTime())) marks.push(d)
    }
  }
  for (const s of sessions) {
    marks.push(s.days[0], s.days[s.days.length - 1])
  }

  const columns: VenueGridWeekend[] = []
  const claimed = new Set<string>()

  const column = (
    days: Date[],
    session: { id: string; phase: "REGULAR" | "PLAYOFF" } | null
  ): VenueGridWeekend => {
    const sat = saturdayOf(days[0])
    return {
      key: sat ? sat.toISOString() : `session:${session?.id}`,
      satDateISO: sat ? sat.toISOString() : null,
      sessionId: session?.id ?? null,
      phase: session?.phase ?? null,
      label: weekendLabel(days),
      dayLabel: dayLabelFor(days),
      month: shortMonth(days[0]),
      dateISO: days[0].toISOString(),
      dayCount: days.length,
    }
  }

  // Real sessions first: they own their weekend, virtual columns fill the rest.
  for (const s of sessions) {
    const col = column(s.days, { id: s.id, phase: s.phase })
    // Two sessions on one weekend (rare) each keep a column rather than one
    // of them vanishing; the second gets a key of its own.
    if (claimed.has(col.key)) col.key = `${col.key}:${s.id}`
    claimed.add(col.key)
    // Every Saturday this session touches is spoken for, even when the
    // session starts on another weekday — otherwise a Fri–Sat session would
    // get a second, permanently-off column for its own Saturday.
    for (const day of s.days) {
      const sat = saturdayOf(day)
      if (sat) claimed.add(sat.toISOString())
    }
    columns.push(col)
  }

  if (marks.length > 0) {
    const min = new Date(Math.min(...marks.map((d) => d.getTime())))
    const max = new Date(Math.max(...marks.map((d) => d.getTime())))
    const spanStart = new Date(Date.UTC(min.getUTCFullYear(), min.getUTCMonth(), 1))
    const spanEnd = new Date(Date.UTC(max.getUTCFullYear(), max.getUTCMonth() + 1, 0))

    // First Saturday on or after the span start.
    const sat = new Date(spanStart)
    sat.setUTCDate(sat.getUTCDate() + ((6 - sat.getUTCDay() + 7) % 7))
    for (; sat.getTime() <= spanEnd.getTime(); sat.setUTCDate(sat.getUTCDate() + 7)) {
      const iso = sat.toISOString()
      if (claimed.has(iso)) continue
      const sun = new Date(sat.getTime() + DAY_MS)
      columns.push(column([new Date(sat), sun], null))
      claimed.add(iso)
    }
  }

  return columns.sort((a, b) => {
    const byDate = new Date(a.dateISO).getTime() - new Date(b.dateISO).getTime()
    if (byDate !== 0) return byDate
    // A real session sorts ahead of a virtual column on the same day.
    if (!!a.sessionId !== !!b.sessionId) return a.sessionId ? -1 : 1
    return a.key.localeCompare(b.key)
  })
}

/** The window a weekend SHOULD have by default: the season's private hours
 *  at the gym, else the gym's posted hours. Anything else is an exception. */
function defaultWindowFor(
  dow: number,
  seasonHours: Map<number, { open: string; close: string }>,
  venueHours: Map<number, { open: string; close: string }>
): { open: string; close: string } | null {
  return seasonHours.get(dow) ?? venueHours.get(dow) ?? null
}

function cellHoursLabel(
  start: string | null,
  end: string | null,
  fallback: { open: string; close: string } | null
): string | null {
  if (!start || !end) return null
  if (fallback && start === fallback.open) return `to ${end}`
  if (fallback && end === fallback.close) return `from ${start}`
  return `${start}–${end}`
}

export async function buildVenueWeekendGrid(seasonId: string): Promise<VenueGrid> {
  const [season, seasonVenues, sessions] = await Promise.all([
    (prisma as any).season.findUnique({
      where: { id: seasonId },
      select: {
        label: true,
        startDate: true,
        endDate: true,
        league: { select: { name: true } },
      },
    }),
    (prisma as any).seasonVenue.findMany({
      where: { seasonId },
      // Fill order leads (owner 2026-08-02: the gym on top is the one that
      // fills first). Postgres sorts NULLs last on asc, so gyms nobody has
      // ordered yet keep their old home-gym-first order underneath.
      orderBy: [{ fillOrder: "asc" }, { isPrimary: "desc" }, { id: "asc" }],
      select: {
        id: true,
        venueId: true,
        isPrimary: true,
        fillOrder: true,
        courtsAvailable: true,
        hours: {
          orderBy: { dayOfWeek: "asc" },
          select: { dayOfWeek: true, openTime: true, closeTime: true },
        },
        venue: {
          select: {
            id: true,
            name: true,
            city: true,
            courtList: {
              orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
              select: { id: true, name: true, displayOrder: true },
            },
            venueHours: {
              orderBy: { dayOfWeek: "asc" },
              select: { dayOfWeek: true, openTime: true, closeTime: true },
            },
          },
        },
      },
    }),
    (prisma as any).seasonSession.findMany({
      where: { seasonId },
      select: {
        id: true,
        phase: true,
        days: {
          orderBy: { date: "asc" },
          select: {
            id: true,
            date: true,
            dayVenues: {
              select: {
                id: true,
                venueId: true,
                startTime: true,
                endTime: true,
                _count: { select: { courts: true } },
              },
            },
          },
        },
      },
    }),
  ])

  const weekends = enumerateSeasonWeekends({
    start: season?.startDate ?? null,
    end: season?.endDate ?? null,
    sessions: sessions.map((s: any) => ({
      id: s.id,
      phase: s.phase,
      days: s.days.map((d: any) => d.date),
    })),
  })

  const sessionById = new Map<string, any>(sessions.map((s: any) => [s.id, s]))

  // The weekdays this season plays — every enumerated weekend is Sat/Sun, and
  // any off-weekend session the season already has counts too.
  const dowSet = new Set<number>()
  for (const w of weekends) {
    if (w.satDateISO) {
      dowSet.add(6)
      dowSet.add(0)
    }
    const session = w.sessionId ? sessionById.get(w.sessionId) : null
    for (const d of session?.days ?? []) dowSet.add(new Date(d.date).getUTCDay())
  }
  // Saturday before Sunday, the way a weekend actually reads.
  const playedDows = [...dowSet].sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b))

  const venues: VenueGridRow[] = seasonVenues.map((sv: any) => {
    const seasonHours = new Map<number, { open: string; close: string }>()
    for (const h of sv.hours) {
      if (h.openTime && h.closeTime) seasonHours.set(h.dayOfWeek, { open: h.openTime, close: h.closeTime })
    }
    const venueHours = new Map<number, { open: string; close: string }>()
    for (const h of sv.venue.venueHours ?? []) {
      if (h.openTime && h.closeTime) venueHours.set(h.dayOfWeek, { open: h.openTime, close: h.closeTime })
    }

    const windows = playedDows.map((dow) => defaultWindowFor(dow, seasonHours, venueHours))
    const first = windows[0]
    const uniform = first != null && windows.every((w) => w && w.open === first.open && w.close === first.close)
    const defaultWindowLabel = uniform
      ? `${playedDows.map((d) => DAY_LABELS[d]).join("–")} ${first.open} – ${first.close}`
      : windows.some((w) => w != null)
        ? "Varies by day"
        : null

    // The one window the card edits. Saturday leads because that is the day
    // every weekend has; Sunday and the gym's posted hours back it up.
    const sat = defaultWindowFor(6, seasonHours, venueHours)
    const sun = defaultWindowFor(0, seasonHours, venueHours)
    const simple = sat ?? sun
    const hoursVary = !!sat && !!sun && (sat.open !== sun.open || sat.close !== sun.close)

    const cells: VenueGridCell[] = weekends.map((w) => {
      const session = w.sessionId ? sessionById.get(w.sessionId) : null
      const days: any[] = session?.days ?? []
      const mine = days
        .map((d: any) => ({
          dow: new Date(d.date).getUTCDay(),
          dv: d.dayVenues.find((x: any) => x.venueId === sv.venueId),
        }))
        .filter((x: any) => x.dv)

      if (mine.length === 0) {
        return {
          sessionId: w.sessionId,
          satDateISO: w.satDateISO,
          state: "off" as const,
          daysOn: 0,
          dayCount: w.dayCount,
          courts: 0,
          startTime: null,
          endTime: null,
          hoursLabel: null,
        }
      }

      const custom = mine.some(({ dow, dv }: any) => {
        const def = defaultWindowFor(dow, seasonHours, venueHours)
        if (!def) return false
        return dv.startTime !== def.open || dv.endTime !== def.close
      })
      const lead = mine[0]
      return {
        sessionId: w.sessionId,
        satDateISO: w.satDateISO,
        state: custom ? ("custom" as const) : ("on" as const),
        daysOn: mine.length,
        dayCount: w.dayCount,
        courts: Math.max(...mine.map(({ dv }: any) => dv._count.courts)),
        startTime: lead.dv.startTime,
        endTime: lead.dv.endTime,
        hoursLabel: custom
          ? cellHoursLabel(lead.dv.startTime, lead.dv.endTime, defaultWindowFor(lead.dow, seasonHours, venueHours))
          : null,
      }
    })

    return {
      seasonVenueId: sv.id,
      venueId: sv.venueId,
      name: sv.venue.name,
      city: sv.venue.city ?? null,
      isPrimary: sv.isPrimary,
      fillOrder: sv.fillOrder ?? null,
      courtsAvailable: sv.courtsAvailable ?? null,
      courtCount: sv.venue.courtList.length,
      courts: sv.venue.courtList,
      defaultHours: sv.hours,
      postedHours: sv.venue.venueHours ?? [],
      defaultWindowLabel,
      simpleOpen: simple?.open ?? null,
      simpleClose: simple?.close ?? null,
      hoursVary,
      cells,
    }
  })

  return {
    seasonId,
    seasonLabel: season?.label ?? null,
    leagueName: season?.league?.name ?? null,
    weekends,
    venues,
  }
}
