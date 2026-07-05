import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import bcrypt from "bcryptjs"

export const dynamic = "force-dynamic"

/**
 * The referee's scoresheet sign-off PIN — set in their own account, entered
 * at the scorer's table to approve a final score (docs/live-scoring-design.md).
 * POST { pin, currentPin? } — set or change (currentPin required to change).
 * GET — { hasPin } so settings UIs know which form to show.
 */

const setSchema = z.object({
  pin: z.string().min(4).max(32),
  currentPin: z.string().optional(),
})

async function refereeProfile(userId: string) {
  return (prisma as any).refereeProfile.findUnique({ where: { userId } })
}

export async function GET() {
  const sessionInfo = await getSessionUserId()
  if (!sessionInfo) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const profile = await refereeProfile(sessionInfo.userId)
  if (!profile) return NextResponse.json({ error: "No referee profile" }, { status: 404 })
  return NextResponse.json({ hasPin: !!profile.signoffPinHash })
}

export async function POST(request: NextRequest) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const profile = await refereeProfile(sessionInfo.userId)
    if (!profile) {
      return NextResponse.json(
        { error: "Only referees can set a sign-off PIN" },
        { status: 403 }
      )
    }

    const { pin, currentPin } = setSchema.parse(await request.json())
    if (profile.signoffPinHash) {
      if (!currentPin || !(await bcrypt.compare(currentPin, profile.signoffPinHash))) {
        return NextResponse.json(
          { error: "Current PIN is incorrect", code: "BAD_CURRENT_PIN" },
          { status: 400 }
        )
      }
    }

    await (prisma as any).refereeProfile.update({
      where: { userId: sessionInfo.userId },
      data: { signoffPinHash: await bcrypt.hash(pin, 12) },
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "PIN must be 4–32 characters" }, { status: 400 })
    }
    console.error("Set signoff PIN error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
