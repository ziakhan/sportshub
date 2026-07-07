/**
 * Minimal RFC 5545 iCalendar builder for the personal feed
 * (/api/calendar/[token]) — practices + games, subscribable from iOS
 * (webcal://) and Google Calendar ("from URL"). Times are emitted in UTC
 * (trailing Z); subscribing clients render them in the phone's timezone.
 */

export interface CalendarEvent {
  /** Stable across updates — clients match on UID to apply changes */
  uid: string
  title: string
  start: Date
  end: Date
  location?: string | null
  description?: string | null
  cancelled?: boolean
  /** Bump when the event changes so clients pick up moves (updatedAt works) */
  sequence?: number
}

function icsDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")
}

function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n")
}

/** RFC 5545 §3.1 — lines longer than 75 octets fold with CRLF + space */
function fold(line: string): string {
  if (line.length <= 75) return line
  const chunks: string[] = []
  let rest = line
  while (rest.length > 75) {
    chunks.push(rest.slice(0, 75))
    rest = " " + rest.slice(75)
  }
  chunks.push(rest)
  return chunks.join("\r\n")
}

export function buildIcs(calendarName: string, events: CalendarEvent[]): string {
  const now = icsDate(new Date())
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SportsHub//Team Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(calendarName)}`,
    "X-PUBLISHED-TTL:PT1H",
  ]
  for (const event of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${event.uid}`,
      `DTSTAMP:${now}`,
      `DTSTART:${icsDate(event.start)}`,
      `DTEND:${icsDate(event.end)}`,
      `SUMMARY:${escapeText(event.title)}`,
      `SEQUENCE:${event.sequence ?? 0}`,
      `STATUS:${event.cancelled ? "CANCELLED" : "CONFIRMED"}`
    )
    if (event.location) lines.push(`LOCATION:${escapeText(event.location)}`)
    if (event.description) lines.push(`DESCRIPTION:${escapeText(event.description)}`)
    lines.push("END:VEVENT")
  }
  lines.push("END:VCALENDAR")
  return lines.map(fold).join("\r\n") + "\r\n"
}
