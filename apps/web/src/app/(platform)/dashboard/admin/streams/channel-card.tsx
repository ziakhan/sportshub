"use client"

import { useState } from "react"
import { Badge, Button, Card } from "@/components/ui"
import { isSignalFresh } from "@/lib/streaming/health"
import { StreamPreview } from "./preview-tile"
import { CopyField, PinIcon, SignalIcon, agoLabel, gameTimeLabel } from "./bits"
import type { Channel, ChannelHealth, StreamOpsGame, StreamOpsSchedule } from "./types"

/**
 * One camera rig, as an operator sees it.
 *
 * Card order is the order the game-day runbook asks the questions in:
 *
 *   1. picture     — is anything coming out of this rig?
 *   2. signal      — and does the probe agree?
 *   3. placement   — where is it standing, and who put it there?
 *   4. now / next  — what is it showing, and what is coming?
 *   5. connection  — the vendor pair, folded away until someone needs it
 *
 * The one state the runbook singles out — "a red channel with a game in
 * window is the only thing needing a human" — gets the whole card's frame,
 * not a badge, because it is the reason to look at this page at all.
 */

function GameLine({ game, now, eyebrow }: { game: StreamOpsGame | null; now: Date; eyebrow: string }) {
  return (
    <div className="min-w-0">
      <div className="text-ink-500 text-[11px] font-semibold uppercase tracking-[0.14em]">
        {eyebrow}
      </div>
      {game ? (
        <>
          {/* Two lines rather than an ellipsis: a half-named matchup is the one
              thing on this card an operator cannot guess from context. */}
          <div className="text-ink-900 line-clamp-2 text-sm font-medium leading-5" title={game.matchup}>
            {game.matchup}
          </div>
          <div className="text-ink-500 truncate text-xs">
            {gameTimeLabel(game.scheduledAt, now)}
            {game.courtName ? ` · ${game.courtName}` : ""}
            {game.source === "MANUAL" ? " · pinned by hand" : ""}
          </div>
        </>
      ) : (
        <div className="text-ink-400 text-sm">Nothing</div>
      )}
    </div>
  )
}

