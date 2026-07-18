import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import {
  getClaimOptions,
  startClaim,
  verifyClaimCode,
} from "@/lib/claims/claim-v2"

export const dynamic = "force-dynamic"

/**
 * Club claiming v2 — ANONYMOUS endpoints (owner 2026-07-18: claim-first,
 * account-at-end). Proof of control = the code lands at the club's contact
 * ON FILE, so no session is required to start; the account binds at
 * completion via /api/clubs/claim-complete.
 */

/** GET — the guided options: masked contact channels + claimability. */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const options = await getClaimOptions(params.id)
    if (!options) return NextResponse.json({ error: "Club not found" }, { status: 404 })
    return NextResponse.json(options)
  } catch (error) {
    console.error("Claim options error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

const correctionsSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    website: z.string().trim().max(300).optional(),
    contactEmail: z.string().trim().email().optional(),
    phoneNumber: z.string().trim().max(30).optional(),
    city: z.string().trim().max(120).optional(),
    description: z.string().trim().max(2000).optional(),
  })
  .optional()

const startSchema = z.discriminatedUnion("channel", [
  z.object({
    channel: z.literal("email"),
    claimantEmail: z.string().email().optional(),
    corrections: correctionsSchema,
    message: z.string().max(500).optional(),
  }),
  z.object({
    channel: z.literal("sms"),
    claimantEmail: z.string().email().optional(),
    corrections: correctionsSchema,
    message: z.string().max(500).optional(),
  }),
  z.object({
    channel: z.literal("proof"),
    claimantEmail: z.string().email(),
    proofNote: z.string().trim().min(10).max(2000),
    corrections: correctionsSchema,
    message: z.string().max(500).optional(),
  }),
])

/** POST — start a claim: send the code to the contact on file, or file
 * paper-proof for admin review. */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const parsed = startSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Invalid input" },
        { status: 400 }
      )
    }
    const result = await startClaim({ tenantId: params.id, ...parsed.data })
    if (!result.ok) {
      return NextResponse.json({ error: result.error, code: result.code }, { status: result.status })
    }
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    console.error("Start claim error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

const verifySchema = z.object({
  claimId: z.string().min(1),
  code: z.string().length(6),
})

/** PATCH — verify the code; success returns the completion token (and the
 * same link goes to the verified contact point). */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const parsed = verifySchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: "claimId and 6-digit code required" }, { status: 400 })
    }
    // claim must belong to this tenant — cheap guard against id mixing
    const result = await verifyClaimCode(parsed.data)
    if (!result.ok) {
      return NextResponse.json({ error: result.error, code: result.code }, { status: result.status })
    }
    return NextResponse.json(result)
  } catch (error) {
    console.error("Verify claim error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
