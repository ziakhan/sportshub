import { prisma } from "@youthbasketballhub/db"
import { notifyMany } from "@/lib/notifications"
import { sendEmail, appBaseUrl, escapeHtml, transactionalFooter } from "@/lib/email"

/**
 * Team schedule requests (owner 2026-08-01). A traveling team asks for an
 * early-Sunday / late-Saturday start window or a blackout date. The feature
 * is OFF per team until the league enables it; a request does NOTHING until
 * the league approves it; approved requests are honored best effort, never
 * guaranteed. Approved BLACKOUTs materialize SeasonTeamBlackout rows (the
 * scheduler's hard no-play store); approved WINDOWs are read directly.
 */

type Result<T> = ({ ok: true } & T) | { ok: false; error: string; code: string; status: number }

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

export function describeScheduleRequest(r: {
  kind: string
  dayOfWeek?: number | null
  date?: Date | string | null
  earliestStart?: string | null
  latestStart?: string | null
  startTime?: string | null
  endTime?: string | null
}): string {
  const day =
    r.dayOfWeek !== null && r.dayOfWeek !== undefined
      ? `every ${DAY_NAMES[r.dayOfWeek] ?? "day"}`
      : r.date
        ? new Date(r.date).toLocaleDateString("en-CA", {
            month: "short",
            day: "numeric",
            timeZone: "UTC",
          })
        : "any day"
  if (r.kind === "BLACKOUT") {
    const window = r.startTime && r.endTime ? ` ${r.startTime}–${r.endTime}` : ""
    return `No games ${day}${window}`
  }
  const parts: string[] = []
  if (r.earliestStart) parts.push(`no earlier than ${r.earliestStart}`)
  if (r.latestStart) parts.push(`no later than ${r.latestStart}`)
  return `Games ${day} start ${parts.join(", ")}`
}

const submissionInclude = {
  team: { select: { id: true, name: true, tenantId: true } },
  season: {
    select: {
      id: true,
      label: true,
      status: true,
      leagueId: true,
      league: { select: { name: true, ownerId: true } },
    },
  },
} as const

async function leagueDeciders(leagueId: string, ownerId: string): Promise<string[]> {
  const managers = await prisma.userRole.findMany({
    where: { leagueId, role: { in: ["LeagueOwner", "LeagueManager"] } },
    select: { userId: true },
    distinct: ["userId"],
  })
  return [...new Set([ownerId, ...managers.map((m) => m.userId)])].filter(Boolean) as string[]
}

async function isLeagueSide(userId: string, leagueId: string, ownerId: string): Promise<boolean> {
  if (userId === ownerId) return true
  const role = await prisma.userRole.findFirst({
    where: { userId, leagueId, role: { in: ["LeagueOwner", "LeagueManager"] as any } },
    select: { id: true },
  })
  return !!role
}

async function isClubSide(userId: string, tenantId: string): Promise<boolean> {
  const role = await prisma.userRole.findFirst({
    where: { userId, tenantId, role: { in: ["ClubOwner", "ClubManager", "Trainer"] as any } },
    select: { id: true },
  })
  return !!role
}

