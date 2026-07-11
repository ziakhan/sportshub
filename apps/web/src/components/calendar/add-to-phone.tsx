"use client"

import { useState } from "react"

/**
 * "Add to phone calendar" — ONE CLICK (owner rule 2026-07-11): mint the
 * personal feed token, detect the platform, and launch the right subscribe
 * flow immediately — webcal:// on Apple, the Google Calendar add-by-URL page
 * on Android/other. A small confirmation panel stays open with fallbacks in
 * case the calendar app didn't take over. Shared by team calendar + My
 * Calendar (same all-teams feed).
 */

type Platform = "apple" | "android" | "other"

function detectPlatform(): Platform {
  const ua = navigator.userAgent
  // iPadOS 13+ reports as Mac; both want webcal:// into Apple Calendar
  if (/iPhone|iPad|iPod/.test(ua) || /Macintosh|Mac OS X/.test(ua)) return "apple"
  if (/Android/.test(ua)) return "android"
  return "other"
}

export function AddToPhone() {
  const [open, setOpen] = useState(false)
  const [path, setPath] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [failed, setFailed] = useState(false)
  const [launched, setLaunched] = useState<Platform | null>(null)

  async function mintPath(): Promise<string | null> {
    if (path) return path
    try {
      const res = await fetch("/api/calendar/token", { method: "POST" })
      if (!res.ok) throw new Error()
      const next = (await res.json()).path as string
      setPath(next)
      return next
    } catch {
      setFailed(true)
      return null
    }
  }

  const urls = (feedPath: string) => {
    const httpsUrl = `${window.location.origin}${feedPath}`
    const webcalUrl = httpsUrl.replace(/^https?:/, "webcal:")
    const googleUrl = `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcalUrl)}`
    return { httpsUrl, webcalUrl, googleUrl }
  }

  async function addNow() {
    if (busy) return
    setBusy(true)
    setOpen(true)
    const feedPath = await mintPath()
    setBusy(false)
    if (!feedPath) return
    const platform = detectPlatform()
    const { webcalUrl, googleUrl } = urls(feedPath)
    setLaunched(platform)
    if (platform === "apple") {
      // Hands off to Calendar's subscribe dialog without leaving the page
      window.location.href = webcalUrl
    } else if (platform === "android") {
      window.open(googleUrl, "_blank", "noopener")
    }
    // "other": panel stays open with all options
  }

  const linkSet = path ? urls(path) : null

  return (
    <div className="relative">
      <button
        onClick={addNow}
        disabled={busy}
        className="border-ink-200 text-ink-700 hover:bg-ink-50 rounded-xl border px-3 py-1.5 text-xs font-semibold disabled:opacity-60"
      >
        📅 {busy ? "Adding…" : "Add to phone"}
      </button>
      {open && (
        <div className="border-ink-200 absolute right-0 z-20 mt-2 w-72 rounded-2xl border bg-white p-4 shadow-lg">
          <button
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="text-ink-400 hover:text-ink-700 absolute right-3 top-2 text-lg leading-none"
          >
            ×
          </button>
          {failed ? (
            <p className="text-sm text-red-600">Couldn&apos;t create your calendar link.</p>
          ) : !linkSet ? (
            <p className="text-ink-500 text-sm">Creating your calendar link…</p>
          ) : (
            <div className="space-y-2 text-sm">
              <p className="text-ink-800 font-semibold">
                {launched === "apple"
                  ? "Opening Apple Calendar…"
                  : launched === "android"
                    ? "Opening Google Calendar…"
                    : "Subscribe once — updates flow in"}
              </p>
              <p className="text-ink-500 text-xs">
                {launched && launched !== "other"
                  ? "Confirm the subscription there and every practice, game and event stays in sync. Didn't open? Use the buttons below."
                  : "Practices, games and events for all your teams. Moves and cancellations update automatically."}
              </p>
              <a
                href={linkSet.webcalUrl}
                className="bg-play-600 hover:bg-play-700 block rounded-xl px-3 py-2 text-center text-xs font-semibold text-white"
              >
                iPhone / Apple Calendar
              </a>
              <a
                href={linkSet.googleUrl}
                target="_blank"
                rel="noreferrer"
                className="border-ink-200 text-ink-700 hover:bg-ink-50 block rounded-xl border px-3 py-2 text-center text-xs font-semibold"
              >
                Google Calendar (Android)
              </a>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(linkSet.httpsUrl).then(() => {
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
