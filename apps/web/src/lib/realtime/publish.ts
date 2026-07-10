import { createHmac } from "node:crypto"

/**
 * Server → sidecar publish seam (M1 — docs/roadmap/native-app-execution-plan.md).
 *
 * One short-timeout HMAC-signed POST to the sidecar's /internal/publish;
 * the sidecar fans out to socket rooms. Serverless-safe: no Redis client in
 * Vercel functions, no connection reuse needed. If SIDECAR_URL is unset or
 * the sidecar is unreachable this is a silent no-op — the DB write already
 * happened and every surface still has its polling fallback, so realtime is
 * strictly additive.
 *
 * Events are PINGS, not state transfer: payloads carry ids and cheap
 * scalars, and clients respond by running their existing fetch immediately.
 * The server stays the single source of truth; there is no client-side merge
 * protocol to get wrong.
 *
 * Rooms (must match apps/sidecar/src/rooms.ts):
 *   public — scores · game:{id} · league:{id}:scores
 *   private — team:{id} · user:{id}
 */

export interface RealtimeEvent {
  rooms: string[]
  event: string
  payload: unknown
}

/** Sidecar caps rooms per publish; chunk user fan-outs to stay under it. */
const MAX_ROOMS_PER_PUBLISH = 50

/** HMAC-signed POST to a sidecar /internal/* endpoint. Never throws. */
async function signedSidecarPost(path: string, body: string): Promise<void> {
  const url = process.env.SIDECAR_URL
  const secret = process.env.SIDECAR_SHARED_SECRET
  if (!url || !secret) return
  const timestamp = String(Date.now())
  const signature = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex")
  try {
    await fetch(`${url}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-timestamp": timestamp,
        "x-signature": signature,
      },
      body,
      // Bounded so a dead sidecar costs a request at most this much latency.
      signal: AbortSignal.timeout(1500),
    })
  } catch (err) {
    console.error(`sidecar post ${path} failed:`, err instanceof Error ? err.message : err)
  }
}

async function post(event: RealtimeEvent): Promise<void> {
  if (event.rooms.length === 0) return
  await signedSidecarPost("/internal/publish", JSON.stringify(event))
}

/**
 * Awaited variant — call after the DB write, before returning the response.
 * Never throws.
 */
export async function publishRealtime(event: RealtimeEvent): Promise<void> {
  const chunks: string[][] = []
  for (let i = 0; i < event.rooms.length; i += MAX_ROOMS_PER_PUBLISH) {
    chunks.push(event.rooms.slice(i, i + MAX_ROOMS_PER_PUBLISH))
  }
  await Promise.all(chunks.map((rooms) => post({ ...event, rooms })))
}

/**
 * Fire-and-forget variant for call sites inside transactions (the notify()
 * seam) where awaiting a network call would hold the transaction open. On
 * serverless the promise may occasionally be dropped at function freeze —
 * acceptable for bell pings, which the client also polls for.
 */
export function publishRealtimeDetached(event: RealtimeEvent): void {
  void publishRealtime(event)
}

/** Room name helpers — one place to keep the shapes in sync with the sidecar. */
export const rooms = {
  scores: "scores" as const,
  game: (gameId: string) => `game:${gameId}`,
  leagueScores: (leagueId: string) => `league:${leagueId}:scores`,
  team: (teamId: string) => `team:${teamId}`,
  user: (userId: string) => `user:${userId}`,
}

/** One queued push notification — mirrors the sidecar's /internal/push. */
export interface PushItem {
  userId: string
  type: string
  title: string
  message: string
  link?: string | null
}

/** Sidecar caps items per push enqueue. */
const MAX_PUSH_ITEMS = 500

/**
 * Enqueue push notifications on the sidecar (M3). Detached like the bell
 * ping — the notify() seam runs inside transactions. The sidecar worker
 * resolves devices, applies quiet hours, and talks to the Expo Push API;
 * nothing here blocks or throws.
 */
export function enqueuePushDetached(items: PushItem[]): void {
  if (items.length === 0) return
  void (async () => {
    for (let i = 0; i < items.length; i += MAX_PUSH_ITEMS) {
      await signedSidecarPost(
        "/internal/push",
        JSON.stringify({ items: items.slice(i, i + MAX_PUSH_ITEMS) })
      )
    }
  })()
}
