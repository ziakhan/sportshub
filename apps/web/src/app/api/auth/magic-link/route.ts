// Request a magic sign-in email (link + 6-digit code). ALWAYS returns 200
// with the same body — like /api/auth/forgot-password, the response must
// never reveal whether an account exists (user enumeration). Lives under
// /api/auth, which the middleware allowlists for all methods.

import { NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { normalizedEmailSchema } from "@/lib/validations/email"
import { createLoginToken } from "@/lib/auth-magic"
import { appBaseUrl, sendMagicLinkEmail } from "@/lib/email"
import { isOurHost } from "@/lib/domains"
import { rateLimit } from "@/lib/rate-limit"

const magicSchema = z.object({
  email: normalizedEmailSchema("Invalid email address"),
  callbackUrl: z.string().optional(),
})

/** Same-origin relative paths only — mirrors the sign-in page's guard. */
function safeCallbackUrl(raw: string | undefined): string | null {
  if (!raw) return null
  return raw.startsWith("/") && !raw.startsWith("//") ? raw : null
}

export async function POST(request: Request) {
  const ok = NextResponse.json({ success: true })
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
    // Per-IP first line; the per-user window in createLoginToken is the
    // real budget (survives IP rotation, bounds email volume per account).
    if (!rateLimit(`magic-link:${ip}`, 10, 15 * 60 * 1000)) return ok

    const body = await request.json()
    const parsed = magicSchema.safeParse(body)
    if (!parsed.success) return ok

    const user = await prisma.user.findFirst({
      where: { email: { equals: parsed.data.email, mode: "insensitive" } },
    })
    if (!user || user.status !== "ACTIVE") return ok

    const minted = await createLoginToken(user.id)
    if (!minted) return ok // window exhausted — stay silent

    const callback = safeCallbackUrl(parsed.data.callbackUrl)
    // The emailed link keeps the visitor on the domain they asked from
    // (owner law 2026-08-17); a host we don't recognize falls back to the
    // canonical base rather than echoing an attacker-supplied Host header.
    const reqHost = (request.headers.get("x-forwarded-host") || request.headers.get("host") || "")
      .split(",")[0]
      .trim()
    const proto = reqHost.startsWith("localhost") || reqHost.startsWith("127.") ? "http" : "https"
    const base = reqHost && isOurHost(reqHost) ? `${proto}://${reqHost}` : appBaseUrl()
    const link = `${base}/magic-link?token=${encodeURIComponent(minted.token)}${
      callback ? `&callbackUrl=${encodeURIComponent(callback)}` : ""
    }`

    await sendMagicLinkEmail({
      to: user.email,
      firstName: user.firstName,
      link,
      code: minted.code,
    })

    return ok
  } catch (error) {
    // Generic success regardless — a failure must not leak account existence.
    console.error("Magic-link request error:", error)
    return ok
  }
}
