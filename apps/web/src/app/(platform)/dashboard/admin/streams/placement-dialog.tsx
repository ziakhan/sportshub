"use client"

import { useMemo, useState } from "react"
import { Badge, BrandListbox, Button } from "@/components/ui"
import { ErrorStrip, Modal, PinIcon, TextField, gameTimeLabel } from "./bits"
import type { Channel, PlacementTarget, StreamOpsVenue, TakeoverConflict } from "./types"

/**
 * Move a camera to a court.
 *
 * ── WHY A PICKER AND NOT DRAG ─────────────────────────────────────────────
 * The plan says "drag cameras between courts from the office". Dragging is a
 * fine metaphor and a poor mechanism here. This action happens a handful of
 * times a day, it is destructive when it lands wrong (a take-over pulls the
 * picture off somebody else's live game), and the office admin doing it is
 * often remote from the gym. A drag has no confirm step, no keyboard path, no
 * touch story on the tablet an ops person actually holds, and its whole
 * advantage — speed on a repeated action — is worth nothing at four moves a
 * day. So: pick the building, pick the court, read the sentence, confirm.
 *
 * The court list carries what a person needs to pick correctly: how many games
 * that court has today, and whether another rig is already standing there.
 */

/** A building placement covers court-less games only, so it is offered plainly. */
const BUILDING_VALUE = "__venue__"

