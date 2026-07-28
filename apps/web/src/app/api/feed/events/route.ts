import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { getSessionUserId } from "@/lib/auth-helpers"

export const dynamic = "force-dynamic"

/**
 * Recsys S0 (business-model-v2.md §11/§16): feed interaction logging. Every
 * client (web feed, web news, native social, native news, native home)
 * batches impression/dwell/tap/like/share/comment/hide events and flushes
 * them here every 10s or on page-hide/blur/background. Session is OPTIONAL —
 * signed-out impressions still count (userId null) — so this route is listed
 * in lib/public-paths.ts PUBLIC_API_ANY_METHOD_PREFIXES, the same pattern as
 * /api/waivers/sign. Always answers fast (202) so telemetry can never stall
 * the UI; malformed batches are dropped rather than 400'd, since a rejected
 * beacon retry would just re-queue junk.
 */

const EVENT_TYPES = ["impression", "dwell", "tap", "like", "share", "comment", "hide"] as const
const SURFACES = ["web-feed", "web-news", "native-social", "native-news", "native-home"] as const

const eventSchema = z.object({
  itemKey: z.string().min(1).max(200),
  postId: z.string().max(200).optional().nullable(),
  eventType: z.enum(EVENT_TYPES),
  valueMs: z.number().int().min(0).max(24 * 60 * 60 * 1000).optional().nullable(),
  surface: z.enum(SURFACES),
  // Client-stamped time — currently unused server-side (createdAt is the
  // insert time) but accepted so batches from a slow flush don't fail
  // validation; kept for a future "logged at" vs "happened at" distinction.
  ts: z.union([z.string(), z.number()]).optional(),
})

// Loose outer shape only — each event is validated independently below so
// one malformed entry (bad client build, future event type an old bundle
// doesn't know) drops just that entry, never the whole batch.
const rawBatchSchema = z.object({
  events: z.array(z.unknown()).max(1000),
})

export async function POST(request: NextRequest) {
  // Best-effort auth: logged-in users get their events attributed, everyone
  // else logs anonymously (userId null) — telemetry must work signed-out.
  let userId: string | null = null
  try {
    const session = await getSessionUserId()
    userId = session?.userId ?? null
  } catch {
    userId = null
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false }, { status: 202 })
  }

  const outer = rawBatchSchema.safeParse(body)
  if (!outer.success) {
    // Never surface a hard failure to telemetry callers — a malformed batch
    // (bad client build, tampered payload) is dropped, not retried forever.
    return NextResponse.json({ ok: false }, { status: 202 })
  }

  // Rate-sane: only the first MAX_BATCH events per call are considered, even
  // if the caller sent more than the client is supposed to batch.
  const events = outer.data.events
    .slice(0, 100)
    .map((e) => eventSchema.safeParse(e))
    .filter((r): r is z.SafeParseSuccess<z.infer<typeof eventSchema>> => r.success)
    .map((r) => r.data)

  if (events.length > 0) {
    try {
      await prisma.feedEvent.createMany({
        data: events.map((e) => ({
          userId,
          postId: e.postId ?? null,
          itemKey: e.itemKey,
          eventType: e.eventType,
          valueMs: e.valueMs ?? null,
          surface: e.surface,
        })),
      })
    } catch {
      // Logging must never break the caller — swallow DB errors too.
    }
  }

  return NextResponse.json({ ok: true }, { status: 202 })
}
