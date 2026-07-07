/**
 * Wall-time → UTC conversion for the app's home timezone.
 *
 * Practice slots store wall time ("18:30" on Tuesdays). The server that
 * expands them into dated occurrences runs in UTC on Vercel — naive
 * `new Date(y, m, d, 18, 30)` there would produce 18:30 UTC, i.e. 2:30 PM
 * in Ontario. All occurrence generation must go through wallTimeToUtc.
 */

export const APP_TIMEZONE = process.env.APP_TIMEZONE || "America/Toronto"

/** Offset (ms) of `tz` from UTC at the given instant (positive = ahead). */
function tzOffsetMs(date: Date, tz: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
  const parts = Object.fromEntries(dtf.formatToParts(date).map((p) => [p.type, p.value]))
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second)
  )
  return asUtc - date.getTime()
}

/**
 * The UTC instant for a wall-clock time in `tz`. Two-pass so the offset is
 * taken at the target date (handles DST — each occurrence resolves its own
 * offset).
 */
export function wallTimeToUtc(
  year: number,
  month: number, // 1-12
  day: number,
  hour: number,
  minute: number,
  tz: string = APP_TIMEZONE
): Date {
  let ts = Date.UTC(year, month - 1, day, hour, minute)
  for (let i = 0; i < 2; i++) {
    ts = Date.UTC(year, month - 1, day, hour, minute) - tzOffsetMs(new Date(ts), tz)
  }
  return new Date(ts)
}

/** The calendar date (y/m/d) and weekday of a UTC instant, seen from `tz`. */
export function dateInTz(
  date: Date,
  tz: string = APP_TIMEZONE
): { year: number; month: number; day: number; dayOfWeek: number } {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  })
  const parts = Object.fromEntries(dtf.formatToParts(date).map((p) => [p.type, p.value]))
  const dayOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday)
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    dayOfWeek,
  }
}
