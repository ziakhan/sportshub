import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { getFamilyAccountContext } from "@/lib/family/account-context"
import { createLinkCode, getActiveLinkCode } from "@/lib/family/link-code"

export const dynamic = "force-dynamic"

/**
 * Family link codes (parent-child linking arc 2026-08-13) — the in-person
 * path to the same guardian link the email invitation creates.
 *
 * Contract:
 *   GET  /api/family/link-code
 *        200 { code, expiresAt, direction, playerId }  — the live one
 *        200 { code: null }                            — none live
 *   POST /api/family/link-code   body { playerId? }
 *        201 { code, expiresAt, direction, playerId }
 *        400 { error } — a kid whose account already has a guardian
 *        403 { error } — playerId is not one of the caller's players
 *        401 { error } — signed out
 *
 * The direction is never sent by the client: a kid's account can only make a
 * "my parent will type this" code, and everyone else can only make a "my kid
 * will type this" one. Making a code voids the caller's previous one, so
 * there is exactly one live code per person at any moment.
 */

const createSchema = z.object({ playerId: z.string().optional() })

export async function GET() {
  const session = await getSessionUserId()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const active = await getActiveLinkCode(session.userId)
  if (!active) return NextResponse.json({ code: null })

  return NextResponse.json({
    code: active.code,
    expiresAt: active.expiresAt,
    direction: active.direction,
    playerId: active.playerId,
  })
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionUserId()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = createSchema.parse(await request.json().catch(() => ({})))
    const ctx = await getFamilyAccountContext(session.userId)

    // A kid signing in to their own profile with nobody looking after it: the
    // code they make is for the parent next to them. Their own player row is
    // resolved here, never taken from the request.
    const isUnparentedKid = !!ctx.player && !ctx.hasLinkedParent && ctx.isMinor
    const wantsChildScope = !!body.playerId && body.playerId !== ctx.player?.id

    if (isUnparentedKid && !wantsChildScope) {
      const code = await createLinkCode({
        userId: session.userId,
        direction: "CHILD_INVITES_PARENT",
        playerId: ctx.player!.id,
      })
      return NextResponse.json(code, { status: 201 })
    }

    if (ctx.player && ctx.hasLinkedParent && !wantsChildScope) {
      return NextResponse.json(
        { error: "You already have a parent or guardian on your account." },
        { status: 400 }
      )
    }

    // Everyone else is the parent side. An optional playerId says which of
    // their kids the code is about; it has to actually be theirs.
    let playerId: string | null = null
    if (body.playerId) {
      const player = await (prisma as any).player.findFirst({
        where: {
          id: body.playerId,
          parentId: session.userId,
          deletedAt: null,
          absorbedAt: null,
        },
        select: { id: true },
      })
      if (!player) {
        return NextResponse.json({ error: "That player is not on your account" }, { status: 403 })
      }
      playerId = player.id
    }

    const code = await createLinkCode({
      userId: session.userId,
      direction: "PARENT_INVITES_CHILD",
      playerId,
    })
    return NextResponse.json(code, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    console.error("Family link code error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
