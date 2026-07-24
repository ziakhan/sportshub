import { format } from "date-fns"

/**
 * Trainer programs (batch-backlog §5). Shared labels + schedule formatting
 * for TrainingSession across operator pages, public pages, and emails.
 */

export const TRAINING_SESSION_TYPES = [
  { value: "GROUP_TRAINING", label: "Group Training" },
  { value: "CLINIC", label: "Clinic" },
  { value: "STRENGTH_CONDITIONING", label: "Strength & Conditioning" },
  { value: "OPEN_WORKOUT", label: "Open Workout" },
] as const

export type TrainingSessionTypeValue = (typeof TRAINING_SESSION_TYPES)[number]["value"]

export function trainingTypeLabel(value: string): string {
  return TRAINING_SESSION_TYPES.find((t) => t.value === value)?.label ?? "Training"
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

function formatTime12(startTime: string): string {
  const [h, m] = startTime.split(":").map(Number)
  const suffix = h >= 12 ? "PM" : "AM"
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return `${hour12}:${String(m).padStart(2, "0")} ${suffix}`
}

/** "Mondays & Wednesdays" / "Mondays, Wednesdays & Fridays". */
function joinDayNames(days: number[]): string {
  const names = [...days].sort((a, b) => a - b).map((d) => `${DAY_NAMES[d]}s`)
  if (names.length <= 1) return names.join("")
  return `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`
}

/**
 * "Sat Feb 7, 10:00 AM" (one-time) or
 * "Tuesdays 6:00 PM · Jan 6 – Mar 30" (recurring, single day) or
 * "Mondays & Wednesdays 6:00 PM · Jan 6 – Mar 30" (recurring, multi-day —
 * QA-203: daysOfWeek wins over dayOfWeek when more than one is set).
 */
export function formatTrainingSchedule(session: {
  scheduleType: string
  startAt?: Date | string | null
  dayOfWeek?: number | null
  daysOfWeek?: number[] | null
  startTime?: string | null
  startDate?: Date | string | null
  endDate?: Date | string | null
}): string {
  if (session.scheduleType === "RECURRING") {
    const day =
      session.daysOfWeek && session.daysOfWeek.length > 1
        ? joinDayNames(session.daysOfWeek)
        : session.dayOfWeek != null
          ? `${DAY_NAMES[session.dayOfWeek]}s`
          : "Weekly"
    const time = session.startTime ? ` ${formatTime12(session.startTime)}` : ""
    const range =
      session.startDate && session.endDate
        ? ` · ${format(new Date(session.startDate), "MMM d")} – ${format(new Date(session.endDate), "MMM d")}`
        : ""
    return `${day}${time}${range}`
  }
  return session.startAt ? format(new Date(session.startAt), "EEE MMM d, h:mm a") : "Date TBA"
}

/** The next occurrence used for marketplace sorting/filtering. */
export function trainingSortDate(session: {
  scheduleType: string
  startAt?: Date | string | null
  startDate?: Date | string | null
}): Date {
  const raw = session.scheduleType === "RECURRING" ? session.startDate : session.startAt
  return raw ? new Date(raw) : new Date(8640000000000000)
}

import { wallTimeToUtc } from "@/lib/calendar/timezone"

/**
 * Expand a trainer's availability windows into bookable 1-on-1 slots of
 * slotMinutes length (owner ruling: ONE generic "One-on-One Training"
 * program; parents book INTO it by picking a generated slot). Slots that
 * have started, don't fully fit the window, or collide with a confirmed
 * booking are dropped. Used by BOTH the public slots endpoint and the
 * booking endpoint (the server re-derives and checks membership — the
 * client can't invent off-grid times).
 */
export function generateOneOnOneSlots(opts: {
  windows: Array<{ date: Date | string; startTime: string; endTime: string }>
  slotMinutes: number
  bookedStartMillis: Set<number>
  from: Date
}): Date[] {
  const out: Date[] = []
  const step = Math.max(15, opts.slotMinutes)
  for (const w of opts.windows) {
    const d = new Date(w.date)
    const [sh, sm] = w.startTime.split(":").map(Number)
    const [eh, em] = w.endTime.split(":").map(Number)
    const startMin = sh * 60 + sm
    const endMin = eh * 60 + em
    for (let t = startMin; t + step <= endMin; t += step) {
      const startAt = wallTimeToUtc(
        d.getUTCFullYear(),
        d.getUTCMonth() + 1,
        d.getUTCDate(),
        Math.floor(t / 60),
        t % 60
      )
      if (startAt.getTime() < opts.from.getTime()) continue
      if (opts.bookedStartMillis.has(startAt.getTime())) continue
      out.push(startAt)
    }
  }
  return out.sort((a, b) => a.getTime() - b.getTime())
}
