import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { getSessionUserId } from "@/lib/auth-helpers"
import { getChatMembership } from "@/lib/teams/chat-access"
import {
  formatPracticeDate,
  notifyTeam,
  practiceSelect,
  serializePractice,
} from "@/lib/teams/practices"

export const dynamic = "force-dynamic"

const patchSchema = z.union([
  z.object({ action: z.literal("move"), scheduledAt: z.string().datetime() }),
  z.object({ action: z.literal("cancel") }),
  z.object({ action: z.literal("restore") }),
])

/**
 * PATCH /api/teams/[id]/practices/[practiceId] — staff move/cancel/restore
 * one occurrence. Every change notifies the whole team (bell + email) —
 * "coach moves a practice, everyone knows" is the point of the feature.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; practiceId: string } }
) {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const membership = await getChatMembership(params.id, auth.userId, auth.isPlatformAdmin)
    if (!membership || membership.role === "family") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const parsed = patchSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 })
    }

    const practice = await (prisma as any).practice.findFirst({
      where: { id: params.practiceId, teamId: params.id },
      select: { id: true, scheduledAt: true, status: true, location: true },
    })
    if (!practice) return NextResponse.json({ error: "Practice not found" }, { status: 404 })

    const oldWhen = formatPracticeDate(new Date(practice.scheduledAt))
    let data: any
    let change: { title: string; message: string; subject: string; html: string } | null = null
    const calendarLink = `${process.env.NEXTAUTH_URL || ""}/teams/${membership.teamId}/calendar`

    if (parsed.data.action === "move") {
      const newDate = new Date(parsed.data.scheduledAt)
      const newWhen = formatPracticeDate(newDate)
      data = { scheduledAt: newDate, status: "SCHEDULED" }
      change = {
        title: `Practice moved — ${membership.teamName}`,
        message: `${oldWhen} → ${newWhen}`,
        subject: `Practice moved — ${membership.teamName}: now ${newWhen}`,
        html: `<p>A <strong>${membership.teamName}</strong> practice moved:</p><p><s>${oldWhen}</s> → <strong>${newWhen}</strong>${practice.location ? ` at ${practice.location}` : ""}</p><p><a href="${calendarLink}">Team calendar</a> (subscribed phone calendars update automatically)</p>`,
      }
    } else if (parsed.data.action === "cancel") {
      data = { status: "CANCELLED" }
      change = {
        title: `Practice cancelled — ${membership.teamName}`,
        message: oldWhen,
        subject: `Practice cancelled — ${membership.teamName}: ${oldWhen}`,
        html: `<p>The <strong>${membership.teamName}</strong> practice on <strong>${oldWhen}</strong> is cancelled.</p><p><a href="${calendarLink}">Team calendar</a></p>`,
      }
    } else {
      data = { status: "SCHEDULED" }
      change = {
        title: `Practice back on — ${membership.teamName}`,
        message: oldWhen,
        subject: `Practice back on — ${membership.teamName}: ${oldWhen}`,
        html: `<p>The <strong>${membership.teamName}</strong> practice on <strong>${oldWhen}</strong> is back on.</p><p><a href="${calendarLink}">Team calendar</a></p>`,
      }
    }

    const updated = await (prisma as any).practice.update({
      where: { id: params.practiceId },
      data,
      select: practiceSelect,
    })

    await notifyTeam({
      teamId: membership.teamId,
      tenantId: membership.tenantId,
      excludeUserId: auth.userId,
      type: "practice_change",
      title: change.title,
      message: change.message,
      link: `/teams/${membership.teamId}/calendar`,
      referenceId: membership.teamId,
      emailSubject: change.subject,
      emailHtml: change.html,
    })

    return NextResponse.json({ practice: serializePractice(updated) })
  } catch (error) {
    console.error("Practice update error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
