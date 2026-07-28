import { AppState, type AppStateStatus } from "react-native"
import { apiFetch } from "./api"

/**
 * Feed interaction logging (recsys S0, business-model-v2.md §11/§16). Native
 * twin of apps/web/src/lib/feed-telemetry.ts (parity law — identical event
 * shape, surfaces, and batching rules): a tiny queue that batches
 * impression/dwell/tap/like/share/comment/hide events and flushes them to
 * POST /api/feed/events every 10s or when the app backgrounds.
 *
 * Fire-and-forget by design: every export is wrapped so a telemetry failure
 * can never throw into a screen's event handler. apiFetch already attaches
 * the bearer token when signed in and omits it otherwise — the endpoint
 * accepts anonymous events (userId null), so this works signed-out too.
 */

export type FeedEventType =
  | "impression"
  | "dwell"
  | "tap"
  | "like"
  | "share"
  | "comment"
  | "hide"

export type FeedSurface =
  | "web-feed"
  | "web-news"
  | "native-social"
  | "native-news"
  | "native-home"

export interface FeedEventInput {
  itemKey: string
  postId?: string | null
  eventType: FeedEventType
  valueMs?: number
  surface: FeedSurface
}

interface QueuedFeedEvent extends FeedEventInput {
  ts: number
}

const ENDPOINT = "/api/feed/events"
const MAX_BATCH = 100
const FLUSH_INTERVAL_MS = 10_000

let queue: QueuedFeedEvent[] = []
let flushTimer: ReturnType<typeof setInterval> | null = null
let appStateBound = false
/** Circuit breaker: a bug in the queueing path (not a network blip) stops
 * further attempts rather than spamming errors on every card render. */
let disabled = false

function bindAppState(): void {
  if (appStateBound) return
  appStateBound = true
  try {
    AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state === "background" || state === "inactive") void flushFeedEvents()
    })
  } catch {
    /* telemetry must never break app start */
  }
}

function ensureRunning(): void {
  if (!flushTimer) {
    flushTimer = setInterval(() => void flushFeedEvents(), FLUSH_INTERVAL_MS)
  }
  bindAppState()
}

/** Queue one event; flushes immediately if the batch hits MAX_BATCH. */
export function logFeedEvent(event: FeedEventInput): void {
  if (disabled) return
  try {
    ensureRunning()
    queue.push({ ...event, ts: Date.now() })
    if (queue.length >= MAX_BATCH) void flushFeedEvents()
  } catch {
    disabled = true
  }
}

/** Send the queued batch. Best-effort — dropped events on failure are fine
 * for telemetry (no retry queue, matches the web client). */
export async function flushFeedEvents(): Promise<void> {
  if (queue.length === 0) return
  const batch = queue.splice(0, MAX_BATCH)
  try {
    await apiFetch(ENDPOINT, {
      method: "POST",
      body: JSON.stringify({ events: batch }),
    })
  } catch {
    /* never throw from telemetry */
  }
}
