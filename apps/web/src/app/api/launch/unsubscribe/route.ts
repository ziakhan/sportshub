import crypto from "crypto"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { launchUnsubToken } from "@/lib/launch-welcome"
import { publicOrigin } from "@/lib/request-origin"

export const dynamic = "force-dynamic"

/**
 * One-click opt-out from the launch list (linked from the welcome email).
 * The HMAC token proves the link came from our email; the row is deleted
 * outright because before launch the list IS the only record. Idempotent:
 * a second click lands on the same goodbye page.
 */
export async function GET(req: NextRequest) {
  const c = req.nextUrl.searchParams.get("c")
  const t = req.nextUrl.searchParams.get("t")
  if (!c || !t) return NextResponse.json({ error: "Bad link" }, { status: 400 })

  let contact: string
  try {
    contact = Buffer.from(c, "base64url").toString("utf8")
  } catch {
    return NextResponse.json({ error: "Bad link" }, { status: 400 })
  }

  const expected = launchUnsubToken(contact)
  if (t.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(t), Buffer.from(expected))) {
    return NextResponse.json({ error: "Bad link" }, { status: 400 })
  }

  await (prisma as any).launchSignup.deleteMany({ where: { contact } })
  return NextResponse.redirect(new URL("/unsubscribed", publicOrigin(req)))
}
