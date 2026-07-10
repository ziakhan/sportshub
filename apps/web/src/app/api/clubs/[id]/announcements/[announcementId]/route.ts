import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { getSessionUserId } from "@/lib/auth-helpers"

export const dynamic = "force-dynamic"

async function authz(userId: string, tenantId: string, announcementId: string) {
  const role = await prisma.userRole.findFirst({
    where: {
      userId,
      OR: [
        { tenantId, role: { in: ["ClubOwner", "ClubManager", "Staff"] } },
        { role: "PlatformAdmin" },
      ],
    },
  })
  if (!role) return false
  const a = await (prisma as any).announcement.findFirst({
    where: { id: announcementId, tenantId },
    select: { id: true, isPinned: true },
  })
  return a as { id: string; isPinned: boolean } | null | false
}

// Content edit — limits mirror the create schema in ../route.ts
const editSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(160).optional(),
  content: z.string().trim().min(1, "Content is required").max(4000).optional(),
})

/**
 * PATCH — two explicit shapes:
 *   { action: "togglePin" }  → flip the pin. A body-less PATCH (what the
 *                              original client sent) still toggles too, so
 *                              older callers keep working.
 *   { title?, content? }     → edit the announcement text (at least one).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; announcementId: string } }
) {
  const session = await getSessionUserId()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const a = await authz(session.userId, params.id, params.announcementId)
  if (!a) return NextResponse.json({ error: "Not found or not authorized" }, { status: 403 })

  const raw = await request.json().catch(() => null)
  const isEdit =
    raw !== null &&
    typeof raw === "object" &&
    raw.action === undefined &&
    (raw.title !== undefined || raw.content !== undefined)

  if (!isEdit) {
    if (raw !== null && typeof raw === "object" && raw.action !== undefined && raw.action !== "togglePin") {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 })
    }
    const updated = await (prisma as any).announcement.update({
      where: { id: params.announcementId },
      data: { isPinned: !a.isPinned },
    })
    return NextResponse.json({ announcement: updated })
  }

  const parsed = editSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message || "Invalid announcement" },
      { status: 400 }
    )
  }

  const updated = await (prisma as any).announcement.update({
    where: { id: params.announcementId },
    data: {
      ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
      ...(parsed.data.content !== undefined ? { content: parsed.data.content } : {}),
    },
  })
  return NextResponse.json({ announcement: updated })
}

/** DELETE — remove an announcement. */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string; announcementId: string } }
) {
  const session = await getSessionUserId()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const a = await authz(session.userId, params.id, params.announcementId)
  if (!a) return NextResponse.json({ error: "Not found or not authorized" }, { status: 403 })

  await (prisma as any).announcement.delete({ where: { id: params.announcementId } })
  return NextResponse.json({ ok: true })
}
