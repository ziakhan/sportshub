"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"

/**
 * Anonymous visitor beacon for the launch surfaces (owner 2026-08-17).
 *
 * Mounted by the layouts of the landing, the demo directory and the claim
 * flow. Reports to POST /api/track in small batches:
 *  - pageview on every path change (first one carries referrer + utm)
 *  - a 15s heartbeat while the tab is actually visible = true time spent
 *  - every click on a link or button, labelled by its text
 * The demo player and the notify form push their own events through
 * `trackEvent`. No cookies, no fingerprinting: two random ids in web
 * storage, nothing else. Sessions are per-tab by design.
 */

type QueuedEvent = { kind: string; path: string; meta?: Record<string, unknown> }

const FLUSH_MS = 5_000
const HEARTBEAT_MS = 15_000
const MAX_BATCH = 25

let queue: QueuedEvent[] = []
let flushTimer: ReturnType<typeof setTimeout> | null = null

function id(storage: Storage, key: string): string {
  try {
    let v = storage.getItem(key)
    if (!v) {
      v = crypto.randomUUID()
      storage.setItem(key, v)
    }
    return v
  } catch {
    return "no-storage"
  }
}

function flush(useBeacon = false) {
  if (flushTimer) {
    clearTimeout(flushTimer)
    flushTimer = null
  }
  if (!queue.length) return
  const events = queue.splice(0, MAX_BATCH)
  const body = JSON.stringify({
    visitorId: id(localStorage, "sh1-vid"),
    sessionId: id(sessionStorage, "sh1-sid"),
    events,
  })
  // pagehide needs a request that survives the page going away.
  if (useBeacon && navigator.sendBeacon) {
    navigator.sendBeacon("/api/track", new Blob([body], { type: "application/json" }))
  } else {
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {})
  }
  if (queue.length) scheduleFlush()
}

function scheduleFlush() {
  if (!flushTimer) flushTimer = setTimeout(() => flush(), FLUSH_MS)
}

/** Queue one event. Safe to call from anywhere client-side. */
export function trackEvent(kind: string, path: string, meta?: Record<string, unknown>) {
  if (typeof window === "undefined") return
  queue.push({ kind, path, meta })
  scheduleFlush()
}

function clickLabel(el: Element): string {
  const text = (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 60)
  const href = el.getAttribute("href")
  return href ? `${text || "(no text)"} -> ${href.slice(0, 80)}` : text || "(no text)"
}

let sentLanding = false

export function LaunchTracker() {
  const pathname = usePathname()

  useEffect(() => {
    if (!pathname) return
    const meta: Record<string, unknown> = {}
    if (!sentLanding) {
      sentLanding = true
      meta.referrer = document.referrer.slice(0, 200) || undefined
      const params = new URLSearchParams(window.location.search)
      for (const k of ["utm_source", "utm_medium", "utm_campaign"]) {
        const v = params.get(k)
        if (v) meta[k] = v.slice(0, 80)
      }
      meta.viewport = `${window.innerWidth}x${window.innerHeight}`
    }
    trackEvent("pageview", pathname, Object.keys(meta).length ? meta : undefined)
  }, [pathname])

  useEffect(() => {
    const beat = setInterval(() => {
      if (document.visibilityState === "visible") {
        trackEvent("heartbeat", window.location.pathname, { seconds: HEARTBEAT_MS / 1000 })
      }
    }, HEARTBEAT_MS)

    const onClick = (e: MouseEvent) => {
      const target = (e.target as Element | null)?.closest("a, button")
      if (!target) return
      trackEvent("click", window.location.pathname, {
        label: target.getAttribute("data-track") || clickLabel(target),
      })
    }
    const onHide = () => flush(true)

    document.addEventListener("click", onClick, { capture: true, passive: true })
    window.addEventListener("pagehide", onHide)
    document.addEventListener("visibilitychange", onHide)
    return () => {
      clearInterval(beat)
      document.removeEventListener("click", onClick, { capture: true })
      window.removeEventListener("pagehide", onHide)
      document.removeEventListener("visibilitychange", onHide)
    }
  }, [])

  return null
}
