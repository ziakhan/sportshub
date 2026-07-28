"use client"

import { useEffect, useRef } from "react"
import { logFeedEvent } from "@/lib/feed-telemetry"

interface NewsCardTelemetryProps {
  itemKey: string
  postId?: string | null
  children: React.ReactNode
}

/**
 * Impression (IntersectionObserver >=50% visible for 1s) + tap logging for
 * /news index cards (recsys S0, business-model-v2.md §11/§16). A thin
 * wrapper rather than instrumenting NewsCard itself — NewsCard is reused on
 * surfaces (home, club/league/team pages) that are NOT the "web-news"
 * telemetry surface, so this stays scoped to the /news page only.
 */
export function NewsCardTelemetry({ itemKey, postId, children }: NewsCardTelemetryProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === "undefined") return
    let impressionTimer: ReturnType<typeof setTimeout> | null = null
    let impressionFired = false

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
          if (!impressionFired && !impressionTimer) {
            impressionTimer = setTimeout(() => {
              impressionFired = true
              impressionTimer = null
              logFeedEvent({ itemKey, postId: postId ?? null, eventType: "impression", surface: "web-news" })
            }, 1000)
          }
        } else if (impressionTimer) {
          clearTimeout(impressionTimer)
          impressionTimer = null
        }
      },
      { threshold: [0, 0.5] }
    )
    observer.observe(el)
    return () => {
      observer.disconnect()
      if (impressionTimer) clearTimeout(impressionTimer)
    }
  }, [itemKey, postId])

  return (
    <div
      ref={ref}
      className="h-full"
      onClick={() => logFeedEvent({ itemKey, postId: postId ?? null, eventType: "tap", surface: "web-news" })}
    >
      {children}
    </div>
  )
}
