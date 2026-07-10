import { NextResponse } from "next/server"
import { z } from "zod"
import { bearerToken, verifyAccessToken } from "@/lib/native-auth-tokens"
import { revokeAllForUser, revokeByToken } from "@/lib/native-auth"

/**
 * POST /api/auth/revoke — native sign-out (M2 bearer auth).
 * - `{ refreshToken }`: sign out this device. Possession of the refresh
 *   token IS the authority; the response never reveals whether it existed.
 * - `{ all: true }`: sign out everywhere — requires a valid Bearer access
 *   token, revokes every device family for that user.
 */

const revokeSchema = z.object({
  refreshToken: z.string().min(1).optional(),
  all: z.boolean().optional(),
})

export async function POST(request: Request) {
  try {
    const parsed = revokeSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success || (!parsed.data.refreshToken && !parsed.data.all)) {
      return NextResponse.json({ error: "refreshToken or all is required" }, { status: 400 })
    }

    if (parsed.data.all) {
      const userId = await verifyAccessToken(
        bearerToken(request.headers.get("authorization")) ?? ""
      )
      if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }
      await revokeAllForUser(userId)
      return NextResponse.json({ ok: true })
    }

    await revokeByToken(parsed.data.refreshToken!)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("Native revoke error:", err)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}
