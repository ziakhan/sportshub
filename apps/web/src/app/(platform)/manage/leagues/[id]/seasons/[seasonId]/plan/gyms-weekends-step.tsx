"use client"

import { useCallback, useEffect, useState } from "react"
import { Button, DateTimePicker } from "@/components/ui"
import { VenueEditor } from "@/components/venue-editor"
import { VenueSelector } from "@/components/venue-selector"
import type { VenueGrid, VenueGridCell, VenueGridRow } from "@/lib/seasons/venue-grid"

/**
 * Step 2, gyms and weekends (owner-approved mock, 2026-08-02). Not a form:
 * the gyms the league already uses are on the card with their courts, hours
 * and every weekend of the season selectable.
 *
 * The rule the screen is built around: EVERY weekend starts available. We
 * never pre-mark a gym unavailable — the operator releases what they do not
 * have, because they are the ones who know. A one-weekend hours exception is
 * edited on the cell itself; the season-wide window is edited on the card.
 */

const CELL_CLS: Record<VenueGridCell["state"], string> = {
  on: "border-court-200 bg-court-50 text-court-800 hover:border-court-400",
  off: "border-ink-200 border-dashed bg-ink-50 text-ink-400 hover:border-ink-400",
  custom: "border-gold-200 bg-gold-50 text-gold-800 hover:border-gold-400",
}

interface Selection {
  venueId: string
  sessionId: string
}

