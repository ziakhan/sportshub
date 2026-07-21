import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { getSessionUserId } from "@/lib/auth-helpers"

export const dynamic = "force-dynamic"

// Session-authenticated signing, used mid-flow (offer acceptance, camp /
// house-league / tryout registration). Unlike the tokenized /api/waivers/sign,
// the caller is the logged-in parent; authorization is the parent-child link.
const signInlineSchema = z.object({
  waiverId: z.string().min(1),
  playerId: z.string().min(1),
  signerName: z.string().trim().min(2).max(120),
  relationship: z.string().trim().min(2).max(60).optional(),
  // Same shape/limit as the referee scoresheet signature
  signatureData: z
    .string()
    .regex(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/)
    .max(400_000),
})

/** POST /api/waivers/sign-inline — parent signs a club waiver for their child. */
export async function POST(request: NextRequest) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const parsed = signInlineSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Invalid input" },
        { status: 400 }
      )
    }

    const player = await prisma.player.findFirst({
      where: { id: parsed.data.playerId, parentId: sessionInfo.userId, deletedAt: null },
      select: { id: true },
    })
    if (!player) {
      return NextResponse.json(
        { error: "Only the player's parent or guardian can sign" },
        { status: 403 }
      )
    }

    const waiver = await (prisma as any).waiverDocument.findFirst({
      where: { id: parsed.data.waiverId, active: true },
      select: { id: true, body: true, version: true, annualRenewal: true },
    })
    if (!waiver) {
      return NextResponse.json({ error: "Waiver not found" }, { status: 404 })
    }

    // Idempotent: a valid current-version signature short-circuits (double
    // taps, two flows racing over the same document).
    const existing = await (prisma as any).waiverSignature.findFirst({
      where: {
        waiverId: waiver.id,
        playerId: player.id,
        waiverVersion: waiver.version,
        OR: [{ validUntil: null }, { validUntil: { gt: new Date() } }],
      },
      select: { id: true },
    })
    if (existing) {
      return NextResponse.json({ success: true, alreadySigned: true })
    }

    const forwarded = request.headers.get("x-forwarded-for")
    const signature = await (prisma as any).waiverSignature.create({
      data: {
        waiverId: waiver.id,
        playerId: player.id,
        waiverVersion: waiver.version,
        bodySnapshot: waiver.body,
        signerUserId: sessionInfo.userId,
        signerName: parsed.data.signerName,
        relationship: parsed.data.relationship ?? "Parent/Guardian",
        signatureData: parsed.data.signatureData,
        ipAddress: forwarded?.split(",")[0]?.trim() || null,
        validUntil: waiver.annualRenewal
          ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
          : null,
      },
      select: { id: true, signedAt: true },
    })
    return NextResponse.json({
      success: true,
      signatureId: signature.id,
      signedAt: signature.signedAt,
    })
  } catch (error) {
    console.error("Inline waiver sign error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
