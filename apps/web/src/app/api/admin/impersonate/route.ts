import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { cookies } from "next/headers"

const IMPERSONATE_COOKIE = "admin-impersonate-uid"

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return null
  const role = await prisma.userRole.findFirst({
    where: { userId: session.user.id, role: "PlatformAdmin" },
  })
  return role ? session.user.id : null
}

/**
 * POST /api/admin/impersonate — Start impersonating a user
 */
export async function POST(request: NextRequest) {
  const adminId = await requireAdmin()
  if (!adminId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { userId } = await request.json()
  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 })
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, firstName: true, lastName: true },
  })
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  // Set impersonation cookie
  cookies().set(IMPERSONATE_COOKIE, userId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60, // 1 hour
  })

  return NextResponse.json({
    success: true,
    message: `Now impersonating ${user.firstName} ${user.lastName} (${user.email})`,
  })
}

/**
 * DELETE /api/admin/impersonate — Stop impersonating
 */
export async function DELETE() {
  const adminId = await requireAdmin()
  if (!adminId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  cookies().delete(IMPERSONATE_COOKIE)

  return NextResponse.json({ success: true, message: "Impersonation ended" })
}
