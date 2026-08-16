"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"

/**
 * The player view's back control, on the same rules as SmartBack (parity law:
 * back navigation is history-first, never a static parent link).
 *
 *  - Arrived from somewhere in the app (same origin referrer plus real
 *    history) means back is one step, which returns to the gallery exactly
 *    where the viewer left it, scroll position and filters intact.
 *  - A cold open, a refresh or a link from outside falls back to /demos and
 *    says so, so the control is never a mystery.
 *
 * Written here rather than reusing the shared component because this bar sits
 * on court navy, and SmartBack's tones are ink on white or a brand tinted
 * header. Same semantics, dark clothes.
 */
export function DemoBackControl() {
  const router = useRouter()
  const [hasHistory, setHasHistory] = useState(false)

  useEffect(() => {
    try {
      const sameOrigin =
        document.referrer && new URL(document.referrer).origin === window.location.origin
      setHasHistory(Boolean(sameOrigin) && window.history.length > 1)
    } catch {
      setHasHistory(false)
    }
  }, [])

  const go = useCallback(() => {
    if (hasHistory) router.back()
    else router.push("/demos")
  }, [hasHistory, router])

  return (
    <button
      type="button"
      onClick={go}
      aria-label={hasHistory ? "Go back" : "Back to all demos"}
      className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-xl py-2 pl-2 pr-3 text-[13px] font-bold text-white/75 outline-none transition-colors duration-200 hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-gold-400/70"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        aria-hidden="true"
        className="h-[18px] w-[18px]"
      >
        <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {hasHistory ? "Back" : "All demos"}
    </button>
  )
}