export async function createScheduleRequest(input: {
  userId: string
  isPlatformAdmin: boolean
  submissionId: string
  kind: "WINDOW" | "BLACKOUT"
  dayOfWeek?: number
  date?: string // YYYY-MM-DD
  earliestStart?: string
  latestStart?: string
  startTime?: string
  endTime?: string
  reason: string
}): Promise<Result<{ requestId: string }>> {
  const submission = await (prisma as any).teamSubmission.findUnique({
    where: { id: input.submissionId },
    include: submissionInclude,
  })
  if (!submission) return { ok: false, error: "Submission not found", code: "NOT_FOUND", status: 404 }

  const clubOk = await isClubSide(input.userId, submission.team.tenantId)
  if (!clubOk && !input.isPlatformAdmin) {
    return { ok: false, error: "Forbidden", code: "FORBIDDEN", status: 403 }
  }
  if (!submission.scheduleRequestsEnabled) {
    return {
      ok: false,
      error: "Schedule requests aren't enabled for this team — ask the league to turn them on",
      code: "NOT_ENABLED",
      status: 403,
    }
  }
  if (submission.status === "WITHDRAWN") {
    return { ok: false, error: "This team has withdrawn from the season", code: "SUBMISSION_WITHDRAWN", status: 409 }
  }
  if (submission.season.status === "COMPLETED") {
    return { ok: false, error: "This season is over", code: "SEASON_CLOSED", status: 409 }
  }

  const dup = await (prisma as any).teamScheduleRequest.findFirst({
    where: {
      submissionId: submission.id,
      kind: input.kind,
      status: { in: ["PENDING", "APPROVED"] },
      dayOfWeek: input.dayOfWeek ?? null,
      date: input.date ? new Date(`${input.date}T00:00:00.000Z`) : null,
    },
    select: { id: true },
  })
  if (dup) {
    return {
      ok: false,
      error: "A request for that day is already pending or approved",
      code: "DUPLICATE",
      status: 409,
    }
  }

  const created = await (prisma as any).teamScheduleRequest.create({
    data: {
      submissionId: submission.id,
      kind: input.kind,
      dayOfWeek: input.dayOfWeek ?? null,
      date: input.date ? new Date(`${input.date}T00:00:00.000Z`) : null,
      earliestStart: input.earliestStart ?? null,
      latestStart: input.latestStart ?? null,
      startTime: input.startTime ?? null,
      endTime: input.endTime ?? null,
      reason: input.reason,
      requestedById: input.userId,
    },
  })

  const deciders = await leagueDeciders(submission.season.leagueId, submission.season.league.ownerId)
  await notifyMany(prisma, deciders, {
    type: "schedule_request_submitted",
    title: "Schedule request",
    message: `${submission.team.name} asks: ${describeScheduleRequest(created)}. Reason: ${input.reason}`,
    link: `/manage/leagues/${submission.season.leagueId}/seasons/${submission.season.id}/teams/${submission.id}`,
    referenceId: created.id,
    referenceType: "TeamScheduleRequest",
  })
  return { ok: true, requestId: created.id }
}

export async function decideScheduleRequest(input: {
  requestId: string
  userId: string
  isPlatformAdmin: boolean
  action: "approve" | "decline" | "cancel"
  note?: string
}): Promise<Result<{ status: string; blackoutDates?: number }>> {
  const req = await (prisma as any).teamScheduleRequest.findUnique({
    where: { id: input.requestId },
    include: { submission: { include: submissionInclude } },
  })
  if (!req) return { ok: false, error: "Request not found", code: "NOT_FOUND", status: 404 }
  if (req.status !== "PENDING") {
    return {
      ok: false,
      error: `This request is already ${req.status.toLowerCase()}`,
      code: "ALREADY_DECIDED",
      status: 409,
    }
  }
  const sub = req.submission

  if (input.action === "cancel") {
    if (req.requestedById !== input.userId && !input.isPlatformAdmin) {
      return { ok: false, error: "Only the requester can cancel", code: "FORBIDDEN", status: 403 }
    }
    await (prisma as any).teamScheduleRequest.update({
      where: { id: req.id },
      data: { status: "CANCELLED", decidedAt: new Date(), decisionNote: input.note ?? null },
    })
    return { ok: true, status: "CANCELLED" }
  }

  const leagueOk = await isLeagueSide(input.userId, sub.season.leagueId, sub.season.league.ownerId)
  if (!leagueOk && !input.isPlatformAdmin) {
    return { ok: false, error: "Forbidden", code: "FORBIDDEN", status: 403 }
  }

  let blackoutDates = 0
  if (input.action === "approve") {
    await (prisma as any).$transaction(async (tx: any) => {
      await tx.teamScheduleRequest.update({
        where: { id: req.id },
        data: {
          status: "APPROVED",
          decidedById: input.userId,
          decidedAt: new Date(),
          decisionNote: input.note ?? null,
        },
      })
      if (req.kind === "BLACKOUT") {
        blackoutDates = await materializeBlackout(tx, req)
      }
    })
  } else {
    await (prisma as any).teamScheduleRequest.update({
      where: { id: req.id },
      data: {
        status: "DECLINED",
        decidedById: input.userId,
        decidedAt: new Date(),
        decisionNote: input.note ?? null,
      },
    })
  }

  // Tell the club — bell + email (email failures never block the decision).
  const clubManagers = await prisma.userRole.findMany({
    where: { tenantId: sub.team.tenantId, role: { in: ["ClubOwner", "ClubManager"] } },
    select: { userId: true },
    distinct: ["userId"],
  })
  const recipients = [...new Set([req.requestedById, ...clubManagers.map((m) => m.userId)])]
  const verdict = input.action === "approve" ? "approved" : "declined"
  const what = describeScheduleRequest(req)
  await notifyMany(prisma, recipients, {
    type: "schedule_request_decided",
    title: `Schedule request ${verdict}`,
    message: `${sub.season.league.name} ${sub.season.label}: "${what}" was ${verdict}${input.note ? ` — ${input.note}` : ""}. Approved requests are best effort, never guaranteed.`,
    link: `/clubs/${sub.team.tenantId}/teams/${sub.team.id}/schedule-requests`,
    referenceId: req.id,
    referenceType: "TeamScheduleRequest",
  })
  try {
    const users = await prisma.user.findMany({
      where: { id: { in: recipients } },
      select: { email: true },
    })
    const link = `${appBaseUrl()}/clubs/${sub.team.tenantId}/teams/${sub.team.id}/schedule-requests`
    for (const u of users) {
      if (!u.email) continue
      await sendEmail({
        to: u.email,
        subject: `Schedule request ${verdict} — ${sub.team.name} · ${sub.season.league.name} ${sub.season.label}`,
        html: `<h2>Schedule request ${verdict}</h2><p><strong>${escapeHtml(sub.team.name)}</strong>: ${escapeHtml(what)}.</p>${
          input.note ? `<p>Note from the league: ${escapeHtml(input.note)}</p>` : ""
        }${
          input.action === "approve"
            ? "<p>Approved requests are honored on a best-effort basis when the league next generates its schedule — never guaranteed.</p>"
            : ""
        }<p><a href="${link}">View your requests</a></p>${transactionalFooter()}`,
        text: `${sub.team.name}: "${what}" was ${verdict}.${input.note ? ` Note: ${input.note}` : ""} Best effort, never guaranteed. ${link}`,
      })
    }
  } catch (e) {
    console.error("schedule-request decision email failed:", e)
  }

  return { ok: true, status: verdict.toUpperCase(), blackoutDates: blackoutDates || undefined }
}

