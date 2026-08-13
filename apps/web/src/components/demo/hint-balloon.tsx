"use client"

import { useEffect, useState } from "react"

/**
 * Experience beacon (world spec §7): a floating dismissible pill that
 * points at a capability ("This is live scoring — updates as the table
 * scores"). Each hint shows until dismissed, then never again on that
 * browser. Amber = the demo colour.
 */
export function HintBalloon({ hintKey, children }: { hintKey: string; children: React.ReactNode }) {
  const storageKey = `sh-hint-${hintKey}`
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      if (!localStorage.getItem(storageKey)) setVisible(true)
    } catch {}
  }, [storageKey])

  if (!visible) return null

  return (
    <div className="my-3 flex items-start justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-100/80 px-4 py-2.5 text-sm text-amber-950 shadow-sm">
      <span className="leading-6">💡 {children}</span>
      <button
        onClick={() => {
          try {
            localStorage.setItem(storageKey, "1")
          } catch {}
          setVisible(false)
        }}
        className="mt-0.5 shrink-0 text-xs font-bold uppercase tracking-wide text-amber-700 hover:text-amber-900"
        aria-label="Dismiss hint"
      >
        Got it
      </button>
    </div>
  )
}
