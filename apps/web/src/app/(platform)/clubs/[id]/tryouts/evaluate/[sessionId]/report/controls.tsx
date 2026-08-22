"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { cn } from "@/components/ui/cn"

/**
 * The director's controls. Opening and closing is EXPLICIT rather than derived
 * from the clock (owner 2026-08-21): a derived window is a timezone bug and
 * tryouts run late. Closing freezes the scores, which is what makes the report
 * defensible to a parent who asks why their kid was cut.
 *
 * Visibility is the club's dial and the platform takes no position on it, the
 * same posture as the ruling on assignment authority. Whatever is chosen, a
 * club admin still sees everything attributed: anonymity to peers, never to
 * the person accountable.
 */

const VISIBILITY: { value: string; label: string; note: string }[] = [
  { value: "PRIVATE", label: "Private", note: "Each coach sees only their own" },
  { value: "AGGREGATE", label: "Aggregate", note: "Everyone sees the totals, not who gave what" },
  { value: "OPEN", label: "Open", note: "Everyone sees everything" },
]

export function DirectorControls({
  sessionId,
  status,
  visibility,
}: {
  sessionId: string
  status: "DRAFT" | "OPEN" | "CLOSED"
  visibility: string
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [showVis, setShowVis] = useState(false)

  const patch = async (body: Record<string, string>) => {
    setBusy(true)
    try {
      await fetch(`/api/evaluation-sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      router.refresh()
    } finally {
      setBusy(false)
      setShowVis(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span
        className={cn(
          "rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide",
          status === "OPEN" && "bg-play-100 text-play-800",
          status === "CLOSED" && "bg-ink-100 text-ink-600",
          status === "DRAFT" && "bg-hoop-50 text-hoop-800"
        )}
      >
        {status}
      </span>

      <div className="relative">
        <button
          type="button"
          onClick={() => setShowVis((v) => !v)}
          className="border-ink-200 text-ink-700 flex min-h-[40px] items-center rounded-xl border bg-white px-3 text-sm font-semibold"
        >
          {VISIBILITY.find((v) => v.value === visibility)?.label ?? visibility}
        </button>
        {showVis && (
          <div className="border-ink-200 absolute right-0 z-20 mt-1 w-64 rounded-xl border bg-white p-1 shadow-lg">
            {VISIBILITY.map((v) => (
              <button
                key={v.value}
                type="button"
                disabled={busy}
                onClick={() => patch({ visibility: v.value })}
                className={cn(
                  "hover:bg-ink-50 w-full rounded-lg px-3 py-2 text-left",
                  v.value === visibility && "bg-ink-50"
                )}
              >
                <span className="text-ink-900 block text-sm font-semibold">{v.label}</span>
                <span className="text-ink-500 block text-xs">{v.note}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {status !== "OPEN" ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => patch({ status: "OPEN" })}
          className="bg-play-600 flex min-h-[40px] items-center rounded-xl px-4 text-sm font-semibold text-white disabled:opacity-60"
        >
          {status === "CLOSED" ? "Reopen" : "Open scoring"}
        </button>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => patch({ status: "CLOSED" })}
          className="border-ink-300 text-ink-800 flex min-h-[40px] items-center rounded-xl border bg-white px-4 text-sm font-semibold disabled:opacity-60"
        >
          Close and freeze
        </button>
      )}
    </div>
  )
}
