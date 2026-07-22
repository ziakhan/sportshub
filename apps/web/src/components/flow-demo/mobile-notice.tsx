"use client"

import { useEffect, useState } from "react"

const DISMISS_KEY = "demo-desktop-notice-dismissed"

/**
 * Phone-only floating pop-up over the live demos: the demo is fully
 * functional on a phone, but it shines on a computer. Slides up from the
 * bottom, dismissible, and stays dismissed for the rest of the browser
 * session across all demo pages. Framed as guidance, not an apology, so a
 * phone viewer doesn't read the small screens as the product being bad.
 */
export function MobileDesktopNotice() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      if (sessionStorage.getItem(DISMISS_KEY) === "1") return
    } catch {
      // storage blocked: still show, it just reappears next page
    }
    setVisible(true)
  }, [])

  if (!visible) return null

  const dismiss = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, "1")
    } catch {
      // storage blocked: dismiss still hides it for this page
    }
    setVisible(false)
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 fixed inset-x-4 bottom-4 z-50 duration-300 sm:hidden">
      <div className="border-gold-300 bg-gold-50 shadow-soft flex items-center gap-3 rounded-2xl border-2 p-3.5">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-gold-600 h-5 w-5 shrink-0"
        >
          <rect width="20" height="14" x="2" y="3" rx="2" />
          <path d="M8 21h8M12 17v4" />
        </svg>
        <p className="text-ink-800 text-[13px] font-medium leading-snug">
          <b className="text-ink-950">This demo works on your phone.</b> For the best
          experience, view it on a computer.
        </p>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="text-ink-500 hover:text-ink-800 -m-1 shrink-0 rounded-full p-1"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}
