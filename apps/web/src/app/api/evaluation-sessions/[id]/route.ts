import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@youthbasketballhub/db"
import { getSessionUserId } from "@/lib/auth-helpers"
import { isClubAdmin, isClubStaff } from "@/lib/authz/team-scope"
import { hasFeature } from "@/lib/entitlements"
import { loadSession, sessionRoster } from "@/lib/evaluation/session"

export const dynamic = "force-dynamic"

/**
 * One evaluation session, and the director's controls over it.
 *
 * Opened and closed EXPLICITLY rather than derived from the clock (owner
 * 2026-08-21): a derived window is a timezone bug, and tryouts run late.
 * CLOSED freezes the report, which is what makes it defensible to a parent
 * who asks why their kid was cut.
 */

const patchSchema = z.object({
  status: z.enum(["DRAFT", "OPEN", "CLOSED"]).optional(),
  visibility: z.enum(["PRIVATE", "AGGREGATE", "OPEN"]).optional(),
})

/** GET — everything the capture screen needs in one call. */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await getSessionUserId()
  if (!auth?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const session = await loadSession(params.id)
  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Participation is deliberately NOT narrowed to the coaches of that team or
  // age group (owner 2026-08-21): coaches work across groups and turn up for
  // each other's tryouts. Any club staff may score.
  if (!(await isClubStaff(auth.userId, session.tenantId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  if (!(await hasFeature(session.tenantId, "evaluations"))) {
    return NextResponse.json({ error: "Not enabled for this club" }, { status: 402 })
  }

  const mine = await (prisma as any).evaluationRating.findMany({
    where: { sessionId: session.id, evaluatorId: auth.userId },
    select: { poolMemberId: true, categoryId: true, score: true },
  })

  return NextResponse.json({
    session: {
      id: session.id,
      title: session.event.title,
      status: session.status,
      visibility: session.visibility,
      seasonLabel: session.seasonLabel,
    },
    categories: session.template.categories.map((c: any) => ({
      id: c.id,
      key: c.key,
      label: c.label,
      hint: c.hint,
      anchors: c.anchors,
      weight: c.weight,
    })),
    measurables: session.template.measurables.map((m: any) => ({
      id: m.id,
      key: m.key,
      label: m.label,
      unit: m.unit,
    })),
    roster: await sessionRoster(session),
    myRatings: mine,
    isAdmin: await isClubAdmin(auth.userId, session.tenantId),
  })
}

/** PATCH — open, close, or change who can see what. Club admins only. */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await getSessionUserId()
  if (!auth?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const session = await loadSession(params.id)
  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (!(await isClubAdmin(auth.userId, session.tenantId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const parsed = patchSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 })

  const data: Record<string, unknown> = {}
  if (parsed.data.visibility) data.visibility = parsed.data.visibility
  if (parsed.data.status) {
    data.status = parsed.data.status
    if (parsed.data.status === "OPEN") data.openedAt = new Date()
    if (parsed.data.status === "CLOSED") data.closedAt = new Date()
  }

  const updated = await (prisma as any).evaluationSession.update({
    where: { id: session.id },
    data,
    select: { id: true, status: true, visibility: true },
  })
  return NextResponse.json({ session: updated })
}
