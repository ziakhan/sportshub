"use client"

import { useState } from "react"

/** "Add to phone calendar" — mints the personal feed token, shows links.
 * Shared by the team calendar and My Calendar (same all-teams feed). */
export function AddToPhone() {
  const [open, setOpen] = useState(false)
  const [path, setPath] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [failed, setFailed] = useState(false)

  async function openPanel() {
    setOpen((v) => !v)
    if (path || open) return
    try {
      const res = await fetch("/api/calendar/token", { method: "POST" })
      if (!res.ok) throw new Error()
      setPath((await res.json()).path)
    } catch {
      setFailed(true)
    }
  }

  const httpsUrl = path && typeof window !== "undefined" ? `${window.location.origin}${path}` : null
  const webcalUrl = httpsUrl ? httpsUrl.replace(/^https?:/, "webcal:") : null

  return (
    <div className="relative">
      <button
        onClick={openPanel}
        className="border-ink-200 text-ink-700 hover:bg-ink-50 rounded-xl border px-3 py-1.5 text-xs font-semibold"
      >
        📅 Add to phone
      </button>
      {open && (
        <div className="border-ink-200 absolute right-0 z-20 mt-2 w-72 rounded-2xl border bg-white p-4 shadow-lg">
          {failed ? (
            <p className="text-sm text-red-600">Couldn&apos;t create your calendar link.</p>
          ) : !httpsUrl ? (
            <p className="text-ink-500 text-sm">Creating your calendar link…</p>
          ) : (
            <div className="space-y-2 text-sm">
              <p className="text-ink-800 font-semibold">Subscribe once — updates flow in</p>
              <p className="text-ink-500 text-xs">
                Practices and games for all your teams. Moves and cancellations update
                automatically.
              </p>
              <a
                href={webcalUrl!}
                className="bg-play-600 hover:bg-play-700 block rounded-xl px-3 py-2 text-center text-xs font-semibold text-white"
              >
                iPhone / Apple Calendar
              </a>
              <a
                href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcalUrl!)}`}
                target="_blank"
                rel="noreferrer"
                className="border-ink-200 text-ink-700 hover:bg-ink-50 block rounded-xl border px-3 py-2 text-center text-xs font-semibold"
              >
                Google Calendar (Android)
              </a>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(httpsUrl).then(() => {
                    setCopied(true)
                    setTimeout(() => setCopied(false), 2000)
                  })
                }}
                className="text-play-600 hover:text-play-700 w-full text-center text-xs font-semibold"
              >
                {copied ? "Copied!" : "Copy feed URL"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
