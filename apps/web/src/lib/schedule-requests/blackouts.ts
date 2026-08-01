import { prisma } from "@youthbasketballhub/db"

/**
 * League-direct blackout CRUD (owner 2026-08-01): the league can mark a
 * team's no-play dates without any request — approved blackout REQUESTS
 * also land here (with sourceRequestId set), via requests.ts.
 */

type Result<T> = ({ ok: true } & T) | { ok: false; error: string; code: string; status: number }

export async function addDirectBlackout(input: {
  submissionId: string
  date: string // YYYY-MM-DD
  startTime?: string
  endTime?: string
  reason?: string
}): Promise<Result<{ blackoutId: string }>> {
  const date = new Date(`${input.date}T00:00:00.000Z`)
  if (isNaN(date.getTime())) {
    return { ok: false, error: "Invalid date", code: "BAD_INPUT", status: 400 }
  }
  const dup = await (prisma as any).seasonTeamBlackout.findFirst({
    where: { teamSubmissionId: input.submissionId, date },
    select: { id: true },
  })
  if (dup) {
    return { ok: false, error: "That date is already blacked out", code: "DUPLICATE", status: 409 }
  }
  const created = await (prisma as any).seasonTeamBlackout.create({
    data: {
      teamSubmissionId: input.submissionId,
      date,
      startTime: input.startTime ?? null,
      endTime: input.endTime ?? null,
      reason: input.reason ?? null,
    },
  })
  return { ok: true, blackoutId: created.id }
}

export async function removeBlackout(input: {
  submissionId: string
  blackoutId: string
}): Promise<Result<{ removed: true }>> {
  const row = await (prisma as any).seasonTeamBlackout.findUnique({
    where: { id: input.blackoutId },
    select: { id: true, teamSubmissionId: true },
  })
  if (!row || row.teamSubmissionId !== input.submissionId) {
    return { ok: false, error: "Blackout not found", code: "NOT_FOUND", status: 404 }
  }
  await (prisma as any).seasonTeamBlackout.delete({ where: { id: row.id } })
  return { ok: true, removed: true }
}
