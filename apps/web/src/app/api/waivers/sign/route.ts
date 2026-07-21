import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { getSessionUserId } from "@/lib/auth-helpers"
import { consumeSignRequest, getSignRequestByToken } from "@/lib/waivers/tokens"

export const dynamic = "force-dynamic"

// PUBLIC route (middleware allowlist): the token IS the auth. Same posture as
// score-invites — anyone holding the emailed link may sign, because the link
// only ever goes to the parent email on file.
const signSchema = z.object({
  token: z.string().min(10).max(200),
  signerName: z.string().trim().min(2).max(120),
  relationship: z.string().trim().min(2).max(60).optional(),
  // Same shape/limit as the referee scoresheet signature (finalize route)
  signatureData: z
    .string()
    .regex(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/)
    .max(400_000),
})

/** POST /api/waivers/sign — record an e-signature for a tokenized request. */
export async function POST(request: NextRequest) {
  try {
    const parsed = signSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Invalid input" },
        { status: 400 }
      )
    }

    const lookup = await getSignRequestByToken(parsed.data.token)
    if (!lookup) {
      return NextResponse.json(
        { error: "This signing link is invalid or has expired. Ask the organization to send a new one." },
        { status: 404 }
      )
    }

    if (lookup.alreadySigned) {
      // Someone else in the family finished first — fulfil the request quietly.
      await consumeSignRequest(lookup.request.id)
      return NextResponse.json({ success: true, alreadySigned: true })
    }

    // Atomic consume beats double-submits (two tabs, retry taps): only the
    // first POST creates a signature.
    if (!(await consumeSignRequest(lookup.request.id))) {
      return NextResponse.json({ success: true, alreadySigned: true })
    }

    // Optional: attach the signer's account when they happen to be logged in.
    let signerUserId: string | null = null
    try {
      const sessionInfo = await getSessionUserId()
      signerUserId = sessionInfo?.userId ?? null
    } catch {
      signerUserId = null
    }

    const forwarded = request.headers.get("x-forwarded-for")
    const ipAddress = forwarded?.split(",")[0]?.trim() || null

    const signature = await (prisma as any).waiverSignature.create({
      data: {
        waiverId: lookup.waiver.id,
        playerId: lookup.player.id,
        seasonId: lookup.request.seasonId,
        waiverVersion: lookup.waiver.version,
        bodySnapshot: lookup.waiver.body,
        signerUserId,
        signerName: parsed.data.signerName,
        relationship: parsed.data.relationship ?? "Parent/Guardian",
        signatureData: parsed.data.signatureData,
        ipAddress,
        // Rowan's Law-style annual renewal window
        validUntil: lookup.waiver.annualRenewal
          ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
          : null,
      },
      select: { id: true, signedAt: true },
    })

    return NextResponse.json({ success: true, signatureId: signature.id, signedAt: signature.signedAt })
  } catch (error) {
    console.error("Waiver sign error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
