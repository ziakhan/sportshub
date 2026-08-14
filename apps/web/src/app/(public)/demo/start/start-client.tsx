"use client"

import { useEffect, useState } from "react"
import { BrandWordmark } from "@/components/brand/wordmark"
import { CourtBackdrop } from "@/components/ui"

export function DemoStartClient({ persona, signedIn }: { persona: string; signedIn: boolean }) {
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!signedIn) {
      window.location.href = `/sign-up?callbackUrl=${encodeURIComponent(`/demo/start?persona=${persona}`)}`
      return
    }
    ;(async () => {
      try {
        const res = await fetch("/api/demo/enter", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ persona }),
        })
        const data = await res.json().catch(() => ({}))
        if (res.ok) {
          window.location.href = data.landing || "/dashboard"
        } else {
          setError(data.error || "The demo could not start. Try again in a minute.")
        }
      } catch {
        setError("The demo could not start. Try again in a minute.")
      }
    })()
  }, [persona, signedIn])

  return (
    <CourtBackdrop
      variant="navy"
      className="flex min-h-[calc(100vh-4rem)] items-center"
      contentClassName="mx-auto max-w-sm px-4 py-16"
    >
      <div className="rounded-[28px] border border-white/15 bg-white/10 p-8 text-center shadow-[0_24px_70px_-40px_rgba(0,0,0,0.85)] backdrop-blur-sm">
        <BrandWordmark size="md" variant="reverse" />

        {error ? (
          <>
            <h1 className="mt-5 text-lg font-bold text-white">The demo did not start</h1>
            <p className="mt-2 text-sm leading-relaxed text-white/70">{error}</p>
          </>
        ) : (
          <>
            <div className="mt-6 flex justify-center" role="status" aria-live="polite">
              <svg
                className="h-8 w-8 motion-safe:animate-spin"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="9" stroke="rgba(255,255,255,0.22)" strokeWidth="3" />
                <path
                  d="M21 12a9 9 0 0 0-9-9"
                  stroke="#f59e0b"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
              <span className="sr-only">Setting up your demo</span>
            </div>
            <h1 className="mt-5 text-lg font-bold text-white">Setting up your demo</h1>
            <p className="mt-2 text-sm leading-relaxed text-white/70">
              Building a season with real teams, games and scores. This takes a moment.
            </p>
          </>
        )}
      </div>
    </CourtBackdrop>
  )
}