export function ChannelCard({
  channel,
  schedule,
  health,
  placedByName,
  sharingWith,
  now,
  busy,
  checking,
  onCheckSignal,
  onMove,
  onEdit,
  onToggleStatus,
}: {
  channel: Channel
  schedule: StreamOpsSchedule | undefined
  health: ChannelHealth | undefined
  placedByName: string | undefined
  /** Other active rigs standing at exactly this spot. Normally empty. */
  sharingWith: string[]
  now: Date
  busy: boolean
  checking: boolean
  onCheckSignal: () => void
  onMove: () => void
  onEdit: () => void
  onToggleStatus: () => void
}) {
  const [showConnection, setShowConnection] = useState(false)

  const disabled = channel.status === "DISABLED"
  const lastSeen = health?.lastSeenLiveAt ?? channel.lastSeenLiveAt
  // Green means "a picture was there a moment ago" — either this probe saw one,
  // or the stamp is still inside the freshness window. A single missed probe
  // must not paint a working rig red.
  const live = !disabled && (health?.live === true || isSignalFresh(lastSeen, now))
  const nowPlaying = schedule?.nowPlaying ?? null
  const needsAttention = !disabled && !live && !!nowPlaying

  const placement = channel.currentCourt
    ? `${channel.currentCourt.name}, ${channel.currentCourt.venue.name}`
    : (channel.currentVenue?.name ?? null)

  return (
    <Card
      size="sm"
      className={`flex flex-col gap-3 ${
        needsAttention ? "border-red-300 ring-1 ring-red-200" : ""
      }`}
    >
      <StreamPreview playbackUrl={channel.playbackUrl} label={channel.name} disabled={disabled} />

      {/* 1. Identity + state */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-display text-ink-950 truncate text-base font-bold">{channel.name}</h3>
          <p className="text-ink-500 truncate text-xs">
            {channel.provider ? channel.provider : "No vendor noted"}
          </p>
        </div>
        <Badge tone={disabled ? "neutral" : "court"}>{disabled ? "Disabled" : "Active"}</Badge>
      </div>

      {/* 2. Signal health */}
      <div
        className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 ${
          disabled
            ? "border-ink-200 bg-ink-50"
            : live
              ? "border-court-100 bg-court-50"
              : "border-red-200 bg-red-50"
        }`}
      >
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full [&>svg]:h-3.5 [&>svg]:w-3.5 ${
              disabled
                ? "bg-ink-200 text-ink-600"
                : live
                  ? "bg-court-600 text-white"
                  : "bg-red-600 text-white"
            }`}
          >
            <SignalIcon />
          </span>
          <div className="min-w-0">
            <div
              className={`truncate text-sm font-semibold ${
                disabled ? "text-ink-700" : live ? "text-court-800" : "text-red-800"
              }`}
            >
              {disabled ? "Turned off" : live ? "Signal live" : "No signal"}
            </div>
            <div
              className={`text-xs leading-4 ${disabled ? "text-ink-500" : live ? "text-court-700" : "text-red-700"}`}
            >
              {disabled
                ? "This camera shows nothing anywhere"
                : live
                  ? `Picture seen ${agoLabel(lastSeen, now)}`
                  : (health?.detail ?? `Last picture ${agoLabel(lastSeen, now)}`)}
            </div>
          </div>
        </div>
        <Button
          size="sm"
          variant="subtle"
          disabled={checking || disabled}
          onClick={onCheckSignal}
          title={disabled ? "Enable this camera before checking its signal" : undefined}
        >
          {checking ? "Checking…" : "Check"}
        </Button>
      </div>

      {needsAttention && (
        <p className="rounded-xl border border-red-200 bg-white px-3 py-2 text-xs leading-5 text-red-800">
          <strong>This one needs a person.</strong> A game is in its window and no picture is coming
          out, so families on that game&apos;s page are looking at nothing.
        </p>
      )}

      {/* 3. Placement */}
      <div className="border-ink-100 rounded-xl border px-3 py-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-ink-500 text-[11px] font-semibold uppercase tracking-[0.14em]">
              Standing at
            </div>
            {placement ? (
              <div className="flex items-start gap-1.5" title={placement}>
                <span className="text-play-600 mt-0.5 shrink-0 [&>svg]:h-3.5 [&>svg]:w-3.5">
                  <PinIcon />
                </span>
                <span className="min-w-0">
                  <span className="text-ink-900 block text-sm font-medium">
                    {channel.currentCourt?.name ?? channel.currentVenue?.name}
                  </span>
                  {channel.currentCourt && (
                    <span className="text-ink-600 block text-xs leading-4">
                      {channel.currentCourt.venue.name}
                    </span>
                  )}
                </span>
              </div>
            ) : (
              <div className="text-ink-500 text-sm">Not placed anywhere yet</div>
            )}
            <div className="text-ink-500 mt-0.5 text-xs">
              {channel.placedAt
                ? `${placedByName ?? "Someone"} confirmed it ${agoLabel(channel.placedAt, now)}`
                : "Place it at a court and today's games there pick it up"}
            </div>
          </div>
          <Button size="sm" variant="secondary" tone="play" disabled={busy || disabled} onClick={onMove}>
            {placement ? "Move" : "Place"}
          </Button>
        </div>
      </div>

      {/* Two rigs at one spot is the assigner's SHARED_PLACEMENT warning, said
          here instead of in a log: whichever ran last owns the games, so the
          mapping flips between them until someone moves one. */}
      {sharingWith.length > 0 && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
          {sharingWith.join(" and ")} {sharingWith.length === 1 ? "is" : "are"} standing here too.
          Only one rig can show a court&apos;s games, so move one of them.
        </p>
      )}

      {/* 4. What it is showing */}
      <div className="grid grid-cols-2 gap-3">
        <GameLine game={nowPlaying} now={now} eyebrow="Now playing" />
        <GameLine game={schedule?.upNext ?? null} now={now} eyebrow="Up next" />
      </div>
      {schedule?.todayCount ? (
        <p className="text-ink-500 -mt-1 text-xs">
          {schedule.todayCount} {schedule.todayCount === 1 ? "game" : "games"} mapped to this camera
          today.
        </p>
      ) : (
        <p className="text-ink-500 -mt-1 text-xs">No games mapped to this camera today.</p>
      )}

      {/* 5. The vendor pair */}
      <div className="border-ink-100 border-t pt-3">
        <button
          type="button"
          onClick={() => setShowConnection((v) => !v)}
          aria-expanded={showConnection}
          className="text-ink-600 hover:text-ink-900 flex w-full cursor-pointer items-center justify-between gap-2 text-xs font-semibold transition"
        >
          Connection details
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className={`h-4 w-4 transition-transform duration-200 ${showConnection ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
        {showConnection && (
          <div className="mt-3 space-y-3">
            <CopyField label="Ingest URL" value={channel.ingestUrl} />
            <CopyField
              label="Stream key"
              value={channel.streamKey}
              secret
              hint="Anyone holding this pair can push their own picture onto a game page. Read it out only to the person setting up this rig."
            />
            <CopyField label="Playback URL" value={channel.playbackUrl} />
            {channel.notes && <p className="text-ink-600 text-xs leading-5">{channel.notes}</p>}
          </div>
        )}
      </div>

      {/* Pinned to the bottom so a short card and a tall one line up in a row. */}
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
        <Button size="sm" variant="subtle" disabled={busy} onClick={onEdit}>
          Edit
        </Button>
        <Button
          size="sm"
          variant="subtle"
          disabled={busy}
          onClick={onToggleStatus}
          title={
            disabled
              ? "Bring this camera back into service"
              : "Takes this camera dark on every game page at once"
          }
        >
          {disabled ? "Enable" : "Disable"}
        </Button>
      </div>
    </Card>
  )
}
