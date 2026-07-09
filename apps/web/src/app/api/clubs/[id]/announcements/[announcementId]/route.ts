import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
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

/** PATCH — toggle pin. */
export async function PATCH(
  _request: NextRequest,
  { params }: { params: { id: string; announcementId: string } }
) {
  const session = await getSessionUserId()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const a = await authz(session.userId, params.id, params.announcementId)
  if (!a) return NextResponse.json({ error: "Not found or not authorized" }, { status: 403 })

  const updated = await (prisma as any).announcement.update({
    where: { id: params.announcementId },
    data: { isPinned: !a.isPinned },
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
