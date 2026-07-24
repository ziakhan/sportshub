import { computeCampFee, type CampPricingInput } from "./camp-pricing"

/**
 * Camp schedule math — program flexibility (owner 2026-07-24, Bucket D1).
 * CONSECUTIVE camps keep the existing week model (camp-pricing.ts) exactly
 * as-is; DAILY and WEEKDAY_PATTERN camps sell individual session dates
 * instead of weeks. This is the single source both the signup API and every
 * display surface read from — never re-derive session dates or fee math
 * inline.
 */

export type CampScheduleKind = "CONSECUTIVE" | "DAILY" | "WEEKDAY_PATTERN"

export interface CampScheduleInput {
  scheduleKind: CampScheduleKind
  startDate: Date | string
  endDate: Date | string
  daysOfWeek: number[]
}

/** Midnight-UTC of the given date, dropping any time-of-day component. */
function utcDateOnly(value: Date | string): Date {
  const d = new Date(value)
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

/**
 * Every concrete session date for a DAILY/WEEKDAY_PATTERN camp, inclusive of
 * both endpoints. CONSECUTIVE camps sell weeks, not dates — returns [].
 */
export function sessionDatesFor(camp: CampScheduleInput): Date[] {
  if (camp.scheduleKind === "CONSECUTIVE") return []

  const cursor = utcDateOnly(camp.startDate)
  const end = utcDateOnly(camp.endDate)
  const dates: Date[] = []

  while (cursor.getTime() <= end.getTime()) {
    if (camp.scheduleKind === "DAILY" || camp.daysOfWeek.includes(cursor.getUTCDay())) {
      dates.push(new Date(cursor))
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return dates
}

export interface CampFeeInput {
  scheduleKind: CampScheduleKind
  numberOfWeeks: number
  weeklyFee: number
  fullCampFee: number | null
  pricePerSession: number | null
  /** Needed to derive "every session selected" for the full-program guard. */
  startDate: Date | string
  endDate: Date | string
  daysOfWeek: number[]
}

export interface CampFeeSelection {
  /** CONSECUTIVE only. */
  weeksCount?: number
  /** DAILY/WEEKDAY_PATTERN only. */
  sessionCount?: number
}

/**
 * Total fee for a kid's selection. CONSECUTIVE delegates to computeCampFee
 * (unchanged legacy behavior). DAILY/WEEKDAY_PATTERN charge per selected
 * session, with the full-program price applying only when every session is
 * selected AND it's genuinely not worse than paying per-session — the same
 * guard computeCampFee uses for the weekly model.
 */
export function campFeeFor(camp: CampFeeInput, selection: CampFeeSelection): number {
  if (camp.scheduleKind === "CONSECUTIVE") {
    const pricing: CampPricingInput = {
      numberOfWeeks: camp.numberOfWeeks,
      weeklyFee: camp.weeklyFee,
      fullCampFee: camp.fullCampFee,
    }
    return computeCampFee(pricing, selection.weeksCount ?? camp.numberOfWeeks).total
  }

  const totalSessions = sessionDatesFor(camp).length
  const sessionCount = Math.max(0, Math.min(selection.sessionCount ?? 0, totalSessions))
  const perSessionTotal = sessionCount * (camp.pricePerSession ?? 0)

  if (
    camp.fullCampFee != null &&
    sessionCount === totalSessions &&
    camp.fullCampFee <= perSessionTotal
  ) {
    return camp.fullCampFee
  }
  return perSessionTotal
}

/** The unit families pick when registering — weeks for CONSECUTIVE, dates otherwise. */
export function unitLabel(kind: CampScheduleKind): "week" | "session" {
  return kind === "CONSECUTIVE" ? "week" : "session"
}

const DAY_ABBR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

/**
 * Display text for a DAILY/WEEKDAY_PATTERN camp's schedule, e.g.
 * "Every Mon & Wed · 12 sessions" or "Every day · 10 sessions". CONSECUTIVE
 * camps render their own week-count text elsewhere — this returns "".
 */
export function campScheduleText(camp: CampScheduleInput): string {
  if (camp.scheduleKind === "CONSECUTIVE") return ""

  const sessionCount = sessionDatesFor(camp).length
  const sessionsText = `${sessionCount} session${sessionCount !== 1 ? "s" : ""}`

  if (camp.scheduleKind === "DAILY") return `Every day · ${sessionsText}`

  const days = [...camp.daysOfWeek].sort((a, b) => a - b).map((d) => DAY_ABBR[d])
  const daysText =
    days.length <= 1 ? days.join("") : `${days.slice(0, -1).join(", ")} & ${days[days.length - 1]}`
  return `Every ${daysText} · ${sessionsText}`
}
