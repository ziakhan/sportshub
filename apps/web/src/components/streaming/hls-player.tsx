"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { cn } from "@/components/ui"

/**
 * The HLS surfaces — one player, one preview tile
 * (docs/roadmap/live-streaming-plan.md, "Surfaces").
 *
 * Two components live here because they share one hard-won piece of plumbing:
 * attaching an .m3u8 to a <video>. Safari and iOS play HLS natively and must
 * NOT be handed hls.js (MSE is absent on iPhone, and on desktop Safari the
 * native path is the better one); everything else needs hls.js. Both paths tear
 * down on unmount — an orphaned Hls instance keeps fetching segments forever,
 * which on a scoring console with six preview tiles is a real bandwidth leak.
 *
 * Design rules applied (ui-ux-pro-max consult 2026-08-21):
 *   • Never autoplay the big player. It is a high-resolution stream on a phone
 *     that may be on cellular in a gym. Click to play, `preload="none"`.
 *   • The 16:9 box is always reserved, in every state, so nothing on the page
 *     moves when the picture arrives.
 *   • A stream that will not load says so in words. A dead black box reads as
 *     a broken page, not a quiet camera.
 *   • Muted by default (autoplay policy AND courtesy in a gym); the unmute
 *     control is part of the surface, not hidden in the native chrome.
 */

/** hls.js is loaded on demand — ~150KB that a Safari viewer never needs. */
type HlsInstance = {
  loadSource: (url: string) => void
  attachMedia: (el: HTMLVideoElement) => void
  on: (event: string, cb: (event: string, data: any) => void) => void
  destroy: () => void
}

function nativeHls(video: HTMLVideoElement): boolean {
  return video.canPlayType("application/vnd.apple.mpegurl") !== ""
}

/**
 * Attach `src` to `video`, returning a teardown. The teardown is the whole
 * point: React strict mode mounts twice, and every state change on the game
 * page re-runs the effect.
 */
function useHlsSource(
  videoRef: React.RefObject<HTMLVideoElement>,
  src: string | null,
  opts: { active: boolean; attempt?: number; onError?: () => void; onReady?: () => void }
) {
  const { active, attempt = 0, onError, onReady } = opts
  // Callbacks are read through a ref so a parent re-render never tears the
  // stream down and re-attaches it (which shows as a visible re-buffer).
  const cbRef = useRef({ onError, onReady })
  cbRef.current = { onError, onReady }

  useEffect(() => {
    const video = videoRef.current
    if (!video || !src || !active) return

    let disposed = false
    let hls: HlsInstance | null = null

    /**
     * "Ready" means THERE IS A PICTURE, not "the manifest parsed". Both are
     * the video element's own events, so the native and hls.js paths agree,
     * and the spinner stays up until a frame actually lands. (Reading
     * readiness off hlsManifestParsed showed controls over a black rectangle
     * for as long as the first segment took to arrive.)
     */
    const ready = () => cbRef.current.onReady?.()
    video.addEventListener("loadeddata", ready)
    video.addEventListener("playing", ready)
    const detach = () => {
      video.removeEventListener("loadeddata", ready)
      video.removeEventListener("playing", ready)
    }

    if (nativeHls(video)) {
      video.src = src
      const failed = () => cbRef.current.onError?.()
      video.addEventListener("error", failed)
      return () => {
        disposed = true
        detach()
        video.removeEventListener("error", failed)
        video.removeAttribute("src")
        video.load()
      }
    }

    import("hls.js")
      .then((mod) => {
        const Hls = mod.default
        if (disposed || !Hls.isSupported()) {
          if (!disposed) cbRef.current.onError?.()
          return
        }
        // No lowLatencyMode: the plan takes standard HLS latency (10-30s)
        // deliberately, and LL tuning against a plain manifest only makes the
        // player stall at the edge.
        const instance = new Hls({ enableWorker: true }) as unknown as HlsInstance
        hls = instance
        instance.on("hlsError", (_evt: string, data: any) => {
          // Only fatal errors are the viewer's problem; hls.js recovers from
          // the rest by itself and saying "not responding" mid-recovery lies.
          if (data?.fatal) cbRef.current.onError?.()
        })
        instance.attachMedia(video)
        instance.loadSource(src)
      })
      .catch(() => {
        if (!disposed) cbRef.current.onError?.()
      })

    return () => {
      disposed = true
      detach()
      hls?.destroy()
      hls = null
    }
    // `attempt` is in the deps so "Try again" genuinely re-attaches: after a
    // fatal error nothing else in this list changes, and without it the retry
    // button would only repaint the poster over a dead instance.
  }, [videoRef, src, active, attempt])
}

