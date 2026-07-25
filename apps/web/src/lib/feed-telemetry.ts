/**
 * Feed interaction logging (recsys S0, business-model-v2.md §11/§16). A
 * tiny client-side queue that batches impression/dwell/tap/like/share/
 * comment/hide events and flushes them to POST /api/feed/events every 10s
 * or on page-hide/blur (sendBeacon, so the batch survives the tab closing).
 * Native has the identical contract in apps/mobile/src/lib/feed-telemetry.ts
 * (parity law — same event shape, same surfaces, same batching rules).
 *
 * Fire-and-forget by design: every export is wrapped so a telemetry failure
 * (network, storage, browser quirk) can never throw into a UI event handler.
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
let listenersBound = false
/** Circuit breaker: a bug in the queueing path (not a network blip) stops
 * further attempts rather than spamming errors on every card render. */
let disabled = false

function bindLifecycleListeners(): void {
  if (listenersBound || typeof window === "undefined") return
  listenersBound = true
  try {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flushFeedEvents(true)
    })
    window.addEventListener("pagehide", () => flushFeedEvents(true))
    window.addEventListener("blur", () => flushFeedEvents(true))
  } catch {
    /* telemetry must never break page load */
  }
}

function ensureRunning(): void {
  if (typeof window === "undefined") return
  if (!flushTimer) {
    flushTimer = setInterval(() => flushFeedEvents(false), FLUSH_INTERVAL_MS)
  }
  bindLifecycleListeners()
}

/** Queue one event; flushes immediately if the batch hits MAX_BATCH. */
export function logFeedEvent(event: FeedEventInput): void {
  if (disabled || typeof window === "undefined") return
  try {
    ensureRunning()
    queue.push({ ...event, ts: Date.now() })
    if (queue.length >= MAX_BATCH) flushFeedEvents(false)
  } catch {
    disabled = true
  }
}

/**
 * Send the queued batch. `useBeacon` picks navigator.sendBeacon (fires
 * reliably during unload/tab-hide, no response needed) over fetch; falls
 * back to a keepalive fetch if sendBeacon is unavailable or rejects.
 */
export function flushFeedEvents(useBeacon: boolean): void {
  if (typeof window === "undefined" || queue.length === 0) return
  const batch = queue.splice(0, MAX_BATCH)
  try {
    const payload = JSON.stringify({ events: batch })
    if (useBeacon && typeof navigator !== "undefined" && navigator.sendBeacon) {
      const blob = new Blob([payload], { type: "application/json" })
      if (navigator.sendBeacon(ENDPOINT, blob)) return
    }
    void fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => {
      /* best-effort — dropped events are acceptable for telemetry */
    })
  } catch {
    /* never throw from telemetry */
  }
}