/**
 * Approved BLACKOUT → SeasonTeamBlackout rows. Single date → one row;
 * recurring weekday → one per matching session day, deduped against
 * existing blackout dates for the submission. Returns rows created.
 */
async function materializeBlackout(tx: any, req: any): Promise<number> {
  const dates: Date[] = []
  if (req.date) {
    dates.push(new Date(req.date))
  } else if (req.dayOfWeek !== null && req.dayOfWeek !== undefined) {
    const days = await tx.seasonSessionDay.findMany({
      where: { session: { seasonId: req.submission.season.id } },
      select: { date: true },
    })
    for (const d of days) {
      const day = new Date(d.date)
      if (day.getUTCDay() === req.dayOfWeek) dates.push(day)
    }
  }
  if (dates.length === 0) return 0
  const existing = await tx.seasonTeamBlackout.findMany({
    where: { teamSubmissionId: req.submissionId },
    select: { date: true },
  })
  const seen = new Set(existing.map((b: any) => new Date(b.date).toISOString().slice(0, 10)))
  const fresh = dates.filter((d) => !seen.has(d.toISOString().slice(0, 10)))
  for (const d of fresh) {
    await tx.seasonTeamBlackout.create({
      data: {
        teamSubmissionId: req.submissionId,
        date: d,
        startTime: req.startTime ?? null,
        endTime: req.endTime ?? null,
        reason: req.reason,
        sourceRequestId: req.id,
      },
    })
  }
  return fresh.length
}

/**
 * Withdrawal cascades call this so a withdrawn team's pending requests don't
 * sit in the league's queue forever.
 */
export async function cancelPendingScheduleRequestsForSubmission(
  tx: any,
  submissionId: string,
  note: string
): Promise<number> {
  const res = await tx.teamScheduleRequest.updateMany({
    where: { submissionId, status: "PENDING" },
    data: { status: "CANCELLED", decidedAt: new Date(), decisionNote: note },
  })
  return res.count ?? 0
}
