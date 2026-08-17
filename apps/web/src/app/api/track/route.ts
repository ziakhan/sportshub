import { NextRequest, NextResponse } from "next/server"
import { getToken } from "next-auth/jwt"
import { prisma } from "@youthbasketballhub/db"
import { rateLimit } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"

/**
 * Launch-surface activity beacon sink (owner 2026-08-17). Anonymous by
 * design: the client sends two random ids and a small batch of events; the
 * only server-side enrichment is a signedIn flag (session cookie present =
 * the owner or team browsing, kept out of headline numbers). Garbage is
 * dropped row by row, never rejected loudly: a beacon endpoint that errors
 * teaches bots more than it helps us.
 */

const KINDS = new Set(["pageview", "heartbeat", "click", "demo", "signup"])
const MAX_EVENTS = 25

function cleanMeta(meta: unknown): Record<string, unknown> | undefined {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return undefined
  const out: Record<string, unknown> = {}
  let n = 0
  for (const [k, v] of Object.entries(meta as Record<string, unknown>)) {
    if (n >= 10) break
    if (typeof v === "string") out[k.slice(0, 40)] = v.slice(0, 200)
    else if (typeof v === "number" && Number.isFinite(v)) out[k.slice(0, 40)] = v
    else continue
    n++
  }
  return Object.keys(out).length ? out : undefined
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local"
  // Generous: a real visitor flushes at most every 5s per tab.
  if (!rateLimit(`track:${ip}`, 40, 60_000)) {
    return NextResponse.json({ ok: true })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: true })
  }

  const visitorId = typeof body?.visitorId === "string" ? body.visitorId.slice(0, 64) : null
  const sessionId = typeof body?.sessionId === "string" ? body.sessionId.slice(0, 64) : null
  const events = Array.isArray(body?.events) ? body.events.slice(0, MAX_EVENTS) : []
  if (!visitorId || !sessionId || !events.length) {
    return NextResponse.json({ ok: true })
  }

  const signedIn = !!(await getToken({ req, secret: process.env.NEXTAUTH_SECRET }))

  const rows = events
    .filter(
      (e: any) =>
        e &&
        typeof e.kind === "string" &&
        KINDS.has(e.kind) &&
        typeof e.path === "string" &&
        e.path.length > 0
    )
    .map((e: any) => ({
      visitorId,
      sessionId,
      kind: e.kind as string,
      path: (e.path as string).slice(0, 200),
      meta: cleanMeta(e.meta),
      signedIn,
    }))

  if (rows.length) {
    await (prisma as any).activityEvent.createMany({ data: rows })
  }

  return NextResponse.json({ ok: true })
}
