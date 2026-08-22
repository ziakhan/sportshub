"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Badge, Button } from "@/components/ui"
import { StreamPreviewTile } from "./hls-player"
import type { CandidateChannel, CandidatesResponse, TakeoverDetails } from "./candidates"

/**
 * "Choose the camera showing this court" — the scorekeeper's camera picker
 * (docs/roadmap/live-streaming-plan.md, "The human interaction").
 *
 * Replaces the strip of preview tiles that sat on the scoring page. That strip
 * was right for three cameras and wrong for a hundred: at Coalition scale the
 * fleet is 100 to 200 rigs, and a grid of live tiles is both unreadable and
 * billed by the delivered minute.
 *
 * ── WHAT THE CONSULT SETTLED (ui-ux-pro-max, 2026-08-22) ──────────────────
 *
 * • SEARCH IS THE PRIMARY CONTROL, pinned under the title where a thumb
 *   reaches it, debounced rather than submitted, never requiring Enter. A
 *   fleet this size is found by name, not by scrolling.
 * • ROWS, NOT A GRID. A row carries what a tile cannot: the building tag, the
 *   live state, and the court this rig is currently standing at. Those three
 *   are the whole reason a scorekeeper picks right or wrong.
 * • A WALL OF VIDEO IS THE ANTI-PATTERN. Cloudflare bills delivered minutes
 *   per viewer, so a 240p tile costs what 1080p costs. At most SIX pictures
 *   play at once (MAX_PLAYING), the tile's own IntersectionObserver keeps the
 *   off-screen ones torn down, and rows past the cap offer "Show picture",
 *   which swaps the oldest one out.
 * • NEVER A DEAD END. Empty search inside a building offers the fleet; empty
 *   search in the fleet offers to clear the query.
 * • COLOUR IS NEVER THE ONLY CARRIER. Every state also has its own word.
 * • Long lists render in windows (RENDER_STEP) and grow on scroll, because
 *   200 rows each holding a video element is a phone running out of memory.
 *
 * ── THE ONE RULE THIS SURFACE CANNOT BREAK ────────────────────────────────
 * A camera in another building arrives with `playbackUrl: null` (see the
 * header of api/games/[id]/stream/candidates). That is not a loading state and
 * the UI must never present it as one: those rows say plainly that there is no
 * picture from another building, and picking one is a deliberate act of taking
 * a rig back by name.
 */

/** Delivered minutes are the bill, so this is a cost ceiling, not a layout one. */
const MAX_PLAYING = 6

/** How many rows exist in the DOM at once, before the sentinel grows the list. */
const RENDER_STEP = 30

/** Long enough that typing does not thrash, short enough to feel immediate. */
const SEARCH_DEBOUNCE_MS = 180

type Scope = "here" | "all"

function SearchGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
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

/**
 * The placeholder behind a camera with no picture on screen.
 *
 * A court motif rather than a black rectangle: black reads as broken, and this
 * is the ordinary state of most rows. Hand-authored SVG, per the repo's asset
 * law.
 */
function CourtMotif({ label }: { label: string }) {
  return (
    <div className="bg-ink-900 absolute inset-0 flex flex-col items-center justify-center gap-1">
      <svg viewBox="0 0 64 40" className="h-7 w-11 text-white/25" fill="none" aria-hidden="true">
        <rect x="2" y="2" width="60" height="36" rx="2" stroke="currentColor" strokeWidth="1.6" />
        <path d="M32 2v36" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="32" cy="20" r="6" stroke="currentColor" strokeWidth="1.6" />
        <path d="M2 12h9v16H2M62 12h-9v16h9" stroke="currentColor" strokeWidth="1.6" />
      </svg>
      <span className="px-1 text-center text-[9.5px] font-semibold leading-3 text-white/50">
        {label}
      </span>
    </div>
  )
}

/**
 * Where this rig is standing, twice: a SHORT form for the badge and a full
 * one for the sentence under it.
 *
 * Two forms because a badge is uppercase with wide tracking, and
 * "AT COURT 3, HABER RECREATION CENTRE" wrapped onto two lines and swallowed
 * the row. The court alone identifies it; the building belongs in the
 * sentence, where it reads at normal weight.
 */