export function PlacementDialog({
  channel,
  venues,
  busy,
  error,
  onCancel,
  onPlace,
}: {
  channel: Channel
  venues: StreamOpsVenue[]
  busy: boolean
  error: string | null
  onCancel: () => void
  onPlace: (target: PlacementTarget) => void
}) {
  const currentVenueId = channel.currentCourt?.venue.id ?? channel.currentVenue?.id ?? ""
  const [venueId, setVenueId] = useState(currentVenueId)
  const [courtId, setCourtId] = useState(channel.currentCourtId ?? "")
  const [filter, setFilter] = useState("")

  const filtered = useMemo(() => {
    const needle = filter.trim().toLowerCase()
    if (!needle) return venues
    return venues.filter(
      (v) =>
        v.name.toLowerCase().includes(needle) || (v.city ?? "").toLowerCase().includes(needle)
    )
  }, [venues, filter])

  const venueOptions = useMemo(
    () => [
      { value: "", label: "Choose a building…" },
      ...filtered.map((v) => ({
        value: v.id,
        label: `${v.name}${v.city ? ` (${v.city})` : ""}`,
      })),
    ],
    [filtered]
  )

  const venue = venues.find((v) => v.id === venueId) ?? null
  const courts = venue?.courts ?? []

  const target: PlacementTarget | null = useMemo(() => {
    if (!venue) return null
    if (courtId === BUILDING_VALUE) {
      return { venueId: venue.id, label: venue.name }
    }
    const court = venue.courts.find((c) => c.id === courtId)
    if (!court) return null
    return { courtId: court.id, label: `${court.name}, ${venue.name}` }
  }, [venue, courtId])

  const occupant =
    courtId === BUILDING_VALUE
      ? venue?.channelName
      : courts.find((c) => c.id === courtId)?.channelName
  const occupiedByOther = occupant && occupant !== channel.name ? occupant : null

  const alreadyHere =
    (target?.courtId && target.courtId === channel.currentCourtId) ||
    (target?.venueId && target.venueId === channel.currentVenueId)

  return (
    <Modal
      title={`Where is ${channel.name} standing?`}
      subtitle="Pick the floor the rig is physically pointing at. Today's games there start using it straight away."
      onClose={onCancel}
      footer={
        <>
          <Button variant="subtle" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button
            tone="play"
            disabled={busy || !target || !!alreadyHere}
            onClick={() => target && onPlace(target)}
            title={alreadyHere ? "That is where this camera already is" : undefined}
          >
            {busy ? "Moving…" : "Move camera here"}
          </Button>
        </>
      }
    >
      {error && <ErrorStrip>{error}</ErrorStrip>}

      <div className="border-ink-100 bg-ink-50/60 mb-4 rounded-xl border px-3 py-2 text-xs leading-5">
        <span className="text-ink-500 font-semibold uppercase tracking-[0.14em]">Right now</span>
        <div className="text-ink-800 mt-0.5 flex items-center gap-1.5 font-medium">
          <span className="text-play-600 [&>svg]:h-3.5 [&>svg]:w-3.5">
            <PinIcon />
          </span>
          {channel.currentCourt
            ? `${channel.currentCourt.name}, ${channel.currentCourt.venue.name}`
            : (channel.currentVenue?.name ?? "Not placed anywhere")}
        </div>
      </div>

      {venues.length === 0 ? (
        <div className="border-ink-200 rounded-xl border border-dashed px-4 py-8 text-center">
          <p className="text-ink-800 text-sm font-semibold">No buildings to send it to</p>
          <p className="text-ink-600 mx-auto mt-1 max-w-sm text-xs leading-5">
            This list holds the venues with games in the next seven days. Publish a schedule with a
            venue on it, then come back and place the camera.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <TextField
            label="Find a building"
            value={filter}
            onChange={setFilter}
            placeholder="Name or town"
            hint="Buildings with games in the next seven days."
          />

          <div>
            <span className="text-ink-700 text-xs font-semibold">Building</span>
            <div className="mt-1">
              <BrandListbox
                ariaLabel="Building"
                value={venueId}
                onChange={(value) => {
                  setVenueId(value)
                  setCourtId("")
                }}
                options={venueOptions}
              />
            </div>
            {filtered.length === 0 && (
              <p className="text-ink-500 mt-1 text-[11px]">
                Nothing matches that. Clear the search to see them all.
              </p>
            )}
          </div>

          {venue && (
            <fieldset>
              <legend className="text-ink-700 text-xs font-semibold">Court</legend>
              <div className="mt-2 space-y-2">
                {courts.map((court) => {
                  const chosen = courtId === court.id
                  const here = court.channelName === channel.name
                  return (
                    <button
                      key={court.id}
                      type="button"
                      onClick={() => setCourtId(court.id)}
                      aria-pressed={chosen}
                      className={`flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors duration-200 ${
                        chosen
                          ? "border-play-300 bg-play-50"
                          : "border-ink-200 bg-white hover:border-ink-300 hover:bg-ink-50"
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="text-ink-950 block text-sm font-semibold">{court.name}</span>
                        <span className="text-ink-600 block text-xs">
                          {court.gamesToday === 0
                            ? "No games today"
                            : `${court.gamesToday} ${court.gamesToday === 1 ? "game" : "games"} today`}
                        </span>
                      </span>
                      {court.channelName && (
                        <Badge tone={here ? "play" : "warning"}>
                          {here ? "This camera" : court.channelName}
                        </Badge>
                      )}
                    </button>
                  )
                })}

                <button
                  type="button"
                  onClick={() => setCourtId(BUILDING_VALUE)}
                  aria-pressed={courtId === BUILDING_VALUE}
                  className={`flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors duration-200 ${
                    courtId === BUILDING_VALUE
                      ? "border-play-300 bg-play-50"
                      : "border-ink-200 bg-white hover:border-ink-300 hover:bg-ink-50"
                  }`}
                >
                  <span className="min-w-0">
                    <span className="text-ink-950 block text-sm font-semibold">
                      The building itself
                    </span>
                    <span className="text-ink-600 block text-xs">
                      For single-court gyms. Covers games that name no court
                      {venue.gamesToday > 0 ? `, ${venue.gamesToday} today` : ""}.
                    </span>
                  </span>
                  {venue.channelName && (
                    <Badge tone={venue.channelName === channel.name ? "play" : "warning"}>
                      {venue.channelName === channel.name ? "This camera" : venue.channelName}
                    </Badge>
                  )}
                </button>

                {courts.length === 0 && (
                  <p className="text-ink-500 text-xs leading-5">
                    This building has no numbered courts on file, so the building itself is the
                    right choice.
                  </p>
                )}
              </div>
            </fieldset>
          )}

          {target && (
            <p className="text-ink-700 border-ink-100 bg-ink-50/60 rounded-xl border px-3 py-2 text-sm leading-6">
              {alreadyHere ? (
                <>
                  {channel.name} is already at <strong>{target.label}</strong>. Pick a different
                  floor to move it.
                </>
              ) : (
                <>
                  {channel.name} moves to <strong>{target.label}</strong>
                  {occupiedByOther ? (
                    <>
                      {" "}
                      where <strong>{occupiedByOther}</strong> is also standing. Two rigs on one
                      floor makes the mapping flap, so move the other one after this.
                    </>
                  ) : (
                    "."
                  )}
                </>
              )}
            </p>
          )}
        </div>
      )}
    </Modal>
  )
}

/**
 * The take-over confirm.
 *
 * Reached only from a typed TAKEOVER_REQUIRED refusal, which carries the other
 * court's live game with it — so this dialog never says "conflict", it says
 * which court, which building and which matchup goes dark, because someone's
 * family is watching that game right now.
 */
export function TakeoverDialog({
  channel,
  target,
  conflict,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  channel: Channel
  target: PlacementTarget
  conflict: TakeoverConflict
  busy: boolean
  error: string | null
  onCancel: () => void
  onConfirm: () => void
}) {
  const where = conflict.courtName
    ? `${conflict.courtName}${conflict.venueName ? `, ${conflict.venueName}` : ""}`
    : (conflict.venueName ?? "another court")

  return (
    <Modal
      title={`${channel.name} is showing a live game`}
      subtitle="Moving it now takes the picture away from the people watching that one."
      onClose={onCancel}
      footer={
        <>
          <Button variant="subtle" onClick={onCancel} disabled={busy}>
            Leave it where it is
          </Button>
          <Button tone="hoop" disabled={busy} onClick={onConfirm}>
            {busy ? "Moving…" : "Take it anyway"}
          </Button>
        </>
      }
    >
      {error && <ErrorStrip>{error}</ErrorStrip>}

      <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-red-700">
          Goes dark
        </div>
        <div className="mt-0.5 text-sm font-semibold text-red-900">
          {conflict.matchup ?? "A live game"}
        </div>
        <div className="mt-0.5 text-xs leading-5 text-red-800">
          {where} · started {gameTimeLabel(conflict.scheduledAt)}
        </div>
      </div>

      <p className="text-ink-700 mt-4 text-sm leading-6">
        {channel.name} would move to <strong>{target.label}</strong>. The game above loses its
        picture the moment you confirm, and the move goes on the record with your name against it.
      </p>
      <p className="text-ink-600 mt-2 text-sm leading-6">
        If the rig has not physically moved yet, close this and move the camera first.
      </p>
    </Modal>
  )
}
