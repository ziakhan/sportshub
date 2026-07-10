import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { getSessionUserId } from "@/lib/auth-helpers"
import { notifyMany } from "@/lib/notifications"

export const dynamic = "force-dynamic"

async function canManage(userId: string, tenantId: string) {
  const role = await prisma.userRole.findFirst({
    where: {
      userId,
      OR: [
        { tenantId, role: { in: ["ClubOwner", "ClubManager", "Staff"] } },
        { role: "PlatformAdmin" },
      ],
    },
  })
  return !!role
}

/** GET — list this club's announcements (for the editor). */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionUserId()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!(await canManage(session.userId, params.id)))
    return NextResponse.json({ error: "Not authorized" }, { status: 403 })

  const announcements = await (prisma as any).announcement.findMany({
    where: { tenantId: params.id, teamId: null },
    orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
    take: 50,
  })
  return NextResponse.json({ announcements })
}

const createSchema = z.object({
  title: z.string().min(1).max(160),
  content: z.string().min(1).max(4000),
  isPinned: z.boolean().optional(),
})

/** POST — publish a public club announcement. */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSessionUserId()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!(await canManage(session.userId, params.id)))
      return NextResponse.json({ error: "Not authorized" }, { status: 403 })

    const data = createSchema.parse(await request.json())
    const announcement = await (prisma as any).announcement.create({
      data: {
        tenantId: params.id,
        authorId: session.userId,
        title: data.title,
        content: data.content,
        isPinned: data.isPinned ?? false,
        isPublic: true, // club-page announcements are public
      },
    })

    // Bell fanout to everyone engaged with the club: role-holders at the
    // tenant + parents with a rostered player on any of its teams (same
    // audience cascade as game changes). No email — blasts arrive with the
    // phase-3 composer + consent. Best-effort: publishing never fails on it.
    try {
      const [tenant, roleHolders, rosterSpots] = await Promise.all([
        prisma.tenant.findUnique({
          where: { id: params.id },
          select: { name: true, slug: true },
        }),
        prisma.userRole.findMany({
          where: { tenantId: params.id },
          select: { userId: true },
        }),
        (prisma as any).teamPlayer.findMany({
          where: {
            team: { tenantId: params.id },
            status: "ACTIVE",
            player: { deletedAt: null },
          },
          select: { player: { select: { parentId: true } } },
        }),
      ])
      const audience = new Set<string>()
      for (const r of roleHolders) audience.add(r.userId)
      for (const tp of rosterSpots as Array<{ player: { parentId: string | null } | null }>) {
        if (tp.player?.parentId) audience.add(tp.player.parentId)
      }
      audience.delete(session.userId) // the author doesn't need their own bell
      if (tenant && audience.size > 0) {
        await notifyMany(prisma, [...audience], {
          type: "announcement_posted",
          title: `${tenant.name}: ${data.title}`,
          message: data.content.length > 160 ? `${data.content.slice(0, 157)}…` : data.content,
          link: `/club/${tenant.slug}`,
          referenceId: announcement.id,
          referenceType: "Announcement",
        })
      }
    } catch (notifyError) {
      console.error("Announcement bell fanout failed:", notifyError)
    }

    return NextResponse.json({ announcement })
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json({ error: error.errors[0]?.message || "Invalid" }, { status: 400 })
    console.error("Create announcement error:", error)
    return NextResponse.json({ error: "Failed to create announcement" }, { status: 500 })
  }
}
