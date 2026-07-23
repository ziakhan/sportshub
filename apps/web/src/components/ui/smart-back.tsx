"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"

/**
 * SmartBack — THE back affordance for detail/flow screens (owner 2026-07-23:
 * replace the tiny "← Back to X" links with a real button that goes back ONE
 * step, not to a fixed hub).
 *
 * Target resolution (UI/UX consult):
 *  - Arrived here in-app (same-origin referrer + history) → router.back(),
 *    a true one-step return that preserves scroll/filters.
 *  - Deep link / refresh / external arrival → hierarchical parent fallback,
 *    labeled with WHERE it goes so it is never a mystery-meat button.
 *
 * 44px touch target, visible focus ring, works identically on mobile web.
 */
export function SmartBack({
  fallback,
  fallbackLabel,
  tone = "light",
  className = "",
}: {
  /** Hierarchical parent route when there is no in-app history. */
  fallback: string
  /** Human name of the fallback ("Events", "Dashboard"). */
  fallbackLabel: string
  /** "light" = ink text (white cards); "brand" = for brand-tinted headers. */
  tone?: "light" | "brand"
  className?: string
}) {
  const router = useRouter()
  const [hasHistory, setHasHistory] = useState(false)

  useEffect(() => {
    // Same-origin referrer + real history = a one-step back is meaningful.
    try {
      const sameOrigin = document.referrer && new URL(document.referrer).origin === window.location.origin
      setHasHistory(Boolean(sameOrigin) && window.history.length > 1)
    } catch {
      setHasHistory(false)
    }
  }, [])

  const go = useCallback(() => {
    if (hasHistory) router.back()
    else router.push(fallback)
  }, [hasHistory, router, fallback])

  return (
    <button
      type="button"
      onClick={go}
      className={`brand-focus inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-xl py-2 pl-1 pr-3 text-sm font-semibold transition-colors duration-200 ${
        tone === "brand"
          ? "text-[color:var(--brand-on)] opacity-90 hover:bg-white/10 hover:opacity-100"
          : "text-ink-600 hover:bg-ink-50 hover:text-ink-900"
      } ${className}`}
      aria-label={hasHistory ? "Go back" : `Back to ${fallbackLabel}`}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-5 w-5">
        <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {hasHistory ? "Back" : fallbackLabel}
    </button>
  )
}
