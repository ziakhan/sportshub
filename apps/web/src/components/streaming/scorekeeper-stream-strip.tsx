"use client"

import { useCallback, useEffect, useState } from "react"
import { StreamPreviewTile } from "./hls-player"

/**
 * The one human touch in the whole streaming system
 * (docs/roadmap/live-streaming-plan.md, "The human interaction: scorekeeper
 * confirms by picture").
 *
 * The scorekeeper is already at the court and already signed in to score this
 * exact game. They see either
 *
 *   • a camera is already placed here → a small live preview and one tap to
 *     confirm, with a quiet way out if it is the wrong rig; or
 *   • nothing placed here → "Is there a camera at your court? Tap its
 *     picture:" and a grid of every hot channel's picture.
 *
 * Picking by PICTURE is the anti-mistake mechanism. Stickers get swapped and
 * labels get misread, but nobody mistakes someone else's gym for the floor
 * they are sitting beside.
 *
 * Two rules this surface obeys because it sits on a live-operations screen:
 * it never blocks scoring (dismissible for the session, and it collapses to a
 * single line the moment it is confirmed), and every tap says something back.
 */

interface Candidate {
  id: string
  name: string
  playbackUrl: string
  placedAtThisCourt: boolean
}

interface CandidatesResponse {
  target: {
    courtId: string | null
    venueId: string | null
    courtName: string | null
    venueName: string | null
  }
  consented: boolean
  channels: Candidate[]
}

interface TakeoverDetails {
  channelName: string
  courtName: string | null
  venueName: string | null
  matchup: string | null
}

const DISMISS_KEY = (gameId: string) => `streamStripDismissed:${gameId}`
const CONFIRM_KEY = (gameId: string) => `streamStripConfirmed:${gameId}`

function LensGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 7.5A2.5 2.5 0 0 1 4.5 5h8A2.5 2.5 0 0 1 15 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-8A2.5 2.5 0 0 1 2 16.5Z" />
      <path d="m15 10.5 6-3.6v10.2l-6-3.6" />
    </svg>
  )
}

function CheckGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m5 12.5 4.5 4.5L19 7" />
    </svg>
  )
}

function CloseGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  )
}