function standingAt(channel: CandidateChannel): { short: string; full: string } | null {
  if (channel.placedCourtName && channel.placedVenueName) {
    return {
      short: channel.placedCourtName,
      full: `${channel.placedCourtName}, ${channel.placedVenueName}`,
    }
  }
  const one = channel.placedCourtName ?? channel.placedVenueName
  return one ? { short: one, full: one } : null
}

/* ── one camera ───────────────────────────────────────────────────────────── */

function CameraRow({
  channel,
  playing,
  busy,
  disabled,
  onPick,
  onShowPicture,
  onPicture,
}: {
  channel: CandidateChannel
  /** In the play set: its picture is attached (subject to being on screen). */
  playing: boolean
  busy: boolean
  disabled: boolean
  onPick: () => void
  onShowPicture: () => void
  onPicture: (hasPicture: boolean) => void
}) {
  const where = standingAt(channel)
  const canShowPicture = !!channel.playbackUrl

  return (
    <li className="border-ink-100 flex items-stretch gap-2 border-b last:border-b-0">
      <button
        type="button"
        onClick={onPick}
        disabled={disabled}
        aria-label={`Use ${channel.name} for this court`}
        className="brand-focus flex min-h-[76px] flex-1 cursor-pointer items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors duration-200 hover:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {/* The picture, or an honest stand-in for it.
            The tile owns its own 16:9 frame, so it is SIZED FROM THE OUTSIDE
            and never handed positioning classes: cn() is a plain joiner, not
            tailwind-merge, so an `absolute` passed in would simply lose to the
            frame's own `relative` and drop the picture below the box. */}
        <span className="relative block w-24 shrink-0 sm:w-28">
          {playing && channel.playbackUrl ? (
            <StreamPreviewTile src={channel.playbackUrl} onPicture={onPicture} />
          ) : (
            <span className="bg-ink-950 relative block aspect-video w-full overflow-hidden rounded-2xl ring-1 ring-inset ring-white/10">
              <CourtMotif label={canShowPicture ? "Picture off" : "Another building"} />
            </span>
          )}
          {busy && (
            <span className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/55">
              <span className="h-5 w-5 rounded-full border-2 border-white/30 border-t-white motion-safe:animate-spin" />
            </span>
          )}
        </span>

        <span className="min-w-0 flex-1">
          <span className="text-ink-950 block truncate text-sm font-bold">{channel.name}</span>
          <span className="text-ink-600 mt-0.5 block truncate text-xs">
            {channel.homeVenueName ? `Usually at ${channel.homeVenueName}` : "No usual building"}
          </span>

          {/* Short words on purpose. Badge sizing cannot be overridden from
              here (cn() is a plain joiner), so two chips fit across a phone's
              text column only if the words are short. */}
          <span className="mt-1.5 flex flex-wrap items-center gap-1">
            {/* A dot AND a word: the state survives a greyscale screen. */}
            {channel.live ? (
              <Badge tone="live" dot>
                Live
              </Badge>
            ) : (
              <Badge tone="neutral" dot>
                No picture
              </Badge>
            )}

            {channel.placedAtThisCourt && <Badge tone="court">At this court</Badge>}
            {channel.placedElsewhere && where && <Badge tone="warning">At {where.short}</Badge>}
            {!channel.placedCourtId && !channel.placedVenueId && <Badge tone="play">Spare</Badge>}
          </span>

          {/* The badge names the spot; this names the consequence, which is the
              part a scorekeeper has to weigh. */}
          {channel.placedElsewhere && where && (
            <span className="text-ink-500 mt-1 block text-[11px] leading-4">
              Standing at {where.full}. Picking it moves it here.
            </span>
          )}
        </span>
      </button>

      {/* Sibling, never nested: a button inside a button is invalid, and this
          one deliberately does NOT select the camera. */}
      {canShowPicture && !playing && (
        <button
          type="button"
          onClick={onShowPicture}
          className="brand-focus text-play-700 hover:bg-play-50 my-2 min-h-[44px] shrink-0 cursor-pointer self-center rounded-xl px-2.5 text-[11.5px] font-semibold leading-4 transition-colors duration-200"
        >
          Show
          <br />
          picture
        </button>
      )}
    </li>
  )
}

/* ── the screen ───────────────────────────────────────────────────────────── */

