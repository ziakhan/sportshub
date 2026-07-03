"use client"

import { useState } from "react"
import { cn } from "./cn"

interface MediaTileProps {
  type: "PHOTO" | "VIDEO"
  /** Image src, or video poster/thumbnail. */
  thumbnail: string
  /** Video source (required for VIDEO). */
  src?: string
  caption?: string
  className?: string
}

/**
 * Photo or video tile for Media tabs. Video is click-to-play and never
 * autoplays (preload="none") — per the data/energy UX guideline.
 */
export function MediaTile({ type, thumbnail, src, caption, className }: MediaTileProps) {
  const [playing, setPlaying] = useState(false)

  return (
    <figure className={cn("group relative overflow-hidden rounded-2xl", className)}>
      <div className="bg-ink-100 aspect-square w-full">
        {type === "VIDEO" && playing && src ? (
          <video
            src={src}
            poster={thumbnail}
            controls
            autoPlay
            playsInline
            preload="none"
            className="h-full w-full object-cover"
          />
        ) : (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={thumbnail}
              alt={caption || ""}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
            />
            {type === "VIDEO" && (
              <button
                type="button"
                onClick={() => setPlaying(true)}
                aria-label={caption ? `Play video: ${caption}` : "Play video"}
                className="absolute inset-0 flex items-center justify-center bg-ink-950/20 transition hover:bg-ink-950/30"
              >
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 shadow-lg">
                  <svg className="text-ink-950 ml-1 h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </span>
              </button>
            )}
          </>
        )}
      </div>
      {caption && (
        <figcaption className="text-ink-600 absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink-950/70 to-transparent p-3 text-xs font-medium text-white">
          {caption}
        </figcaption>
      )}
    </figure>
  )
}