const FRAME =
  "relative w-full overflow-hidden rounded-2xl bg-ink-950 aspect-video ring-1 ring-inset ring-white/10"

function PlayGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M8 5.14v13.72a.5.5 0 0 0 .76.43l11.02-6.86a.5.5 0 0 0 0-.86L8.76 4.71A.5.5 0 0 0 8 5.14Z" />
    </svg>
  )
}

function SoundGlyph({ muted, className }: { muted: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M11 5 6 9H3v6h3l5 4Z" />
      {muted ? (
        <path d="m16 9 5 6m0-6-5 6" />
      ) : (
        <>
          <path d="M15.5 8.5a5 5 0 0 1 0 7" />
          <path d="M18.5 5.5a9 9 0 0 1 0 13" />
        </>
      )}
    </svg>
  )
}

export interface HlsPlayerProps {
  /** The channel's fixed .m3u8. Never an ingest URL — those are operator secrets. */
  src: string
  /** Shown over the poster state, e.g. "Rockets vs Lions". */
  label?: string
  /** Red ● LIVE mark on the picture. */
  live?: boolean
  className?: string
}

/**
 * The game-page player. Starts as a poster with one big play target: the
 * viewer decides when to spend the bandwidth.
 */
export function HlsPlayer({ src, label, live = true, className }: HlsPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [started, setStarted] = useState(false)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const [muted, setMuted] = useState(true)
  const [attempt, setAttempt] = useState(0)

  const onError = useCallback(() => setFailed(true), [])
  const onReady = useCallback(() => setReady(true), [])
  useHlsSource(videoRef, src, { active: started, attempt, onError, onReady })

  // A new source is a new stream: forget the last one's failure.
  useEffect(() => {
    setStarted(false)
    setReady(false)
    setFailed(false)
  }, [src])

  // Playback starts from the `autoPlay` attribute below rather than a play()
  // call: hls.js attaches asynchronously (dynamic import), so a play() timed
  // off React state lands before there is anything to play and silently
  // rejects. Muted autoplay is permitted everywhere, and the tap on the poster
  // is the user gesture that unmuting later rides on.

  const toggleMute = () => {
    const video = videoRef.current
    if (!video) return
    const next = !video.muted
    video.muted = next
    if (!next) video.volume = 1
    setMuted(next)
  }

  if (failed) {
    return (
      <div className={cn(FRAME, className)}>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
          <svg
            viewBox="0 0 24 24"
            className="h-7 w-7 text-white/50"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M2 6.5A2.5 2.5 0 0 1 4.5 4h9A2.5 2.5 0 0 1 16 6.5v11A2.5 2.5 0 0 1 13.5 20h-9A2.5 2.5 0 0 1 2 17.5Z" />
            <path d="m16 10 5-3.2v10.4L16 14" />
            <path d="M3 21 21 3" />
          </svg>
          <p className="text-sm font-semibold text-white">This stream is not responding</p>
          <p className="max-w-xs text-xs leading-5 text-white/70">
            The camera at this court may have been moved or switched off. The score and
            play-by-play below keep updating either way.
          </p>
          <button
            type="button"
            onClick={() => {
              setFailed(false)
              setReady(false)
              setStarted(true)
              setAttempt((n) => n + 1)
            }}
            className="brand-focus mt-1 min-h-[44px] cursor-pointer rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-white transition-colors duration-200 hover:bg-white/20"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={cn(FRAME, className)}>
      <video
        ref={videoRef}
        playsInline
        muted={muted}
        preload="none"
        autoPlay={started}
        controls={started}
        className={cn(
          "absolute inset-0 h-full w-full bg-ink-950 object-contain",
          started ? "opacity-100" : "opacity-0"
        )}
      />

      {!started && (
        <button
          type="button"
          onClick={() => setStarted(true)}
          aria-label={label ? `Play the live stream of ${label}` : "Play the live stream"}
          className="brand-focus group absolute inset-0 flex cursor-pointer flex-col items-center justify-center gap-3"
          style={{
            background:
              "radial-gradient(120% 90% at 50% 40%, rgba(30,45,77,0.55), rgba(11,22,40,0.96))",
          }}
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/30 transition-colors duration-200 group-hover:bg-white/25">
            <PlayGlyph className="ml-1 h-7 w-7 text-white" />
          </span>
          <span className="text-[13px] font-semibold text-white">Watch this game live</span>
          {label && <span className="px-6 text-center text-xs text-white/70">{label}</span>}
        </button>
      )}

      {started && !ready && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="h-8 w-8 rounded-full border-2 border-white/25 border-t-white motion-safe:animate-spin" />
        </div>
      )}

      {/* Overlay chrome. `pointer-events-none` on the rail keeps the native
          controls reachable; each control re-enables its own hit area. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-2.5">
        {live ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-white ring-1 ring-inset ring-white/20 backdrop-blur-sm">
            <span className="bg-live-500 h-1.5 w-1.5 rounded-full motion-safe:animate-pulse" />
            Live
          </span>
        ) : (
          <span />
        )}
        {started && (
          <button
            type="button"
            onClick={toggleMute}
            aria-label={muted ? "Unmute the stream" : "Mute the stream"}
            className="brand-focus pointer-events-auto flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-black/55 text-white ring-1 ring-inset ring-white/20 backdrop-blur-sm transition-colors duration-200 hover:bg-black/75"
          >
            <SoundGlyph muted={muted} className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  )
}

export interface StreamPreviewTileProps {
  src: string
  /** Channel name, drawn on the tile so a picture is never anonymous. */
  name?: string
  className?: string
}

/**
 * The picker/ops tile: muted, no controls, and it only starts fetching once it
 * is actually on screen (IntersectionObserver). Six of these on a scoring
 * console is six live HLS pulls, so the ones scrolled past stay asleep.
 *
 * Exported for reuse by the admin Streams dashboard (phase 2, other lane).
 */
export function StreamPreviewTile({ src, name, className }: StreamPreviewTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)

  const onError = useCallback(() => setFailed(true), [])
  const onReady = useCallback(() => setReady(true), [])
  useHlsSource(videoRef, src, { active: visible && !failed, onError, onReady })

  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true)
      return
    }
    const obs = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { rootMargin: "120px" }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  // Leaving the viewport does more than pause: `active` goes false, which
  // tears the hls.js instance down, so a tile scrolled past stops pulling
  // segments entirely. Coming back re-attaches and muted autoplay resumes.
  useEffect(() => {
    if (!visible) setReady(false)
  }, [visible])

  return (
    <div ref={boxRef} className={cn(FRAME, className)}>
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        preload="none"
        className={cn(
          "absolute inset-0 h-full w-full object-cover transition-opacity duration-200",
          ready && !failed ? "opacity-100" : "opacity-0"
        )}
      />

      {!ready && !failed && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/5">
          <span className="h-5 w-5 rounded-full border-2 border-white/25 border-t-white/80 motion-safe:animate-spin" />
        </div>
      )}

      {failed && (
        <div className="absolute inset-0 flex items-center justify-center px-2 text-center">
          <span className="text-[11px] font-medium leading-4 text-white/65">No picture</span>
        </div>
      )}

      {name && (
        <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2 pb-1.5 pt-4 text-[11px] font-bold uppercase tracking-[0.1em] text-white">
          {name}
        </span>
      )}
    </div>
  )
}
