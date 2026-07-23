import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { normalizeHandle, validateHandle } from "@/lib/handles"

export const dynamic = "force-dynamic"

/**
 * GET/PATCH /api/account/handle — every account owns a handle (owner
 * 2026-07-23: reserved at signup with a generated default, changeable here).
 * First come, first served; same validation/reserved list as player handles.
 */
export async function GET() {
  const session = await getSessionUserId()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { handle: true },
  })
  return NextResponse.json({ handle: user?.handle ?? null })
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getSessionUserId()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json()
    const handle = normalizeHandle(String(body.handle ?? ""))
    const invalid = validateHandle(handle)
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 })

    const taken = await prisma.user.findFirst({
      where: { handle, NOT: { id: session.userId } },
      select: { id: true },
    })
    if (taken) return NextResponse.json({ error: "That handle is taken" }, { status: 409 })

    await prisma.user.update({ where: { id: session.userId }, data: { handle } })
    return NextResponse.json({ success: true, handle })
  } catch (error) {
    console.error("Account handle error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
