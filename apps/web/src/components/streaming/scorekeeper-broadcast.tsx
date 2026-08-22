"use client"

import { useCallback, useEffect, useState } from "react"
import { CameraChooser } from "./camera-chooser"
import { StreamPreviewTile } from "./hls-player"
import type {
  CandidateChannel,
  CandidatesResponse,
  DisplacedChannel,
  TakeoverDetails,
} from "./candidates"

/**
 * Broadcasting, at the scorer's table (docs/roadmap/live-streaming-plan.md).
 *
 * ── BROADCASTING IS OPTIONAL AND OFF (owner, 2026-08-22) ──────────────────
 * The previous version of this surface assumed every game was being filmed: it
 * opened a grid of live pictures and asked "is there a camera at your court?"
 * before anyone had said they wanted one. Most games are not broadcast, and a
 * console that opens with an unanswered question about cameras teaches the
 * person running the scoreboard that something is wrong.
 *
 * So this is a four-state surface and the FIRST state is the quiet one:
 *
 *   offer      one line, one button: "Broadcast this game". Nothing is
 *              loading, nothing is playing, and dismissing it costs nothing.
 *   choosing   the chooser screen (camera-chooser.tsx) is open.
 *   confirm    a camera was just placed: its picture, its name, and the one
 *              sentence that matters. This is where confirm-by-picture still
 *              happens, AFTER the choice rather than instead of it.
 *   settled    a slim dark bar, out of the way of the scoreboard.
 *
 * A game with no camera reads as a normal game. That is the requirement, and
 * it is why the offer is a single quiet row and never a panel.
 *
 * Streaming is never allowed to break scoring: every fetch here fails silently
 * into "no bar at all", and the bar is dismissible for the session.
 */

const DISMISS_KEY = (gameId: string) => `broadcastBarDismissed:${gameId}`

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

interface Confirmation {
  channel: CandidateChannel
  displaced: DisplacedChannel[]
}

