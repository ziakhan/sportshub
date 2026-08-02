"use client"

import { useCallback, useEffect, useState } from "react"
import { Button, DateTimePicker } from "@/components/ui"
import { VenueEditor } from "@/components/venue-editor"
import { VenueSelector } from "@/components/venue-selector"
import type { VenueGrid, VenueGridCell, VenueGridRow, VenueGridWeekend } from "@/lib/seasons/venue-grid"

/**
 * Step 2, gyms and weekends (owner-approved mock, 2026-08-02, revised the
 * same day after the owner drove it). One card per gym, one column per
 * weekend, and three rulings the screen is built around:
 *
 *   1. EVERY weekend of the season is here, month by month, not just the ones
 *      that already exist. "We currently don't have visibility."
 *   2. A cell is a one-tap on/off toggle. Tapping it never opens a panel.
 *   3. Hours are ONE from-to range per gym, the same every weekend. This is
 *      the estimate phase. A single weekend that runs different hours lives
 *      behind a quiet link, and shows up amber on the grid so it is never
 *      invisible.
 */

const CELL_CLS: Record<VenueGridCell["state"], string> = {
  on: "border-court-200 bg-court-50 text-court-800 hover:border-court-400",
  off: "border-ink-200 border-dashed bg-ink-50 text-ink-400 hover:border-ink-400",
  custom: "border-gold-200 bg-gold-50 text-gold-800 hover:border-gold-400",
}

interface HoursDraft {
  start: string
  end: string
}

/** Month bands over the weekend strip: one header per month, spanning its
 *  weekends, so a long season still reads as October through February. */