export function ScorekeeperStreamStrip({ gameId }: { gameId: string }) {
  const [data, setData] = useState<CandidatesResponse | null>(null)
  const [dismissed, setDismissed] = useState(true)
  const [confirmed, setConfirmed] = useState(false)
  const [picking, setPicking] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [message, setMessage] = useState<{ tone: "ok" | "bad"; text: string } | null>(null)
  const [takeover, setTakeover] = useState<
    { channelId: string; details: TakeoverDetails } | null
  >(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/games/${gameId}/stream/candidates`)
      // 401/403 is the ordinary answer for a guest scorer or a team parent who
      // opened this URL. The strip simply never appears.
      if (!res.ok) return
      const body: CandidatesResponse = await res.json()
      setData(body)
    } catch {
      // Streaming is never allowed to break the scoring console.
    }
  }, [gameId])

  useEffect(() => {
    if (typeof window !== "undefined") {
      setDismissed(sessionStorage.getItem(DISMISS_KEY(gameId)) === "1")
      setConfirmed(sessionStorage.getItem(CONFIRM_KEY(gameId)) === "1")
    }
    load()
  }, [gameId, load])

  function dismiss() {
    sessionStorage.setItem(DISMISS_KEY(gameId), "1")
    setDismissed(true)
  }

  function confirm() {
    sessionStorage.setItem(CONFIRM_KEY(gameId), "1")
    setConfirmed(true)
    setPicking(false)
    setMessage({ tone: "ok", text: "Confirmed. Families are watching this picture." })
  }

  async function place(channelId: string, force = false) {
    if (!data) return
    const { courtId, venueId } = data.target
    setBusyId(channelId)
    setMessage(null)
    try {
      const res = await fetch("/api/admin/streams/placement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channelId,
          ...(courtId ? { courtId } : { venueId }),
          ...(force ? { force: true } : {}),
        }),
      })
      const body = await res.json().catch(() => ({}))

      if (!res.ok) {
        if (body?.code === "TAKEOVER_REQUIRED" && body?.details && !force) {
          setTakeover({ channelId, details: body.details as TakeoverDetails })
          return
        }
        setMessage({ tone: "bad", text: body?.error || "Couldn't point that camera here" })
        return
      }

      setTakeover(null)
      await load()
      const name = data.channels.find((c) => c.id === channelId)?.name ?? "That camera"
      sessionStorage.setItem(CONFIRM_KEY(gameId), "1")
      setConfirmed(true)
      setPicking(false)
      setMessage({ tone: "ok", text: `${name} is now on this court.` })
    } catch {
      setMessage({ tone: "bad", text: "Couldn't reach the server. Try again." })
    } finally {
      setBusyId(null)
    }
  }

  if (dismissed || !data || !data.consented) return null
  if (!data.target.courtId && !data.target.venueId) return null
  if (data.channels.length === 0) return null

  const placed = data.channels.find((c) => c.placedAtThisCourt) ?? null
  const where = data.target.courtName ?? data.target.venueName ?? "your court"

  // Confirmed and settled: one quiet line, so the strip stops taking room on a
  // screen whose whole job is the scoreboard.
  if (confirmed && placed && !picking) {
    return (
      <div className="border-ink-200 bg-ink-950 flex items-center gap-2.5 border-b px-3 py-1.5 text-white">
        <span className="bg-live-500 h-1.5 w-1.5 shrink-0 rounded-full motion-safe:animate-pulse" />
        <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold">
          {placed.name} is streaming {where}
        </span>
        <button
          type="button"
          onClick={() => setPicking(true)}
          className="min-h-[32px] shrink-0 cursor-pointer rounded-lg px-2 text-[12px] font-medium text-white/70 underline-offset-2 transition-colors duration-200 hover:text-white hover:underline"
        >
          Change
        </button>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Hide the camera strip for this game"
          className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-white/60 transition-colors duration-200 hover:bg-white/10 hover:text-white"
        >
          <CloseGlyph className="h-3.5 w-3.5" />
        </button>
      </div>
    )
  }

  const showPicker = picking || !placed

  return (
    <div className="border-ink-200 border-b bg-white px-3 py-2.5">
      <div className="flex items-start gap-2">
        <span className="bg-play-50 text-play-600 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg">
          <LensGlyph className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-ink-950 text-[13px] font-bold leading-5">
            {placed
              ? `${placed.name} is at your court`
              : "Is there a camera at your court?"}
          </p>
          <p className="text-ink-600 text-[12px] leading-4">
            {placed
              ? `Check the picture. If that is ${where}, confirm it.`
              : "Tap its picture. Nothing else on this screen changes."}
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Hide the camera strip for this game"
          className="text-ink-400 hover:bg-ink-50 hover:text-ink-700 flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg transition-colors duration-200"
        >
          <CloseGlyph className="h-4 w-4" />
        </button>
      </div>

      {/* ---- already placed: one preview and one tap ---- */}
      {placed && !showPicker && (
        <div className="mt-2 flex items-center gap-3">
          {/* The tile fills its box (cn() is a plain joiner, not
              tailwind-merge, so a width passed INTO it would lose to the
              frame's own w-full). Size it from the outside. */}
          <div className="w-32 shrink-0 sm:w-40">
            <StreamPreviewTile src={placed.playbackUrl} name={placed.name} />
          </div>
          <div className="flex min-w-0 flex-1 flex-col items-start gap-1.5">
            <button
              type="button"
              onClick={confirm}
              className="bg-court-600 hover:bg-court-700 inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl px-4 text-sm font-bold text-white transition-colors duration-200"
            >
              <CheckGlyph className="h-4 w-4" />
              Yes, that is my court
            </button>
            <button
              type="button"
              onClick={() => setPicking(true)}
              className="text-ink-500 hover:text-ink-800 min-h-[32px] cursor-pointer text-[12.5px] font-medium underline-offset-2 transition-colors duration-200 hover:underline"
            >
              Wrong camera
            </button>
          </div>
        </div>
      )}

      {/* ---- the picker: every hot channel, as a picture ---- */}
      {showPicker && (
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {data.channels.map((channel) => (
            <button
              key={channel.id}
              type="button"
              onClick={() => place(channel.id)}
              disabled={busyId !== null}
              aria-label={`Point ${channel.name} at ${where}`}
              className="brand-focus group relative cursor-pointer rounded-2xl text-left transition-opacity duration-200 disabled:opacity-50"
            >
              <StreamPreviewTile src={channel.playbackUrl} name={channel.name} />
              {channel.placedAtThisCourt && (
                <span className="bg-court-600 absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full text-white shadow">
                  <CheckGlyph className="h-3.5 w-3.5" />
                </span>
              )}
              {busyId === channel.id && (
                <span className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/50">
                  <span className="h-5 w-5 rounded-full border-2 border-white/30 border-t-white motion-safe:animate-spin" />
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {message && (
        <p
          role="status"
          className={`mt-2 text-[12.5px] font-semibold ${
            message.tone === "ok" ? "text-court-700" : "text-hoop-700"
          }`}
        >
          {message.text}
        </p>
      )}

      {/* ---- take-over confirm: name what goes dark ---- */}
      {takeover && (
        <div className="border-gold-200 bg-gold-50 mt-2 rounded-xl border p-3">
          <p className="text-ink-950 text-[13px] font-bold">
            {takeover.details.channelName} is showing another court
          </p>
          <p className="text-ink-700 mt-0.5 text-[12.5px] leading-5">
            It is live on{" "}
            <span className="font-semibold">
              {takeover.details.courtName ?? "another court"}
            </span>
            {takeover.details.venueName ? ` at ${takeover.details.venueName}` : ""}
            {takeover.details.matchup ? ` (${takeover.details.matchup})` : ""}. Taking it will
            leave that game with no picture.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => place(takeover.channelId, true)}
              disabled={busyId !== null}
              className="bg-hoop-600 hover:bg-hoop-700 min-h-[44px] cursor-pointer rounded-xl px-4 text-sm font-bold text-white transition-colors duration-200 disabled:opacity-50"
            >
              Take it anyway
            </button>
            <button
              type="button"
              onClick={() => setTakeover(null)}
              className="border-ink-200 text-ink-700 hover:bg-ink-50 min-h-[44px] cursor-pointer rounded-xl border bg-white px-4 text-sm font-semibold transition-colors duration-200"
            >
              Leave it alone
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