export function ScorekeeperBroadcast({ gameId }: { gameId: string }) {
  const [data, setData] = useState<CandidatesResponse | null>(null)
  const [scope, setScope] = useState<"here" | "all">("here")
  const [loading, setLoading] = useState(false)
  const [dismissed, setDismissed] = useState(true)
  const [choosing, setChoosing] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)
  const [takeover, setTakeover] = useState<{
    channelId: string
    details: TakeoverDetails
  } | null>(null)

  const load = useCallback(
    async (nextScope: "here" | "all" = "here") => {
      setLoading(true)
      try {
        const res = await fetch(
          `/api/games/${gameId}/stream/candidates${nextScope === "all" ? "?scope=all" : ""}`
        )
        // 401/403 is the ordinary answer for a guest scorer or a team parent
        // who opened this URL. The bar simply never appears.
        if (!res.ok) return null
        const body: CandidatesResponse = await res.json()
        setData(body)
        return body
      } catch {
        return null
      } finally {
        setLoading(false)
      }
    },
    [gameId]
  )

  useEffect(() => {
    if (typeof window !== "undefined") {
      setDismissed(sessionStorage.getItem(DISMISS_KEY(gameId)) === "1")
    }
    void load("here")
  }, [gameId, load])

  const changeScope = useCallback(
    (next: "here" | "all") => {
      setScope(next)
      void load(next)
    },
    [load]
  )

  function dismiss() {
    sessionStorage.setItem(DISMISS_KEY(gameId), "1")
    setDismissed(true)
  }

  const place = useCallback(
    async (channelId: string, force = false) => {
      if (!data) return
      const { courtId, venueId } = data.target
      setBusyId(channelId)
      setError(null)
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
          setError(body?.error || "That camera could not be pointed at this court")
          return
        }

        const picked = data.channels.find((c) => c.id === channelId) ?? null
        setTakeover(null)
        setChoosing(false)
        // Re-read in the DEFAULT scope: the camera is standing here now, so
        // this is the list that describes reality, and it carries the picture
        // the confirmation is about to show.
        const fresh = await load("here")
        setScope("here")
        const confirmed = fresh?.channels.find((c) => c.id === channelId) ?? picked
        if (confirmed) {
          setConfirmation({
            channel: confirmed,
            displaced: Array.isArray(body.displaced) ? body.displaced : [],
          })
        }
      } catch {
        setError("Could not reach the server. Try again.")
      } finally {
        setBusyId(null)
      }
    },
    [data, load]
  )

  /* ── what to render ──────────────────────────────────────────────────── */

  if (dismissed || !data || !data.consented) return null
  // Nowhere to put a camera: no court and no building on this game.
  if (!data.target.courtId && !data.target.venueId) return null

  const where = data.target.courtName ?? data.target.venueName ?? "this court"
  const placed = data.channels.find((c) => c.placedAtThisCourt) ?? null

  const chooser = choosing ? (
    <CameraChooser
      data={data}
      scope={scope}
      loading={loading}
      busyId={busyId}
      error={error}
      takeover={takeover}
      onScopeChange={changeScope}
      onPick={(channelId) => void place(channelId)}
      onConfirmTakeover={() => takeover && void place(takeover.channelId, true)}
      onCancelTakeover={() => setTakeover(null)}
      onClose={() => {
        setChoosing(false)
        setTakeover(null)
        setError(null)
      }}
    />
  ) : null

  /* ── confirm: the picture, the name, and what it cost ── */
  if (confirmation) {
    const displacedNames = confirmation.displaced.map((d) => d.channelName)
    return (
      <>
        <div className="border-court-200 bg-court-50 border-b px-3 py-2.5">
          <div className="flex items-start gap-3">
            {confirmation.channel.playbackUrl && (
              /* Big enough to recognise a gym in, and with NO name label: the
                 headline beside it already says which camera this is, and on
                 a tile this size the label gradient covers half the picture
                 the person is being asked to check. */
              <div className="w-28 shrink-0 sm:w-48">
                <StreamPreviewTile src={confirmation.channel.playbackUrl} />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p
                role="status"
                className="text-court-900 flex items-center gap-1.5 text-[13px] font-bold leading-5"
              >
                <span className="bg-court-600 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-white">
                  <CheckGlyph className="h-2.5 w-2.5" />
                </span>
                {confirmation.channel.name} is showing {where}
              </p>
              <p className="text-court-800 mt-0.5 text-[12px] leading-4">
                {confirmation.channel.playbackUrl
                  ? "Check the picture. Families watching this game see exactly that."
                  : "Families watching this game now see this camera."}
              </p>
              {displacedNames.length > 0 && (
                <p className="text-court-800 mt-1 text-[12px] leading-4">
                  {displacedNames.join(" and ")}{" "}
                  {displacedNames.length === 1 ? "was" : "were"} standing here, so{" "}
                  {displacedNames.length === 1 ? "it is" : "they are"} placed nowhere now.
                </p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmation(null)}
                  className="bg-court-600 hover:bg-court-700 min-h-[40px] cursor-pointer rounded-xl px-3.5 text-[13px] font-bold text-white transition-colors duration-200"
                >
                  That is my court
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmation(null)
                    setError(null)
                    setChoosing(true)
                  }}
                  className="text-court-800 hover:text-court-900 min-h-[40px] cursor-pointer text-[12.5px] font-semibold underline-offset-2 transition-colors duration-200 hover:underline"
                >
                  Wrong camera
                </button>
              </div>
            </div>
          </div>
        </div>
        {chooser}
      </>
    )
  }

  /* ── settled: a camera is here, so get out of the scoreboard's way ── */
  if (placed) {
    return (
      <>
        <div className="border-ink-200 bg-ink-950 flex items-center gap-2.5 border-b px-3 py-1.5 text-white">
          <span className="bg-live-500 h-1.5 w-1.5 shrink-0 rounded-full motion-safe:animate-pulse" />
          <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold">
            {placed.name} is broadcasting {where}
          </span>
          <button
            type="button"
            onClick={() => {
              setError(null)
              setChoosing(true)
            }}
            className="min-h-[32px] shrink-0 cursor-pointer rounded-lg px-2 text-[12px] font-medium text-white/70 underline-offset-2 transition-colors duration-200 hover:text-white hover:underline"
          >
            Change camera
          </button>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Hide the broadcast bar for this game"
            className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-white/60 transition-colors duration-200 hover:bg-white/10 hover:text-white"
          >
            <CloseGlyph className="h-3.5 w-3.5" />
          </button>
        </div>
        {chooser}
      </>
    )
  }

  /* ── the offer: one quiet line, and nothing is broken if it is ignored ── */
  return (
    <>
      <div className="border-ink-100 flex items-center gap-2.5 border-b bg-white px-3 py-2">
        <span className="text-ink-400 shrink-0">
          <LensGlyph className="h-4 w-4" />
        </span>
        <span className="text-ink-600 min-w-0 flex-1 text-[12.5px] leading-4">
          <span className="text-ink-800 font-semibold">Broadcast this game</span>
          <span className="hidden sm:inline">
            {" "}
            if there is a camera pointed at {where}. Optional.
          </span>
        </span>
        <button
          type="button"
          onClick={() => {
            setError(null)
            setChoosing(true)
          }}
          className="border-play-200 text-play-700 hover:bg-play-50 min-h-[36px] shrink-0 cursor-pointer rounded-xl border bg-white px-3 text-[12.5px] font-semibold transition-colors duration-200"
        >
          Add a camera
        </button>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Hide the broadcast row for this game"
          className="text-ink-400 hover:bg-ink-50 hover:text-ink-700 flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg transition-colors duration-200"
        >
          <CloseGlyph className="h-3.5 w-3.5" />
        </button>
      </div>
      {chooser}
    </>
  )
}
