"use client"

import { useEffect, useState } from "react"

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
    <div className="container mx-auto flex min-h-[50vh] items-center justify-center px-4 py-16">
      <div className="text-center">
        {error ? (
          <p className="text-ink-600">{error}</p>
        ) : (
          <p className="text-ink-500">Setting up your demo…</p>
        )}
      </div>
    </div>
  )
}
