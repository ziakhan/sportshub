import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getSessionUserId } from "@/lib/auth-helpers"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"

export const dynamic = "force-dynamic"

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
    return NextResponse.json({ error: "Failed to update notifications" }, { status: 500 })
  }
}

/**
 * Dismiss (delete) notifications — they used to accumulate forever.
 * DELETE /api/notifications
 * Body: { ids: string[] } — delete these, read or not (an explicit dismiss)
 *       { all: true }     — clear READ notifications only; unread ones stay
 *                           until the user has seen them or ids them directly
 * Always scoped to the session user (getSessionUserId so impersonation
 * operates on the inbox actually being viewed).
 */
export async function DELETE(request: NextRequest) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const userId = sessionInfo.userId

    const body = await request.json()

    let deleted = 0
    if (body.all) {
      const result = await prisma.notification.deleteMany({
        where: { userId, isRead: true },
      })
      deleted = result.count
    } else if (Array.isArray(body.ids) && body.ids.length > 0) {
      const result = await prisma.notification.deleteMany({
        where: { id: { in: body.ids }, userId },
      })
      deleted = result.count
    } else {
      return NextResponse.json({ error: "Provide ids or all" }, { status: 400 })
    }

    return NextResponse.json({ success: true, deleted })
  } catch (error) {
    console.error("Delete notifications error:", error)
    return NextResponse.json({ error: "Failed to delete notifications" }, { status: 500 })
  }
}
