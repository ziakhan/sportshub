import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getSessionUserId } from "@/lib/auth-helpers"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"

/**
 * List user's notifications
 * GET /api/notifications?unread=true
 */
export async function GET(request: NextRequest) {
  const sessionInfo = await getSessionUserId()
  if (!sessionInfo) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const userId = sessionInfo.userId

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  })

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  const unreadOnly = request.nextUrl.searchParams.get("unread") === "true"

  const notifications = await prisma.notification.findMany({
    where: {
      userId: user.id,
      ...(unreadOnly ? { isRead: false } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  })

  const unreadCount = await prisma.notification.count({
    where: { userId: user.id, isRead: false },
  })

  return NextResponse.json({ notifications, unreadCount })
}

/**
 * Mark notifications as read
 * PATCH /api/notifications
 * Body: { ids: string[] } or { all: true }
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const userId = session.user.id

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const body = await request.json()

    if (body.all) {
      await prisma.notification.updateMany({
        where: { userId: user.id, isRead: false },
        data: { isRead: true },
      })
    } else if (Array.isArray(body.ids) && body.ids.length > 0) {
      await prisma.notification.updateMany({
        where: {
          id: { in: body.ids },
          userId: user.id,
        },
        data: { isRead: true },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Mark notifications error:", error)
    return NextResponse.json(
      { error: "Failed to update notifications" },
      { status: 500 }
    )
  }
}