export function CameraChooser({
  data,
  scope,
  loading,
  busyId,
  error,
  takeover,
  onScopeChange,
  onPick,
  onConfirmTakeover,
  onCancelTakeover,
  onClose,
}: {
  data: CandidatesResponse
  scope: Scope
  loading: boolean
  busyId: string | null
  error: string | null
  takeover: { channelId: string; details: TakeoverDetails } | null
  onScopeChange: (scope: Scope) => void
  onPick: (channelId: string) => void
  onConfirmTakeover: () => void
  onCancelTakeover: () => void
  onClose: () => void
}) {
  const [query, setQuery] = useState("")
  const [needle, setNeedle] = useState("")
  const [rendered, setRendered] = useState(RENDER_STEP)
  const [playing, setPlaying] = useState<string[]>([])
  /** Channels a picture has actually arrived on, whatever the stored stamp says. */
  const [seenLive, setSeenLive] = useState<Record<string, boolean>>({})

  const listRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  /* ── the body behind the screen must not scroll ──────────────────────────
     `overflow: hidden` on the body does not lock iOS Safari, so the page is
     pinned with position:fixed and the scroll position restored on the way
     out (repo lesson, iOS web). */
  useEffect(() => {
    const y = window.scrollY
    const style = document.body.style
    const previous = { position: style.position, top: style.top, width: style.width }
    style.position = "fixed"
    style.top = `-${y}px`
    style.width = "100%"
    return () => {
      style.position = previous.position
      style.top = previous.top
      style.width = previous.width
      window.scrollTo(0, y)
    }
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  // Debounced, never submitted. Typing narrows the list on its own.
  useEffect(() => {
    const timer = setTimeout(() => setNeedle(query.trim().toLowerCase()), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [query])

  const where = data.target.courtName ?? data.target.venueName ?? "this court"
  const buildingName = data.building?.name ?? null

  /**
   * How near a camera is to being the answer, lowest first.
   *
   * Alphabetical order was the first cut and the screenshots killed it: at 28
   * rows the rig standing on this very floor was sixth, and at 200 it would be
   * off the bottom of the phone. The scorekeeper's question is "which rig is
   * pointing at me", so the ones that could be are at the top and the ones in
   * other buildings are last.
   */
  const rank = useCallback(
    (channel: CandidateChannel): number => {
      const buildingId = data.building?.id ?? null
      const unplaced = !channel.placedCourtId && !channel.placedVenueId
      if (channel.placedAtThisCourt) return 0
      if (buildingId && channel.placedVenueId === buildingId) return 1
      if (unplaced && buildingId && channel.homeVenueId === buildingId) return 2
      if (unplaced) return 3
      if (buildingId && channel.homeVenueId === buildingId) return 4
      return 5
    },
    [data.building]
  )

  /**
   * The building filter. In the default scope the server already answered it,
   * so this only bites under "show all", where the fleet arrives and the
   * cameras belonging to this gym are the ones worth seeing first.
   */
  const filtered = useMemo(() => {
    const buildingId = data.building?.id ?? null
    return data.channels
      .filter((channel) => {
        if (needle && !channel.name.toLowerCase().includes(needle)) return false
        if (scope === "all") return true
        if (!buildingId) return true
        return (
          channel.homeVenueId === buildingId ||
          channel.placedVenueId === buildingId ||
          (!channel.placedCourtId && !channel.placedVenueId)
        )
      })
      .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name))
  }, [data.channels, data.building, needle, scope, rank])

  /**
   * The play set: the first few rows that can show a picture, capped. Reset
   * whenever the list underneath changes, so the six pictures are always the
   * six a person is looking at rather than six they scrolled past.
   */
  useEffect(() => {
    setPlaying(
      filtered
        .filter((c) => c.playbackUrl)
        .slice(0, MAX_PLAYING)
        .map((c) => c.id)
    )
    setRendered(RENDER_STEP)
    listRef.current?.scrollTo({ top: 0 })
  }, [filtered])

  const showPicture = useCallback((channelId: string) => {
    setPlaying((current) => {
      if (current.includes(channelId)) return current
      // Oldest out, newest in: the cap is a cost ceiling and never moves.
      return [...current, channelId].slice(-MAX_PLAYING)
    })
  }, [])

  const reportPicture = useCallback((channelId: string, hasPicture: boolean) => {
    setSeenLive((current) =>
      current[channelId] === hasPicture ? current : { ...current, [channelId]: hasPicture }
    )
  }, [])

  // Grow the rendered window as the list is scrolled, so 200 cameras never all
  // hold a DOM node at once.
  useEffect(() => {
    const el = sentinelRef.current
    if (!el || typeof IntersectionObserver === "undefined") return
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setRendered((n) => n + RENDER_STEP)
      },
      { root: listRef.current, rootMargin: "200px" }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [filtered.length])

  const visible = filtered.slice(0, rendered)
  const hidden = filtered.length - visible.length

  const body = (
    <div
      className="bg-ink-950/50 fixed inset-0 z-50 flex items-stretch justify-center backdrop-blur-[2px] sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Choose the camera showing this court"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      {/* Phone: the whole screen. Desktop: a large panel. */}
      <div className="flex h-full w-full flex-col bg-white sm:h-auto sm:max-h-[86vh] sm:max-w-2xl sm:rounded-2xl sm:shadow-xl">
        {/* ── header ── */}
        <div className="border-ink-100 flex items-start gap-3 border-b px-4 py-3">
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-ink-950 text-base font-bold leading-6">
              Choose the camera showing this court
            </h2>
            <p className="text-ink-600 mt-0.5 text-xs leading-5">
              You are scoring <span className="font-semibold">{where}</span>
              {buildingName ? ` at ${buildingName}` : ""}. Pick the rig that is pointing at this
              floor.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close without choosing a camera"
            className="text-ink-500 hover:bg-ink-100 hover:text-ink-900 -mr-1 flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl transition-colors duration-200"
          >
            <CloseGlyph className="h-5 w-5" />
          </button>
        </div>

        {/* ── search + scope ── */}
        <div className="border-ink-100 space-y-2.5 border-b px-4 py-3">
          <div className="relative">
            <label htmlFor="camera-search" className="sr-only">
              Search cameras by name
            </label>
            <span className="text-ink-400 pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">
              <SearchGlyph className="h-4 w-4" />
            </span>
            {/* type="text", not "search": a search input draws the browser's
                OWN clear cross, which sat beside ours and gave the row two
                identical-looking buttons. inputMode keeps the phone keyboard
                right without inheriting the chrome. */}
            <input
              id="camera-search"
              ref={searchRef}
              type="text"
              inputMode="search"
              enterKeyHint="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by camera name"
              autoComplete="off"
              className="border-ink-200 text-ink-900 placeholder:text-ink-400 focus:ring-play-200 focus:border-play-300 min-h-[44px] w-full rounded-xl border bg-white pl-9 pr-10 text-sm transition focus:outline-none focus:ring-2"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery("")
                  searchRef.current?.focus()
                }}
                aria-label="Clear the search"
                className="text-ink-400 hover:text-ink-800 absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg transition-colors duration-200"
              >
                <CloseGlyph className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Two states, said in words, with the count so nobody taps blind. */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onScopeChange("here")}
              aria-pressed={scope === "here"}
              className={`min-h-[36px] cursor-pointer rounded-full border px-3 text-xs font-semibold transition-colors duration-200 ${
                scope === "here"
                  ? "border-play-300 bg-play-50 text-play-800"
                  : "border-ink-200 text-ink-600 hover:bg-ink-50 bg-white"
              }`}
            >
              {buildingName ? `At ${buildingName}` : "Cameras that could be here"}
            </button>
            <button
              type="button"
              onClick={() => onScopeChange("all")}
              aria-pressed={scope === "all"}
              className={`min-h-[36px] cursor-pointer rounded-full border px-3 text-xs font-semibold transition-colors duration-200 ${
                scope === "all"
                  ? "border-play-300 bg-play-50 text-play-800"
                  : "border-ink-200 text-ink-600 hover:bg-ink-50 bg-white"
              }`}
            >
              {scope === "all" || !data.fleetCount
                ? "All cameras"
                : `Show all ${data.fleetCount} cameras`}
            </button>
            {loading && (
              <span className="text-ink-500 text-[11px]" role="status">
                Loading…
              </span>
            )}
          </div>

          {scope === "all" && (
            <p className="border-ink-100 bg-ink-50 text-ink-600 rounded-lg border px-2.5 py-1.5 text-[11px] leading-4">
              Cameras in other buildings are listed by name only. There is no picture from a gym you
              are not standing in, so find yours by name and it will move here.
            </p>
          )}
        </div>

        {error && (
          <p
            role="alert"
            className="border-b border-red-100 bg-red-50 px-4 py-2 text-xs font-semibold leading-5 text-red-800"
          >
            {error}
          </p>
        )}

        {/* ── the list ── */}
        <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-2 py-1">
          {visible.length > 0 ? (
            <>
              <ul>
                {visible.map((channel) => (
                  <CameraRow
                    key={channel.id}
                    channel={{
                      ...channel,
                      // A frame on screen beats a stale stamp, in both directions.
                      live: seenLive[channel.id] ?? channel.live,
                    }}
                    playing={playing.includes(channel.id)}
                    busy={busyId === channel.id}
                    disabled={busyId !== null}
                    onPick={() => onPick(channel.id)}
                    onShowPicture={() => showPicture(channel.id)}
                    onPicture={(hasPicture) => reportPicture(channel.id, hasPicture)}
                  />
                ))}
              </ul>
              <div ref={sentinelRef} className="h-1" />
              {hidden > 0 && (
                <p className="text-ink-500 py-3 text-center text-xs">
                  {hidden} more {hidden === 1 ? "camera" : "cameras"} below. Keep scrolling, or
                  search by name.
                </p>
              )}
            </>
          ) : (
            /* Never a dead end: every empty state carries the next move. */
            <div className="px-4 py-10 text-center">
              <p className="text-ink-900 text-sm font-semibold">
                {data.channels.length === 0
                  ? "No cameras are set up yet"
                  : needle
                    ? "No camera matches that name"
                    : "No cameras in this building yet"}
              </p>
              <p className="text-ink-600 mx-auto mt-1.5 max-w-sm text-xs leading-5">
                {data.channels.length === 0
                  ? "A camera has to be added by an admin before a game can be broadcast. Nothing else on this page is affected."
                  : scope === "here"
                    ? "The rig may have been carried in from another gym, in which case it is still tagged to where it usually lives."
                    : "Check the name on the sticker on the tripod. That is the name the camera is saved under."}
              </p>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                {scope === "here" && data.channels.length > 0 && (
                  <Button size="sm" tone="play" onClick={() => onScopeChange("all")}>
                    {data.fleetCount ? `Search all ${data.fleetCount} cameras` : "Search all cameras"}
                  </Button>
                )}
                {needle && (
                  <Button size="sm" variant="subtle" onClick={() => setQuery("")}>
                    Clear the search
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── footer: says what the cap is, because six of a hundred is a choice ── */}
        <div className="border-ink-100 bg-ink-50/60 flex items-center justify-between gap-3 border-t px-4 py-2.5">
          <p className="text-ink-500 text-[11px] leading-4">
            {filtered.length} {filtered.length === 1 ? "camera" : "cameras"} listed. Up to{" "}
            {MAX_PLAYING} pictures play at once to keep the data use down.
          </p>
          <Button size="sm" variant="subtle" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>

      {/* ── the take-over confirm, inside the screen it was raised from ── */}
      {takeover && (
        <div className="bg-ink-950/60 absolute inset-0 z-10 flex items-end justify-center p-4 sm:items-center">
          <div className="border-ink-100 w-full max-w-md rounded-2xl border bg-white p-4 shadow-xl">
            <h3 className="font-display text-ink-950 text-base font-bold">
              {takeover.details.channelName} is showing a live game
            </h3>
            <div className="mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-red-700">
                Goes dark
              </div>
              <div className="mt-0.5 text-sm font-semibold text-red-900">
                {takeover.details.matchup ?? "A live game"}
              </div>
              <div className="mt-0.5 text-xs leading-5 text-red-800">
                {takeover.details.courtName ?? "Another court"}
                {takeover.details.venueName ? `, ${takeover.details.venueName}` : ""}
              </div>
            </div>
            <p className="text-ink-700 mt-3 text-xs leading-5">
              Taking this camera leaves that game with no picture, and the move goes on the record
              with your name against it. If the rig has not physically moved yet, leave it alone.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button tone="hoop" disabled={busyId !== null} onClick={onConfirmTakeover}>
                {busyId ? "Moving…" : "Take it anyway"}
              </Button>
              <Button variant="subtle" onClick={onCancelTakeover}>
                Leave it alone
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  if (typeof document === "undefined") return null
  return createPortal(body, document.body)
}
