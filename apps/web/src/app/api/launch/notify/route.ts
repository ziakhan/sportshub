import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { rateLimit } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"

/**
 * The pre-launch notify list (owner 2026-08-17). Fed by the landing hero and
 * the demo player's entry ask. No account, no session: one contact in, one
 * row out.
 *
 * Bot posture, per the launch plan: a honeypot field named `website` (real
 * people never see it, bots fill it) plus a per-IP rate limit. No CAPTCHA
 * until real abuse shows up.
 */

const IDENTITIES = new Set(["Player", "Parent", "Club", "League", "Referee", "Trainer", "Media"])

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

function classify(raw: string): { kind: "email" | "phone"; contact: string } | null {
  const trimmed = raw.trim()
  if (!trimmed || trimmed.length > 254) return null
  if (trimmed.includes("@")) {
    const email = trimmed.toLowerCase()
    return EMAIL_RE.test(email) ? { kind: "email", contact: email } : null
  }
  const digits = trimmed.replace(/\D/g, "")
  if (digits.length < 10 || digits.length > 15) return null
  return { kind: "phone", contact: digits }
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local"
  if (!rateLimit(`launch-notify:${ip}`, 8, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 })
  }

  // Honeypot: silently accept and drop, so the bot learns nothing.
  if (typeof body.website === "string" && body.website.length > 0) {
    return NextResponse.json({ ok: true })
  }

  const parsed = typeof body.contact === "string" ? classify(body.contact) : null
  if (!parsed) {
    return NextResponse.json(
      { error: "Enter an email address or a phone number." },
      { status: 400 }
    )
  }

  const identity =
    typeof body.identity === "string" && IDENTITIES.has(body.identity) ? body.identity : null
  const source =
    typeof body.source === "string" && body.source.length <= 64 ? body.source : "landing"

  await (prisma as any).launchSignup.upsert({
    where: { contact: parsed.contact },
    create: { contact: parsed.contact, kind: parsed.kind, identity, source },
    update: { identity: identity ?? undefined, source },
  })

  return NextResponse.json({ ok: true })
}
