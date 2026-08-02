import { prisma } from "@youthbasketballhub/db"
import { weekendLabel } from "@/lib/scheduler/planner-core"

/**
 * The gyms-and-weekends grid (planner step 2, owner 2026-08-02). One row per
 * gym on the season, one column per weekend, and a state per cell:
 *
 *   on      the gym is attached to that weekend's days
 *   off     it is not — RELEASED, and only ever because the operator said so.
 *           Nothing here pre-marks a weekend unavailable.
 *   custom  attached, but on a window that differs from the season's default
 *           for that weekday (a one-weekend exception edited on the cell)
 *
 * Deliberately NOT built on buildPlannerState/buildSlots: step 2 runs before
 * registration, where loadSchedulerInput legitimately returns no input (no
 * approved teams yet) and the whole grid would come back empty. This reads
 * the substrate directly, so the grid works from the moment a season has
 * weekends and a gym.
 */

export type VenueCellState = "on" | "off" | "custom"

export interface VenueGridWeekend {
  sessionId: string
  label: string
  dateISO: string
  dayCount: number
}

export interface VenueGridCell {
  sessionId: string
  state: VenueCellState
  /** Days of the weekend this gym is on (0 = released). */
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
      select: { label: true, league: { select: { name: true } } },
    }),
    (prisma as any).seasonVenue.findMany({
      where: { seasonId },
      orderBy: [{ isPrimary: "desc" }, { id: "asc" }],
      select: {
        id: true,
        venueId: true,
        isPrimary: true,
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
      where: { seasonId, phase: "REGULAR" },
      select: {
        id: true,
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

  const dated = sessions
    .filter((s: any) => s.days.length > 0)
    .sort(
      (a: any, b: any) =>
        new Date(a.days[0].date).getTime() - new Date(b.days[0].date).getTime()
    )

  const weekends: VenueGridWeekend[] = dated.map((s: any) => ({
    sessionId: s.id,
    label: weekendLabel(s.days.map((d: any) => d.date)),
    dateISO: new Date(s.days[0].date).toISOString(),
    dayCount: s.days.length,
  }))

  // The weekdays this season actually plays — the ones worth summarizing in
  // the venue card's "Sat–Sun 8:00 – 20:00" fact.
  const dowSet = new Set<number>()
  for (const s of dated as any[]) {
    for (const d of s.days) dowSet.add(new Date(d.date).getUTCDay())
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

    const cells: VenueGridCell[] = dated.map((s: any) => {
      const mine = s.days
        .map((d: any) => ({
          dow: new Date(d.date).getUTCDay(),
          dv: d.dayVenues.find((x: any) => x.venueId === sv.venueId),
        }))
        .filter((x: any) => x.dv)

      if (mine.length === 0) {
        return {
          sessionId: s.id,
          state: "off" as const,
          daysOn: 0,
          dayCount: s.days.length,
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
        sessionId: s.id,
        state: custom ? ("custom" as const) : ("on" as const),
        daysOn: mine.length,
        dayCount: s.days.length,
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
      courtsAvailable: sv.courtsAvailable ?? null,
      courtCount: sv.venue.courtList.length,
      courts: sv.venue.courtList,
      defaultHours: sv.hours,
      postedHours: sv.venue.venueHours ?? [],
      defaultWindowLabel,
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