function monthGroups(weekends: VenueGridWeekend[]): Array<{ month: string; span: number }> {
  const groups: Array<{ month: string; span: number }> = []
  for (const w of weekends) {
    const last = groups[groups.length - 1]
    if (last && last.month === w.month) last.span++
    else groups.push({ month: w.month, span: 1 })
  }
  return groups
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
  const [hours, setHours] = useState<Record<string, HoursDraft>>({})
  const [exceptionFor, setExceptionFor] = useState<string | null>(null)
  const [exceptionKey, setExceptionKey] = useState<string>("")
  const [exceptionDraft, setExceptionDraft] = useState<HoursDraft>({ start: "", end: "" })
  const [advancedFor, setAdvancedFor] = useState<string | null>(null)
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
    setHours(
      Object.fromEntries(
        (data.grid.venues as VenueGridRow[]).map((v) => [
          v.seasonVenueId,
          { start: v.simpleOpen ?? "", end: v.simpleClose ?? "" },
        ])
      )
    )
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

  const json = (body: unknown, method = "POST"): RequestInit => ({
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })

  /** One tap: on becomes off, off becomes on. A weekend that has no session
   *  yet gets one created on the way in. */
  const toggleCell = async (venue: VenueGridRow, weekend: VenueGridWeekend, cell: VenueGridCell) => {
    const key = `${venue.venueId}:${weekend.key}`
    if (cell.state === "off") {
      const on = `${venue.name} is on for ${weekend.label}.`
      if (cell.sessionId) {
        await call(
          `/api/seasons/${seasonId}/sessions/${cell.sessionId}/venues/${venue.venueId}`,
          { method: "POST" },
          key,
          on
        )
      } else if (cell.satDateISO) {
        await call(
          `/api/seasons/${seasonId}/weekends`,
          json({ satDate: cell.satDateISO, venueId: venue.venueId }),
          key,
          on
        )
      }
      return
    }
    if (!cell.sessionId) return
    await call(
      `/api/seasons/${seasonId}/sessions/${cell.sessionId}/venues/${venue.venueId}`,
      { method: "DELETE" },
      key,
      `${venue.name} is off for ${weekend.label}.`
    )
  }

  /** The whole hours model on this screen: one range, every weekend. */
  const saveHours = async (venue: VenueGridRow) => {
    const draft = hours[venue.seasonVenueId]
    if (!draft?.start || !draft?.end) {
      setError("Set both a start and an end time.")
      return
    }
    if (draft.start >= draft.end) {
      setError("The end time has to be after the start time.")
      return
    }
    await call(
      `/api/seasons/${seasonId}/venues/${venue.seasonVenueId}/hours`,
      json(
        {
          hours: [
            { dayOfWeek: 6, openTime: draft.start, closeTime: draft.end },
            { dayOfWeek: 0, openTime: draft.start, closeTime: draft.end },
          ],
        },
        "PUT"
      ),
      `${venue.seasonVenueId}:hours`,
      `${venue.name} runs ${draft.start} to ${draft.end} every weekend.`
    )
  }

  const saveException = async (venue: VenueGridRow, cell: VenueGridCell, label: string) => {
    if (!exceptionDraft.start || !exceptionDraft.end) {
      setError("Set both a start and an end time.")
      return
    }
    // The panel stays open on purpose: the weekend now reads amber and
    // putting it back is one click away.
    await call(
      `/api/seasons/${seasonId}/sessions/${cell.sessionId}/venues/${venue.venueId}/hours`,
      json({ startTime: exceptionDraft.start, endTime: exceptionDraft.end }, "PATCH"),
      `${venue.venueId}:${exceptionKey}:hours`,
      `${label} at ${venue.name} runs ${exceptionDraft.start} to ${exceptionDraft.end}. Every other weekend keeps your usual hours.`
    )
  }

  const resetException = async (venue: VenueGridRow, cell: VenueGridCell, label: string) => {
    const ok = await call(
      `/api/seasons/${seasonId}/sessions/${cell.sessionId}/venues/${venue.venueId}/hours`,
      json({ reset: true }, "PATCH"),
      `${venue.venueId}:${exceptionKey}:reset`,
      `${label} is back on your usual hours.`
    )
    if (ok) setExceptionFor(null)
  }

  if (!grid) {
    return <p className="text-ink-500 p-6 text-sm">{error ?? "Loading your gyms…"}</p>
  }

  const weekends = grid.weekends
  const months = monthGroups(weekends)

  return (
    <div className="border-ink-100 shadow-soft overflow-hidden rounded-2xl border bg-white">
      {/* Screen head */}
      <div className="border-ink-100 flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
        <div>
          <p className="text-ink-900 text-[15px] font-bold">Gym time</p>
          <p className="text-ink-500 text-xs">
            Every weekend of the season is here. Tap the ones you have the gym.
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
            This season has no dates yet. Give it a start and an end date and every weekend in
            between shows up here.
          </p>
        )}

        {grid.venues.length === 0 && weekends.length > 0 && (
          <p className="border-ink-200 text-ink-500 rounded-xl border border-dashed px-4 py-6 text-center text-sm">
            No gyms on this season yet. Add the first one below, then tap the weekends you have
            it.
          </p>
        )}

        {/* One card per gym: the WHOLE venue model for this season. */}
        {grid.venues.map((venue) => {
          const draft = hours[venue.seasonVenueId] ?? { start: "", end: "" }
          const dirty =
            draft.start !== (venue.simpleOpen ?? "") || draft.end !== (venue.simpleClose ?? "")
          const exceptionOpen = exceptionFor === venue.seasonVenueId
          const liveWeekends = weekends.filter((w, i) => venue.cells[i].state !== "off" && w.sessionId)

          return (
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

              {/* Courts stay a fact; hours are ONE range for the whole season. */}
              <div
                role="group"
                aria-label={`${venue.name} availability`}
                className="mt-2.5 flex flex-wrap items-center gap-2"
              >
                <span className="border-ink-100 bg-ink-50 text-ink-700 rounded-lg border px-2.5 py-1 text-xs">
                  <b className="text-ink-900">{venue.courtsAvailable ?? venue.courtCount}</b> courts
                </span>
                {locked ? (
                  <span className="border-ink-100 bg-ink-50 text-ink-700 rounded-lg border px-2.5 py-1 text-xs">
                    Available{" "}
                    <b className="text-ink-900">
                      {venue.simpleOpen ?? "—"} to {venue.simpleClose ?? "—"}
                    </b>
                  </span>
                ) : (
                  <>
                    <span className="text-ink-700 text-xs font-semibold">Available</span>
                    <DateTimePicker
                      mode="time"
                      value={draft.start}
                      onChange={(v) =>
                        setHours((h) => ({
                          ...h,
                          [venue.seasonVenueId]: { ...draft, start: v },
                        }))
                      }
                      className="w-24"
                      placeholder="Start"
                    />
                    <span className="text-ink-400 text-xs">to</span>
                    <DateTimePicker
                      mode="time"
                      value={draft.end}
                      onChange={(v) =>
                        setHours((h) => ({
                          ...h,
                          [venue.seasonVenueId]: { ...draft, end: v },
                        }))
                      }
                      className="w-24"
                      placeholder="End"
                    />
                    {dirty && (
                      <Button
                        size="sm"
                        tone="court"
                        disabled={busy !== null}
                        onClick={() => saveHours(venue)}
                      >
                        Save hours
                      </Button>
                    )}
                  </>
                )}
              </div>
              <p className="text-ink-400 mt-1.5 text-[11.5px]">
                {venue.hoursVary
                  ? "Saturday and Sunday run different hours right now. Saving makes them the same."
                  : "The same hours every weekend. You can fine tune a single weekend below."}
              </p>

              {/* The weekend grid: month bands, then one cell per weekend. */}
              <div className="mt-3 overflow-x-auto pb-1">
                <table className="border-separate border-spacing-1">
                  <thead>
                    <tr>
                      {months.map((m, i) => (
                        <th
                          key={`${m.month}-${i}`}
                          scope="colgroup"
                          colSpan={m.span}
                          className={`text-ink-400 px-1 pb-0.5 text-left text-[10px] font-bold uppercase tracking-[0.08em] ${
                            i > 0 ? "border-ink-100 border-l pl-2" : ""
                          }`}
                        >
                          {m.month}
                        </th>
                      ))}
                    </tr>
                    <tr>
                      {weekends.map((w) => (
                        <th
                          key={w.key}
                          scope="col"
                          className="text-ink-500 px-1 pb-1 text-center text-[10.5px] font-bold"
                        >
                          {w.dayLabel}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      {venue.cells.map((cell, i) => {
                        const w = weekends[i]
                        const key = `${venue.venueId}:${w.key}`
                        return (
                          <td key={w.key} className="p-0 align-top">
                            <button
                              type="button"
                              disabled={locked || busy !== null}
                              onClick={() => toggleCell(venue, w, cell)}
                              aria-pressed={cell.state !== "off"}
                              aria-label={`${venue.name}, ${w.label}: ${
                                cell.state === "off"
                                  ? "off, tap to turn it on"
                                  : cell.state === "custom"
                                    ? `on, ${cell.startTime} to ${cell.endTime}, tap to turn it off`
                                    : "on, tap to turn it off"
                              }`}
                              className={`min-h-[40px] w-[62px] rounded-lg border px-1 text-[10.5px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${CELL_CLS[cell.state]}`}
                            >
                              {busy === key ? (
                                "…"
                              ) : cell.state === "off" ? (
                                "Off"
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

              {/* Quiet links: the exception, and the full venue editor. */}
              <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1">
                <button
                  type="button"
                  disabled={locked}
                  onClick={() => {
                    const next = exceptionOpen ? null : venue.seasonVenueId
                    setExceptionFor(next)
                    setAdvancedFor(null)
                    const firstKey = liveWeekends[0]?.key ?? ""
                    setExceptionKey(firstKey)
                    const idx = weekends.findIndex((w) => w.key === firstKey)
                    setExceptionDraft({
                      start: (idx >= 0 ? venue.cells[idx].startTime : null) ?? draft.start,
                      end: (idx >= 0 ? venue.cells[idx].endTime : null) ?? draft.end,
                    })
                  }}
                  className="text-play-700 hover:text-play-800 text-xs font-semibold disabled:opacity-50"
                >
                  {exceptionOpen ? "Close" : "One weekend runs different hours?"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAdvancedFor(advancedFor === venue.seasonVenueId ? null : venue.seasonVenueId)
                    setExceptionFor(null)
                  }}
                  className="text-ink-500 hover:text-ink-700 text-xs font-semibold"
                >
                  {advancedFor === venue.seasonVenueId ? "Close advanced" : "Advanced"}
                </button>
              </div>

              {/* One weekend's exception. Everything else keeps the card's range. */}
              {exceptionOpen &&
                (() => {
                  const idx = weekends.findIndex((w) => w.key === exceptionKey)
                  const cell = idx >= 0 ? venue.cells[idx] : null
                  const label = idx >= 0 ? weekends[idx].label : "that weekend"
                  return (
                    <div className="border-ink-100 bg-ink-50/60 mt-3 rounded-xl border p-3">
                      {liveWeekends.length === 0 ? (
                        <p className="text-ink-500 text-xs">
                          Turn this gym on for a weekend first, then you can give that one weekend
                          its own hours.
                        </p>
                      ) : (
                        <>
                          <p className="text-ink-500 mb-2.5 text-xs">
                            Pick the weekend that runs different hours. Your usual range stays
                            exactly as it is everywhere else.
                          </p>
                          <div className="flex flex-wrap items-center gap-2">
                            <select
                              value={exceptionKey}
                              onChange={(e) => {
                                setExceptionKey(e.target.value)
                                const j = weekends.findIndex((w) => w.key === e.target.value)
                                setExceptionDraft({
                                  start: (j >= 0 ? venue.cells[j].startTime : null) ?? draft.start,
                                  end: (j >= 0 ? venue.cells[j].endTime : null) ?? draft.end,
                                })
                              }}
                              aria-label="Weekend with different hours"
                              className="border-ink-200 focus:border-play-500 rounded-lg border px-2 py-1.5 text-sm focus:outline-none"
                            >
                              {liveWeekends.map((w) => (
                                <option key={w.key} value={w.key}>
                                  {w.label}
                                </option>
                              ))}
                            </select>
                            <DateTimePicker
                              mode="time"
                              value={exceptionDraft.start}
                              onChange={(v) => setExceptionDraft((d) => ({ ...d, start: v }))}
                              className="w-24"
                              placeholder="Start"
                            />
                            <span className="text-ink-400 text-xs">to</span>
                            <DateTimePicker
                              mode="time"
                              value={exceptionDraft.end}
                              onChange={(v) => setExceptionDraft((d) => ({ ...d, end: v }))}
                              className="w-24"
                              placeholder="End"
                            />
                            <Button
                              size="sm"
                              tone="court"
                              disabled={locked || busy !== null || !cell?.sessionId}
                              onClick={() => cell && saveException(venue, cell, label)}
                            >
                              Save these hours
                            </Button>
                            {cell?.state === "custom" && (
                              <Button
                                size="sm"
                                variant="secondary"
                                disabled={locked || busy !== null}
                                onClick={() => resetException(venue, cell, label)}
                              >
                                Back to your usual hours
                              </Button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )
                })()}

              {/* Advanced: courts and the full seven-day window, unchanged. */}
              {advancedFor === venue.seasonVenueId && (
                <div className="border-ink-100 bg-ink-50/60 mt-3 rounded-xl border p-3">
                  <p className="text-ink-500 mb-3 text-xs">
                    Courts and the full day by day window. Most seasons never need this, the range
                    above is enough.
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
            </div>
          )
        })}

        {/* Legend, straight from the mock. */}
        <div className="text-ink-500 mt-2 flex flex-wrap gap-4 text-xs">
          <span className="inline-flex items-center gap-1.5">
            <i className="border-court-200 bg-court-50 inline-block h-3 w-3 rounded border" />
            you have the gym
          </span>
          <span className="inline-flex items-center gap-1.5">
            <i className="border-ink-200 bg-ink-100 inline-block h-3 w-3 rounded border border-dashed" />
            off (tap any weekend to turn it on)
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
                setNotice(`${name} added, on for every weekend the season already has.`)
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
 *  the hours), attached to the weekends the season already has. */
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
        Set the hours you have it, then tap the weekends on the grid.
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
