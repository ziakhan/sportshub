"use client"

import { StreamPreviewTile } from "@/components/streaming/hls-player"

/**
 * The one place this console reaches across the lane boundary.
 *
 * The live preview tile belongs to the streaming lane
 * (components/streaming/hls-player.tsx). It owns hls.js, the Safari native
 * path, muting and the on-screen-only loading, and the scorekeeper's
 * confirm-by-picture grid renders the same component. This dashboard must
 * never grow a second player: two players means two behaviours for "is there
 * a picture", which is the exact question this whole surface exists to answer.
 *
 * This wrapper exists for the one thing the shared tile deliberately does not
 * do — a DISABLED channel plays nothing at all. A disabled rig is not a rig
 * with a bad signal; it is one an admin switched off, and pulling segments for
 * it would be both wasteful and misleading.
 */

interface StreamPreviewProps {
  playbackUrl: string
  /** Camera name, drawn on the tile and read by assistive tech. */
  label: string
  /** Channel is disabled: show the still frame and never fetch. */
  disabled?: boolean
  className?: string
}

function CameraGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <rect x="2.5" y="6.5" width="12" height="11" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M14.5 10.5 20 7.6a.6.6 0 0 1 .9.5v7.8a.6.6 0 0 1-.9.5l-5.5-2.9"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** The still frame a switched-off camera shows, in the shared tile's own box. */
function DisabledPoster({ label, className }: { label: string; className?: string }) {
  return (
    <div
      className={`bg-ink-950 relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-2xl ring-1 ring-inset ring-white/10 ${className ?? ""}`}
    >
      <svg
        viewBox="0 0 160 90"
        aria-hidden="true"
        className="absolute inset-0 h-full w-full text-white opacity-[0.08]"
      >
        <rect x="4" y="4" width="152" height="82" rx="2" stroke="currentColor" strokeWidth="1.2" fill="none" />
        <line x1="80" y1="4" x2="80" y2="86" stroke="currentColor" strokeWidth="1.2" />
        <circle cx="80" cy="45" r="13" stroke="currentColor" strokeWidth="1.2" fill="none" />
        <path d="M4 22h26v46H4" stroke="currentColor" strokeWidth="1.2" fill="none" />
        <path d="M156 22h-26v46h26" stroke="currentColor" strokeWidth="1.2" fill="none" />
      </svg>
      <div className="relative flex flex-col items-center gap-1.5 px-4 text-center">
        <CameraGlyph className="h-6 w-6 text-white/45" />
        <span className="text-[11px] font-medium leading-4 text-white/65">
          Switched off, so nothing plays here
        </span>
      </div>
      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2 pb-1.5 pt-4 text-[11px] font-bold uppercase tracking-[0.1em] text-white">
        {label}
      </span>
    </div>
  )
}

export function StreamPreview({ playbackUrl, label, disabled = false, className }: StreamPreviewProps) {
  if (disabled) return <DisabledPoster label={label} className={className} />
  return <StreamPreviewTile src={playbackUrl} name={label} className={className} />
}
