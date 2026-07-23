"use client"

import { useState } from "react"
import { cn } from "@/components/ui/cn"

/**
 * The one share dialog (social-feed-plan P4, Instagram mechanics): pick a
 * template, optionally add one photo, then post to the player's profile,
 * their 24h story, either, or both. Visibility is clamped server-side for
 * private players. No text input anywhere — the content is the card.
 */

async function photoToDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, 1000 / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement("canvas")
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL("image/jpeg", 0.85)
}

async function shareImage(url: string, title: string) {
  try {
    const res = await fetch(url)
    if (res.ok) {
      const blob = await res.blob()
      const file = new File([blob], "sportshub-card.png", { type: "image/png" })
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title })
        return
      }
    }
  } catch {
    /* fall through */
  }
  window.open(url, "_blank")
}

export function ShareCardDialog({
  gameId,
  playerId,
  playerName,
  isPotg,
  onClose,
}: {
  gameId: string
  playerId: string
  playerName: string
  isPotg: boolean
  onClose: () => void
}) {
  const [cardType, setCardType] = useState<"STAT_CARD" | "POTG">(isPotg ? "POTG" : "STAT_CARD")
  const [template, setTemplate] = useState<"bold" | "clean" | "court" | "night">("bold")
  const [photo, setPhoto] = useState<string | null>(null)
  const [toProfile, setToProfile] = useState(true)
  const [toStory, setToStory] = useState(true)
  const [visibility, setVisibility] = useState<"FOLLOWERS" | "PUBLIC">("FOLLOWERS")
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cardUrl = `/api/live/${gameId}/card${cardType === "POTG" ? "" : `/${playerId}`}?template=${template}&v=3`

  const submit = async () => {
    if (busy || (!toProfile && !toStory)) return
    setBusy(true)
    setError(null)
    const body = JSON.stringify({
      playerId,
      gameId,
      cardType,
      visibility,
      templateId: template,
      ...(photo ? { customPhotoUrl: photo } : {}),
    })
    try {
      const calls: Promise<Response>[] = []
      if (toStory) {
        calls.push(
          fetch("/api/stories", { method: "POST", headers: { "Content-Type": "application/json" }, body })
        )
      }
      if (toProfile) {
        calls.push(
          fetch("/api/posts/player-card", { method: "POST", headers: { "Content-Type": "application/json" }, body })
        )
      }
      const results = await Promise.all(calls)
      const failed = results.find((r) => !r.ok)
      if (failed) {
        const data = await failed.json().catch(() => ({}))
        setError(data.error || "Couldn't share the card")
      } else {
        setDone(true)
      }
    } catch {
      setError("Couldn't share the card")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4" onClick={onClose}>
      <div
        className="my-auto w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-ink-950 text-lg font-bold">Share {playerName}&apos;s card</h3>
          <button onClick={onClose} aria-label="Close" className="text-ink-400 hover:text-ink-700 p-1">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {done ? (
          <div className="mt-4 space-y-4 text-center">
            <p className="text-court-700 bg-court-50 rounded-xl p-3 text-sm font-semibold">
              Shared! {toStory ? "The story runs for 24 hours." : ""}
            </p>
            <button
              onClick={() => shareImage(cardUrl, `${playerName} — game card`)}
              className="border-ink-200 text-ink-700 hover:bg-ink-50 w-full rounded-xl border px-4 py-2.5 text-sm font-semibold"
            >
              Also share the image (Instagram, chat…)
            </button>
            <button
              onClick={onClose}
              className="bg-play-600 hover:bg-play-700 w-full rounded-xl px-4 py-2.5 text-sm font-bold text-white"
            >
              Done
            </button>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {isPotg && (
              <div className="bg-ink-100 flex rounded-xl p-1">
                {(
                  [
                    ["POTG", "🏀 Player of the Game"],
                    ["STAT_CARD", "📊 Stat line"],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    onClick={() => setCardType(k)}
                    className={cn(
                      "flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold",
                      cardType === k ? "text-ink-950 bg-white shadow-sm" : "text-ink-500"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cardUrl} alt="Card preview" className="border-ink-100 w-full rounded-xl border" />

            <div className="flex gap-2">
              {(["bold", "clean", "court", "night"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTemplate(t)}
                  className={cn(
                    "flex-1 rounded-lg border px-3 py-1.5 text-xs font-semibold capitalize",
                    template === t
                      ? "border-play-500 bg-play-50 text-play-700"
                      : "border-ink-200 text-ink-600 bg-white"
                  )}
                >
                  {t}
                </button>
              ))}
              {photo ? (
                <button
                  onClick={() => setPhoto(null)}
                  className="border-ink-200 text-ink-600 rounded-lg border bg-white px-3 py-1.5 text-xs font-semibold"
                >
                  Remove photo
                </button>
              ) : (
                <label className="border-ink-200 text-ink-600 hover:bg-ink-50 cursor-pointer rounded-lg border bg-white px-3 py-1.5 text-xs font-semibold">
                  📷 Add photo
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const f = e.target.files?.[0]
                      if (f) setPhoto(await photoToDataUrl(f))
                      e.target.value = ""
                    }}
                  />
                </label>
              )}
            </div>
            {photo && (
              <p className="text-ink-500 text-xs">
                Photos are checked automatically and only show where the player&apos;s media
                consent allows.
              </p>
            )}

            <div className="space-y-2">
              <label className="border-ink-200 flex cursor-pointer items-center gap-3 rounded-xl border p-3">
                <input type="checkbox" checked={toProfile} onChange={(e) => setToProfile(e.target.checked)} />
                <span className="text-sm">
                  <span className="text-ink-900 font-semibold">Post to profile</span>
                  <span className="text-ink-500 block text-xs">Stays on the player page</span>
                </span>
              </label>
              <label className="border-ink-200 flex cursor-pointer items-center gap-3 rounded-xl border p-3">
                <input type="checkbox" checked={toStory} onChange={(e) => setToStory(e.target.checked)} />
                <span className="text-sm">
                  <span className="text-ink-900 font-semibold">Add to story</span>
                  <span className="text-ink-500 block text-xs">Visible for 24 hours</span>
                </span>
              </label>
            </div>

            <div className="bg-ink-100 flex rounded-xl p-1">
              {(
                [
                  ["FOLLOWERS", "Followers"],
                  ["PUBLIC", "Public"],
                ] as const
              ).map(([v, label]) => (
                <button
                  key={v}
                  onClick={() => setVisibility(v)}
                  className={cn(
                    "flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold",
                    visibility === v ? "text-ink-950 bg-white shadow-sm" : "text-ink-500"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="text-ink-400 text-xs">
              Public sharing applies only when the player&apos;s profile is set to public.
            </p>

            {error && (
              <p className="border-hoop-200 bg-hoop-50 text-hoop-700 rounded-xl border p-2.5 text-xs font-semibold">
                {error}
              </p>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => shareImage(cardUrl, `${playerName} — game card`)}
                className="border-ink-200 text-ink-700 hover:bg-ink-50 flex-1 rounded-xl border px-3 py-2.5 text-sm font-semibold"
              >
                Just share the image
              </button>
              <button
                disabled={busy || (!toProfile && !toStory)}
                onClick={submit}
                className="bg-play-600 hover:bg-play-700 flex-1 rounded-xl px-3 py-2.5 text-sm font-bold text-white disabled:opacity-50"
              >
                {busy ? "Sharing…" : "Share"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
