import { NextResponse } from "next/server"
import { SignJWT } from "jose"
import { getSessionUserId } from "@/lib/auth-helpers"
import { getMemberTeamIds } from "@/lib/teams/chat-access"

export const dynamic = "force-dynamic"

/**
 * GET /api/realtime/ticket — mint a 60-second socket-handshake ticket
 * (M1 — docs/roadmap/native-app-execution-plan.md).
 *
 * Auth is getSessionUserId, so both the web session cookie AND a native
 * bearer token (M2) work. The ticket claims the private rooms this user may
 * join — their user room plus every team chat they belong to (same
 * membership set as the chat dock). The sidecar only enforces the claim;
 * membership is decided here, where the DB is.
 *
 * Deliberately NOT `token_use=access`: a leaked ticket must never work as an
 * API bearer credential (and verifyAccessToken rejects it).
 */

const TICKET_TTL_SECONDS = 60

export async function GET() {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const secret = process.env.AUTH_TOKEN_SECRET
    if (!secret) {
      return NextResponse.json({ error: "Realtime is not configured" }, { status: 503 })
    }

    const teamIds = await getMemberTeamIds(auth.userId)
    const rooms = [`user:${auth.userId}`, ...[...teamIds].map((id) => `team:${id}`)]

    const ticket = await new SignJWT({ rooms })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(auth.userId)
      .setIssuedAt()
      .setExpirationTime(`${TICKET_TTL_SECONDS}s`)
      .sign(new TextEncoder().encode(secret))

    return NextResponse.json({ ticket, rooms })
  } catch (error) {
    console.error("Realtime ticket error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