export function GymsWeekendsStep({
  seasonId,
  onLoaded,
}: {
  seasonId: string
  onLoaded?: (grid: VenueGrid) => void
}) {
  const [grid, setGrid] = useState<VenueGrid | null>(null)
  const [locked, setLocked] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Selection | null>(null)
  const [draft, setDraft] = useState<{ start: string; end: string }>({ start: "", end: "" })
  const [editingHours, setEditingHours] = useState<string | null>(null)
  const [addingGym, setAddingGym] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(`/api/seasons/${seasonId}/planner/venues`).catch(() => null)
    if (!res?.ok) {
      setError("Couldn't load your gyms")
      return
    }
    const data = await res.json()
    setGrid(data.grid)
    setLocked(["FINALIZED", "IN_PROGRESS", "COMPLETED"].includes(data.seasonStatus))
    onLoaded?.(data.grid)
  }, [seasonId, onLoaded])

  useEffect(() => {
    load()
  }, [load])

  const call = async (url: string, init: RequestInit, key: string, success: string) => {
    setBusy(key)
    setError(null)
    setNotice(null)
    const res = await fetch(url, init).catch(() => null)
    setBusy(null)
    if (!res?.ok) {
      const data = await res?.json().catch(() => null)
      setError(data?.error ?? "That didn't save. Try again.")
      return false
    }
    setNotice(success)
    await load()
    return true
  }

  const toggleCell = async (venue: VenueGridRow, cell: VenueGridCell, weekendLabel: string) => {
    const key = `${venue.venueId}:${cell.sessionId}`
    const base = `/api/seasons/${seasonId}/sessions/${cell.sessionId}/venues/${venue.venueId}`
    if (cell.state === "off") {
      await call(base, { method: "POST" }, key, `${venue.name} is on for ${weekendLabel}.`)
    } else {
      await call(base, { method: "DELETE" }, key, `${venue.name} released for ${weekendLabel}.`)
    }
  }

  const saveCellHours = async (venue: VenueGridRow, cell: VenueGridCell, weekendLabel: string) => {
    if (!draft.start || !draft.end) {
      setError("Set both a start and an end time.")
      return
    }
    const key = `${venue.venueId}:${cell.sessionId}:hours`
    const ok = await call(
      `/api/seasons/${seasonId}/sessions/${cell.sessionId}/venues/${venue.venueId}/hours`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startTime: draft.start, endTime: draft.end }),
      },
      key,
      `${weekendLabel} at ${venue.name} now runs ${draft.start} to ${draft.end}. Every other weekend keeps the season default.`
    )
    if (ok) setSelected(null)
  }

  const resetCellHours = async (venue: VenueGridRow, cell: VenueGridCell, weekendLabel: string) => {
    const key = `${venue.venueId}:${cell.sessionId}:reset`
    const ok = await call(
      `/api/seasons/${seasonId}/sessions/${cell.sessionId}/venues/${venue.venueId}/hours`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reset: true }),
      },
      key,
      `${weekendLabel} is back on the season default.`
    )
    if (ok) setSelected(null)
  }

  if (!grid) {
    return (
      <p className="text-ink-500 p-6 text-sm">{error ?? "Loading your gyms…"}</p>
    )
  }

  const weekends = grid.weekends

  return (
    <div className="border-ink-100 shadow-soft overflow-hidden rounded-2xl border bg-white">
      {/* Screen head */}
      <div className="border-ink-100 flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
        <div>
          <p className="text-ink-900 text-[15px] font-bold">Gym time</p>
          <p className="text-ink-500 text-xs">
            Pre-filled from last season. Tap only what changed.
          </p>
        </div>
        <span className="border-ink-100 bg-ink-50 text-ink-500 rounded-full border px-2.5 py-0.5 text-[11px] font-bold">
          Step 2 of 5
        </span>
      </div>

      <div className="p-5">
        {locked && (
          <p className="border-gold-200 bg-gold-50 text-gold-900 mb-4 rounded-xl border px-4 py-2.5 text-sm">
            This season is finalized, so gyms and weekends are read only now.
          </p>
        )}
        {error && (
          <p className="border-hoop-200 bg-hoop-50 text-hoop-900 mb-4 rounded-xl border px-4 py-2.5 text-sm">
            {error}
          </p>
        )}
        {notice && !error && (
          <p className="border-court-200 bg-court-50 text-court-900 mb-4 rounded-xl border px-4 py-2.5 text-sm">
            {notice}
          </p>
        )}

        {weekends.length === 0 && (
          <p className="border-ink-200 text-ink-500 rounded-xl border border-dashed px-4 py-6 text-center text-sm">
            This season has no weekends yet. Add sessions first and they will show up here as
            columns.
          </p>
        )}

        {grid.venues.length === 0 && weekends.length > 0 && (
          <p className="border-ink-200 text-ink-500 rounded-xl border border-dashed px-4 py-6 text-center text-sm">
            No gyms on this season yet. Add the first one below and every weekend starts
            available.
          </p>
        )}

        {/* One card per gym: the WHOLE venue model for this season. */}
        {grid.venues.map((venue) => (
          <div key={venue.seasonVenueId} className="border-ink-100 mb-3.5 rounded-2xl border p-4">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
              <span className="text-ink-900 text-[15px] font-bold">
                {venue.name}
                {venue.city ? ` · ${venue.city}` : ""}
              </span>
              {venue.isPrimary && (
                <span className="border-court-200 bg-court-50 text-court-800 rounded-full border px-2.5 py-0.5 text-[11px] font-bold">
                  Home gym
                </span>
              )}
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="border-ink-100 bg-ink-50 text-ink-700 rounded-lg border px-2.5 py-1 text-xs">
                <b className="text-ink-900">{venue.courtsAvailable ?? venue.courtCount}</b> courts
              </span>
              {venue.defaultWindowLabel && (
                <span className="border-ink-100 bg-ink-50 text-ink-700 rounded-lg border px-2.5 py-1 text-xs">
                  {venue.defaultWindowLabel}
                </span>
              )}
              <button
                type="button"
                onClick={() =>
                  setEditingHours(editingHours === venue.seasonVenueId ? null : venue.seasonVenueId)
                }
                className="border-ink-100 bg-ink-50 text-play-700 hover:bg-ink-100 rounded-lg border px-2.5 py-1 text-xs font-semibold"
              >
                {editingHours === venue.seasonVenueId ? "Close hours" : "Edit hours"}
              </button>
            </div>

            {/* Season-wide hours: the card, not the cell. */}
            {editingHours === venue.seasonVenueId && (
              <div className="border-ink-100 bg-ink-50/60 mt-3 rounded-xl border p-3">
                <p className="text-ink-500 mb-3 text-xs">
                  These are the season&apos;s hours at this gym, used for every weekend. For a
                  single weekend that runs long, tap that cell instead.
                </p>
                <VenueEditor
                  venueId={venue.venueId}
                  venueName={venue.name}
                  courts={venue.courts}
                  hours={venue.defaultHours}
                  hoursEndpoint={`/api/seasons/${seasonId}/venues/${venue.seasonVenueId}/hours`}
                  hoursLabel="This season's hours here"
                  referenceHours={venue.postedHours}
                  referenceLabel="The gym's posted hours"
                  onChange={load}
                />
              </div>
            )}

            {/* The weekend grid: a column per weekend, a cell per state. */}
            <div className="mt-3 overflow-x-auto pb-1">
              <table className="border-separate border-spacing-1">
                <thead>
                  <tr>
                    {weekends.map((w) => (
                      <th
                        key={w.sessionId}
                        scope="col"
                        className="text-ink-500 px-1 pb-1 text-center text-[10.5px] font-bold uppercase tracking-wide"
                      >
                        {w.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    {venue.cells.map((cell, i) => {
                      const w = weekends[i]
                      const key = `${venue.venueId}:${cell.sessionId}`
                      const isSelected =
                        selected?.venueId === venue.venueId && selected?.sessionId === cell.sessionId
                      return (
                        <td key={cell.sessionId} className="p-0 align-top">
                          <button
                            type="button"
                            disabled={locked || busy !== null}
                            onClick={() => {
                              setSelected(isSelected ? null : { venueId: venue.venueId, sessionId: cell.sessionId })
                              setDraft({ start: cell.startTime ?? "", end: cell.endTime ?? "" })
                              setNotice(null)
                              setError(null)
                            }}
                            aria-pressed={cell.state !== "off"}
                            aria-label={`${venue.name}, ${w?.label ?? "weekend"}: ${
                              cell.state === "off"
                                ? "released"
                                : cell.state === "custom"
                                  ? `custom hours ${cell.startTime} to ${cell.endTime}`
                                  : "available"
                            }`}
                            className={`min-h-[44px] w-[76px] rounded-lg border px-1 text-[10.5px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                              CELL_CLS[cell.state]
                            } ${isSelected ? "ring-play-500 ring-2 ring-offset-1" : ""}`}
                          >
                            {busy === key ? (
                              "…"
                            ) : cell.state === "off" ? (
                              "Released"
                            ) : cell.state === "custom" ? (
                              <span className="block leading-tight">{cell.hoursLabel ?? "Custom"}</span>
                            ) : (
                              "Yes"
                            )}
                            {cell.state !== "off" && cell.daysOn < cell.dayCount && (
                              <span className="text-ink-400 block text-[9px] font-semibold">
                                {cell.daysOn} of {cell.dayCount} days
                              </span>
                            )}
                          </button>
                        </td>
                      )
                    })}
                  </tr>
                </tbody>
              </table>
            </div>

            {/* The one-weekend editor, on the cell — never a settings page. */}
            {selected?.venueId === venue.venueId &&
              (() => {
                const idx = venue.cells.findIndex((c) => c.sessionId === selected.sessionId)
                if (idx < 0) return null
                const cell = venue.cells[idx]
                const label = weekends[idx]?.label ?? "this weekend"
                return (
                  <div className="border-ink-100 bg-ink-50/60 mt-3 rounded-xl border p-3">
                    <p className="text-ink-900 text-sm font-bold">
                      {label} · {venue.name}
                    </p>
                    {cell.state === "off" ? (
                      <>
                        <p className="text-ink-500 mt-1 text-xs">
                          You released this weekend. Put the gym back on and it picks up the
                          season&apos;s hours again.
                        </p>
                        <Button
                          size="sm"
                          tone="court"
                          className="mt-3"
                          disabled={locked || busy !== null}
                          onClick={() => toggleCell(venue, cell, label)}
                        >
                          Use this gym this weekend
                        </Button>
                      </>
                    ) : (
                      <>
                        <p className="text-ink-500 mt-1 text-xs">
                          Hours for this weekend only. The season&apos;s default stays exactly as
                          it is.
                        </p>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <DateTimePicker
                            mode="time"
                            value={draft.start}
                            onChange={(v) => setDraft((d) => ({ ...d, start: v }))}
                            className="w-28"
                            placeholder="Start"
                          />
                          <span className="text-ink-400 text-xs">to</span>
                          <DateTimePicker
                            mode="time"
                            value={draft.end}
                            onChange={(v) => setDraft((d) => ({ ...d, end: v }))}
                            className="w-28"
                            placeholder="End"
                          />
                          <Button
                            size="sm"
                            tone="court"
                            disabled={locked || busy !== null}
                            onClick={() => saveCellHours(venue, cell, label)}
                          >
                            Save these hours
                          </Button>
                          {cell.state === "custom" && (
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={locked || busy !== null}
                              onClick={() => resetCellHours(venue, cell, label)}
                            >
                              Back to the season default
                            </Button>
                          )}
                        </div>
                        <button
                          type="button"
                          disabled={locked || busy !== null}
                          onClick={() => toggleCell(venue, cell, label)}
                          className="text-hoop-700 hover:text-hoop-800 mt-3 text-xs font-semibold disabled:opacity-50"
                        >
                          Release this weekend
                        </button>
                      </>
                    )}
                  </div>
                )
              })()}
          </div>
        ))}

        {/* Legend, straight from the mock. */}
        <div className="text-ink-500 mt-2 flex flex-wrap gap-4 text-xs">
          <span className="inline-flex items-center gap-1.5">
            <i className="border-court-200 bg-court-50 inline-block h-3 w-3 rounded border" />
            available
          </span>
          <span className="inline-flex items-center gap-1.5">
            <i className="border-ink-200 bg-ink-100 inline-block h-3 w-3 rounded border border-dashed" />
            released (you tapped it off, we never pre-mark one)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <i className="border-gold-200 bg-gold-50 inline-block h-3 w-3 rounded border" />
            custom hours that weekend
          </span>
        </div>

        {/* Add a gym: the same create-or-attach endpoint the season uses. */}
        <div className="mt-4">
          {addingGym ? (
            <AddGymCard
              seasonId={seasonId}
              onCancel={() => setAddingGym(false)}
              onAdded={async (name) => {
                setAddingGym(false)
                setNotice(`${name} added, available every weekend.`)
                await load()
              }}
            />
          ) : (
            <button
              type="button"
              disabled={locked}
              onClick={() => setAddingGym(true)}
              className="text-play-700 hover:text-play-800 text-sm font-semibold disabled:opacity-50"
            >
              + Add a gym
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/** Add-a-gym: VenueSelector plus the two facts the grid needs (courts and
 *  the default window), attached to every weekend on save. */
function AddGymCard({
  seasonId,
  onAdded,
  onCancel,
}: {
  seasonId: string
  onAdded: (name: string) => void
  onCancel: () => void
}) {
  const [venue, setVenue] = useState<{ id: string; name: string } | null>(null)
  const [courtCount, setCourtCount] = useState(2)
  const [openTime, setOpenTime] = useState("09:00")
  const [closeTime, setCloseTime] = useState("21:00")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    if (!venue) {
      setError("Pick a gym first.")
      return
    }
    setSaving(true)
    setError(null)
    const res = await fetch(`/api/seasons/${seasonId}/venues`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        venueId: venue.id,
        courtCount,
        openTime,
        closeTime,
        addToSessions: true,
      }),
    }).catch(() => null)
    setSaving(false)
    if (!res?.ok) {
      const data = await res?.json().catch(() => null)
      setError(data?.error ?? "Couldn't add that gym.")
      return
    }
    onAdded(venue.name)
  }

  return (
    <div className="border-ink-100 bg-ink-50/60 rounded-xl border p-4">
      <p className="text-ink-900 text-sm font-bold">Add a gym</p>
      <p className="text-ink-500 mb-3 mt-0.5 text-xs">
        It starts available on every weekend of the season. Release the ones you do not have.
      </p>
      <VenueSelector
        value={venue?.id ?? ""}
        venueName={venue?.name ?? ""}
        onSelect={(v) => setVenue({ id: v.id, name: v.name })}
        onClear={() => setVenue(null)}
      />
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="text-ink-700 text-xs font-semibold">
          Courts
          <input
            type="number"
            min={1}
            max={30}
            value={courtCount}
            onChange={(e) => setCourtCount(Math.max(1, Number(e.target.value) || 1))}
            className="border-ink-200 focus:border-play-500 mt-1 block w-20 rounded-lg border px-2 py-1.5 text-sm focus:outline-none"
          />
        </label>
        <label className="text-ink-700 text-xs font-semibold">
          Opens
          <DateTimePicker
            mode="time"
            value={openTime}
            onChange={setOpenTime}
            className="mt-1 w-28"
            placeholder="Open"
          />
        </label>
        <label className="text-ink-700 text-xs font-semibold">
          Closes
          <DateTimePicker
            mode="time"
            value={closeTime}
            onChange={setCloseTime}
            className="mt-1 w-28"
            placeholder="Close"
          />
        </label>
        <Button size="sm" tone="court" disabled={saving} onClick={save}>
          {saving ? "Adding…" : "Add gym"}
        </Button>
        <Button size="sm" variant="secondary" disabled={saving} onClick={onCancel}>
          Cancel
        </Button>
      </div>
      {error && <p className="text-hoop-700 mt-2 text-xs font-semibold">{error}</p>}
    </div>
  )
}
