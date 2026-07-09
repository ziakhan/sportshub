import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { getSessionUserId } from "@/lib/auth-helpers"

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
    return NextResponse.json({ announcement })
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json({ error: error.errors[0]?.message || "Invalid" }, { status: 400 })
    console.error("Create announcement error:", error)
    return NextResponse.json({ error: "Failed to create announcement" }, { status: 500 })
  }
}
