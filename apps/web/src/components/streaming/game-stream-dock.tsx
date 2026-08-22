"use client"

import { format } from "date-fns"
import { HlsPlayer } from "./hls-player"

/**
 * The game page's stream dock (docs/roadmap/live-streaming-plan.md,
 * "Surfaces" #1 and "Playback window").
 *
 * It renders exactly one of the four states GET /api/games/[id]/stream
 * returns, and the important one is the first: `none` draws NOTHING. Most
 * games have no camera, and a permanent empty video frame on every game page
 * would read as a broken player rather than as a game nobody filmed.
 *
 * The other three are deliberately not all video-shaped. Only `live` gets the
 * dark 16:9 surface; `upcoming` and `ended` are calm light cards in the page's
 * own idiom, because a black box with text in it looks like a stream that
 * failed.
 */

/** The four states, wire-shaped: `startsAt` arrives as an ISO string. */
export type GameStreamStateWire =
  | { state: "none" }
  | { state: "upcoming"; startsAt: string }
  | { state: "live"; playbackUrl: string }
  | { state: "ended" }

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

export function GameStreamDock({
  state,
  matchup,
}: {
  state: GameStreamStateWire | null
  /** "Rockets vs Lions" — labels the play button for screen readers. */
  matchup?: string
}) {
  if (!state || state.state === "none") return null

  if (state.state === "live") {
    return (
      <div className="mb-4">
        <HlsPlayer src={state.playbackUrl} label={matchup} live />
      </div>
    )
  }

  if (state.state === "upcoming") {
    const at = new Date(state.startsAt)
    const valid = !Number.isNaN(at.getTime())
    return (
      <div className="border-ink-100 mb-4 flex items-center gap-3 rounded-2xl border bg-white p-4">
        <span className="bg-play-50 text-play-600 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
          <LensGlyph className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-ink-950 text-sm font-bold">
            {valid ? `Live at ${format(at, "h:mm a")}` : "Live later today"}
          </p>
          <p className="text-ink-600 mt-0.5 text-xs leading-5">
            There is a camera on this court. The picture appears here when the game starts.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="border-ink-100 mb-4 flex items-center gap-3 rounded-2xl border bg-white p-4">
      <span className="bg-ink-50 text-ink-400 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
        <LensGlyph className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="text-ink-800 text-sm font-semibold">This game has ended</p>
        <p className="text-ink-600 mt-0.5 text-xs leading-5">
          The live picture is off. The final score and every play are below.
        </p>
      </div>
    </div>
  )
}
