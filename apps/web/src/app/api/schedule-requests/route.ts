import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getSessionUserId } from "@/lib/auth-helpers"
import { createScheduleRequest } from "@/lib/schedule-requests/requests"

export const dynamic = "force-dynamic"

const hhmm = z.string().regex(/^\d{2}:\d{2}$/, "HH:mm")
const base = {
  submissionId: z.string().min(1),
  reason: z.string().trim().min(3).max(500),
  dayOfWeek: z.number().int().min(0).max(6).optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
}
const createSchema = z
  .discriminatedUnion("kind", [
    z.object({
      kind: z.literal("WINDOW"),
      ...base,
      earliestStart: hhmm.optional(),
      latestStart: hhmm.optional(),
    }),
    z.object({
      kind: z.literal("BLACKOUT"),
      ...base,
      startTime: hhmm.optional(),
      endTime: hhmm.optional(),
    }),
  ])
  .refine((d) => (d.dayOfWeek !== undefined) !== (d.date !== undefined), {
    message: "Give either a weekday or a specific date, not both",
  })
  .refine((d) => d.kind !== "WINDOW" || d.earliestStart !== undefined || d.latestStart !== undefined, {
    message: "A window needs an earliest or latest start",
  })

/**
 * POST /api/schedule-requests — a club asks for a start-time window or a
 * blackout for their team (owner 2026-08-01). Gated per team by the league
 * (scheduleRequestsEnabled); pending until the league decides; best effort.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const parsed = createSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Invalid request" },
        { status: 400 }
      )
    }
    const d = parsed.data
    const result = await createScheduleRequest({
      userId: auth.userId,
      isPlatformAdmin: auth.isPlatformAdmin,
      submissionId: d.submissionId,
      kind: d.kind,
      dayOfWeek: d.dayOfWeek,
      date: d.date,
      earliestStart: d.kind === "WINDOW" ? d.earliestStart : undefined,
      latestStart: d.kind === "WINDOW" ? d.latestStart : undefined,
      startTime: d.kind === "BLACKOUT" ? d.startTime : undefined,
      endTime: d.kind === "BLACKOUT" ? d.endTime : undefined,
      reason: d.reason,
    })
    if (!result.ok) {
      return NextResponse.json({ error: result.error, code: result.code }, { status: result.status })
    }
    return NextResponse.json({ success: true, requestId: result.requestId }, { status: 201 })
  } catch (error) {
    console.error("Create schedule request error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
