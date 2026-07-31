"use client"

import { useState } from "react"
import { VenueSelector } from "@/components/venue-selector"
import { VenueEditor } from "@/components/venue-editor"
import { Button, PanelHeader, DateTimePicker } from "@/components/ui"
import { inputClass, panelClass } from "./types"

// Mutations previously ignored res.ok — a 403/500 looked like success and
// refresh() quietly reverted the UI (gap-audit P1 #20). All mutating fetches
// in this tab go through here.
async function checkedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, init)
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    window.alert((data as { error?: string }).error || "The change couldn't be saved")
  }
  return res
}

/**
 * Venues = the season's court supply (owner 2026-07-31): attaching a venue
 * is ONE step — pick it, say how many courts you'll use (missing ones are
 * created as "Court 1…N" automatically) and your scheduling window, and
 * every session picks it up. Each venue row shows how many sessions use it,
 * with one click to reach the rest.
 */
export function VenuesTab({
  seasonId,
  venues,
  sessions = [],
  refresh,
}: {
  seasonId: string
  venues: any[]
  sessions?: any[]
  refresh: () => void
}) {
  const [expandedVenueId, setExpandedVenueId] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)

  // Attach setup card
  const [selectedVenueId, setSelectedVenueId] = useState("")
  const [selectedVenueName, setSelectedVenueName] = useState("")
  const [selectedCourtCount, setSelectedCourtCount] = useState<number | null>(null)
  const [courtCount, setCourtCount] = useState("2")
  const [openTime, setOpenTime] = useState("09:00")
  const [closeTime, setCloseTime] = useState("18:00")
  const [addToSessions, setAddToSessions] = useState(true)
  const [busy, setBusy] = useState(false)

  const sessionCount = sessions.length
  const sessionsUsing = (venueId: string) =>
    sessions.filter((s: any) => (s.venueSelections ?? []).some((v: any) => v.venueId === venueId))
      .length

  const clearSelection = () => {
    setSelectedVenueId("")
    setSelectedVenueName("")
    setSelectedCourtCount(null)
  }

  const addVenue = async () => {
    if (!selectedVenueId) return
    setBusy(true)
    try {
      const res = await checkedFetch(`/api/seasons/${seasonId}/venues`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          venueId: selectedVenueId,
          courtCount: Math.max(1, parseInt(courtCount) || 1),
          openTime,
          closeTime,
          addToSessions: addToSessions && sessionCount > 0,
        }),
      })
      if (res.ok) {
        const data = await res.json().catch(() => ({}))
        setNote(
          data.addedToSessions > 0
            ? `${selectedVenueName} added — now used by ${data.addedToSessions} session${data.addedToSessions === 1 ? "" : "s"}.`
            : `${selectedVenueName} added.`
        )
        clearSelection()
      }
    } finally {
      setBusy(false)
    }
    refresh()
  }

  const propagate = async (venueId: string, venueName: string) => {
    const res = await checkedFetch(`/api/seasons/${seasonId}/venues/propagate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ venueId }),
    })
    if (res.ok) {
      const data = await res.json().catch(() => ({}))
      setNote(
        `${venueName} added to ${data.addedToSessions} more session${data.addedToSessions === 1 ? "" : "s"}.`
      )
    }
    refresh()
  }

  const parsedCount = Math.max(1, parseInt(courtCount) || 1)
  const newCourts =
    selectedCourtCount != null && parsedCount > selectedCourtCount
      ? parsedCount - selectedCourtCount
      : 0

  return (
    <div className="grid gap-6">
      {/* Venues */}
      <div className={`reveal ${panelClass}`}>
        <PanelHeader title="Venues & courts" />
        <p className="text-ink-500 -mt-2 mb-3 text-xs">
          The season&apos;s court supply. Every session starts with these courts — trim any
          session that uses fewer.
        </p>
        {note && (
          <div className="border-court-200 bg-court-50 text-court-700 mb-3 rounded-xl border px-3 py-2 text-xs font-semibold">
            {note}
          </div>
        )}
        {venues.map((v: any) => {
          const expanded = expandedVenueId === v.id
          const courtCountHave = v.venue.courtList?.length ?? 0
          const using = sessionsUsing(v.venue.id)
          const gap = sessionCount - using
          return (
            <div
              key={v.id}
              className="border-court-100 bg-court-50 hover:border-court-200 mb-2 rounded-xl border px-3 py-2 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-ink-900 font-medium">{v.venue.name}</span>
                  <span className="text-ink-500 ml-2 text-xs">
                    {v.venue.address}, {v.venue.city}
                  </span>
                  <div className="text-ink-400 mt-0.5 text-xs">
                    {courtCountHave > 0
                      ? `${courtCountHave} court${courtCountHave !== 1 ? "s" : ""}`
                      : "No courts defined"}
                    {sessionCount > 0 && (
                      <>
                        {" · "}
                        {using === sessionCount ? (
                          <span className="text-court-700">used by all {sessionCount} sessions</span>
                        ) : (
                          <span className="text-amber-700">
                            used by {using} of {sessionCount} sessions
                          </span>
                        )}
                      </>
                    )}
                  </div>
                  {gap > 0 && (
                    <button
                      onClick={() => propagate(v.venue.id, v.venue.name)}
                      className="text-play-700 hover:text-play-800 mt-0.5 text-xs font-semibold hover:underline"
                    >
                      Add to the other {gap} session{gap === 1 ? "" : "s"}
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <a
                    href={`/venues/${v.venue.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-ink-500 hover:text-ink-700 text-xs font-semibold"
                    title="The shared venue page — address, posted hours, all activity"
                  >
                    Venue page ↗
                  </a>
                  <button
                    onClick={() => setExpandedVenueId(expanded ? null : v.id)}
                    className="text-play-700 hover:text-play-800 text-xs font-semibold"
                  >
                    {expanded ? "Close" : "Edit courts & hours"}
                  </button>
                  <button
                    onClick={async () => {
                      const usedBy = sessionsUsing(v.venue.id)
                      if (
                        !window.confirm(
                          usedBy > 0
                            ? `Remove ${v.venue.name} from this season? Its courts also leave the ${usedBy} session${usedBy === 1 ? "" : "s"} using them.`
                            : `Remove ${v.venue.name} from this season?`
                        )
                      )
                        return
                      await checkedFetch(
                        `/api/seasons/${seasonId}/venues?leagueVenueId=${v.id}`,
                        { method: "DELETE" }
                      )
                      refresh()
                    }}
                    className="hover:text-hoop-700 text-xs text-red-500"
                  >
                    Remove
                  </button>
                </div>
              </div>
              {expanded && (
                <div className="border-ink-200 mt-3 border-t pt-3">
                  <VenueEditor
                    venueId={v.venue.id}
                    venueName={v.venue.name}
                    courts={v.venue.courtList ?? []}
                    // Per-season scheduling hours (SeasonVenueHours) — editing
                    // here must never mutate the venue's shared global hours
                    // (batch-backlog §2b).
                    hours={v.hours ?? []}
                    hoursEndpoint={`/api/seasons/${seasonId}/venues/${v.id}/hours`}
                    hoursLabel="Your scheduling hours (this season)"
                    referenceHours={v.venue.venueHours ?? []}
                    referenceLabel="Venue's posted hours (shared, read-only)"
                    onChange={refresh}
                  />
                </div>
              )}
            </div>
          )
        })}
        <div className="border-ink-200 mt-4 space-y-2 border-t pt-4">
          <VenueSelector
            value={selectedVenueId}
            venueName={selectedVenueName}
            onSelect={(v: any) => {
              setSelectedVenueId(v.id)
              setSelectedVenueName(v.name)
              const have = v.courtList?.length ?? v.courts ?? 0
              setSelectedCourtCount(typeof have === "number" ? have : 0)
              setCourtCount(String(Math.max(1, typeof have === "number" && have > 0 ? have : 2)))
            }}
            onClear={clearSelection}
          />
          {selectedVenueId && (
            <div className="border-play-200 bg-play-50/40 space-y-3 rounded-xl border p-3">
              <p className="text-ink-900 text-sm font-semibold">
                Set up {selectedVenueName} for this season
              </p>
              <div className="flex flex-wrap items-end gap-4">
                <label className="text-ink-600 text-xs">
                  Courts you&apos;ll use
                  <input
                    value={courtCount}
                    onChange={(e) => setCourtCount(e.target.value.replace(/\D/g, "").slice(0, 2))}
                    inputMode="numeric"
                    className={inputClass + " mt-1 block w-20"}
                  />
                </label>
                <label className="text-ink-600 text-xs">
                  Scheduling hours
                  <div className="mt-1 flex items-center gap-1">
                    <DateTimePicker mode="time" value={openTime} onChange={setOpenTime} className="w-28" />
                    <span className="text-ink-400 text-xs">-</span>
                    <DateTimePicker mode="time" value={closeTime} onChange={setCloseTime} className="w-28" />
                  </div>
                </label>
              </div>
              <p className="text-ink-500 text-xs">
                {newCourts > 0
                  ? `Court ${(selectedCourtCount ?? 0) + 1}${newCourts > 1 ? `…Court ${parsedCount}` : ""} will be created automatically — rename them any time.`
                  : selectedCourtCount && selectedCourtCount > 0
                    ? `Uses the venue's first ${parsedCount} court${parsedCount === 1 ? "" : "s"}.`
                    : "Courts are created automatically as Court 1, Court 2, … — rename them any time."}
              </p>
              {sessionCount > 0 && (
                <label className="text-ink-700 flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={addToSessions}
                    onChange={(e) => setAddToSessions(e.target.checked)}
                  />
                  Add these courts to all {sessionCount} existing session
                  {sessionCount === 1 ? "" : "s"} (trim per session anytime)
                </label>
              )}
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={addVenue} disabled={busy}>
                  {busy ? "Adding…" : "Add venue"}
                </Button>
                <Button size="sm" variant="subtle" onClick={clearSelection} disabled={busy}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
