import { prisma } from "@youthbasketballhub/db"
import { sendEmail } from "@/lib/email"
import { notifyMany, type NotificationType } from "@/lib/notifications"
import { getChatMembers } from "@/lib/teams/chat-access"
import { dateInTz, wallTimeToUtc } from "@/lib/calendar/timezone"

/**
 * Practice scheduling (docs/engagement-features-plan.md → practices).
 * Recurring PracticeSlots ("Tue 18:30, 90 min") expand into dated Practice
 * occurrences on announce; single occurrences can then be moved/cancelled,
 * which notifies the whole team (bell + email — no per-user preference
 * system exists yet, so email goes to every member).
 */

export interface SlotInput {
  dayOfWeek: number
  startTime: string // "18:30"
  durationMinutes: number
  location?: string | null
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

export function formatSlotTime(startTime: string): string {
  const [h, m] = startTime.split(":").map(Number)
  const suffix = h >= 12 ? "PM" : "AM"
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return `${hour12}:${String(m).padStart(2, "0")} ${suffix}`
}

/** "Tuesdays 6:30 PM · Thursdays 6:00 PM" */
export function formatSlotSummary(
  slots: Array<{ dayOfWeek: number; startTime: string }>
): string {
  return [...slots]
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime))
    .map((s) => `${DAY_NAMES[s.dayOfWeek]}s ${formatSlotTime(s.startTime)}`)
    .join(" · ")
}

/**
 * Expand slots into UTC occurrence times over [from, from + weeks*7d).
 * Wall times resolve per-date in the app timezone (DST-safe).
 */
export function generateOccurrences(
  slots: Array<SlotInput & { id?: string }>,
  weeks: number,
  from: Date
): Array<{ slotId?: string; scheduledAt: Date; durationMinutes: number; location?: string | null }> {
  const out: Array<{
    slotId?: string
    scheduledAt: Date
    durationMinutes: number
    location?: string | null
  }> = []
  const totalDays = weeks * 7
  for (let i = 0; i < totalDays; i++) {
    const day = new Date(from.getTime() + i * 86_400_000)
    const local = dateInTz(day)
    for (const slot of slots) {
      if (slot.dayOfWeek !== local.dayOfWeek) continue
      const [hour, minute] = slot.startTime.split(":").map(Number)
      const scheduledAt = wallTimeToUtc(local.year, local.month, local.day, hour, minute)
      if (scheduledAt.getTime() < from.getTime()) continue
      out.push({
        slotId: slot.id,
        scheduledAt,
        durationMinutes: slot.durationMinutes,
        location: slot.location ?? null,
      })
    }
  }
  return out.sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime())
}

/**
 * Bell + email the whole team. Email failures never fail the request
 * (Mailpit locally; best-effort in prod).
 */
export async function notifyTeam(opts: {
  teamId: string
  tenantId: string
  excludeUserId?: string
  type: NotificationType
  title: string
  message: string
  link: string
  referenceId: string
  emailSubject: string
  emailHtml: string
}): Promise<number> {
  const members = await getChatMembers(opts.teamId, opts.tenantId)
  const userIds = members.userIds.filter((id) => id !== opts.excludeUserId)
  if (userIds.length === 0) return 0

  await notifyMany(prisma, userIds, {
    type: opts.type,
    title: opts.title,
    message: opts.message,
    link: opts.link,
    referenceId: opts.referenceId,
    referenceType: "Team",
  })

  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { email: true },
  })
  await Promise.allSettled(
    users.map((u: { email: string }) =>
      sendEmail({ to: u.email, subject: opts.emailSubject, html: opts.emailHtml })
    )
  )
  return userIds.length
}

export const practiceSelect = {
  id: true,
  scheduledAt: true,
  duration: true,
  location: true,
  notes: true,
  status: true,
  updatedAt: true,
  venue: { select: { name: true } },
}

export function serializePractice(p: any) {
  return {
    id: p.id,
    scheduledAt: p.scheduledAt,
    durationMinutes: p.duration,
    location: p.venue?.name ?? p.location ?? null,
    notes: p.notes,
    status: p.status,
    updatedAt: p.updatedAt,
  }
}

export function formatPracticeDate(date: Date): string {
  return date.toLocaleString("en-CA", {
    timeZone: process.env.APP_TIMEZONE || "America/Toronto",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}
