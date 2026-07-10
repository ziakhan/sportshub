"use client"

import { useState } from "react"
import { VenueSelector } from "@/components/venue-selector"
import { VenueEditor } from "@/components/venue-editor"
import { Button, PanelHeader } from "@/components/ui"
import { panelClass } from "./types"

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


export function VenuesTab({
  seasonId,
  venues,
  refresh,
}: {
  seasonId: string
  venues: any[]
  refresh: () => void
}) {
  const [expandedVenueId, setExpandedVenueId] = useState<string | null>(null)

  // Venue form
  const [selectedVenueId, setSelectedVenueId] = useState("")
  const [selectedVenueName, setSelectedVenueName] = useState("")

  const addVenue = async () => {
    if (!selectedVenueId) return
    await checkedFetch(`/api/seasons/${seasonId}/venues`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ venueId: selectedVenueId }),
    })
    setSelectedVenueId("")
    setSelectedVenueName("")
    refresh()
  }

  return (
    <div className="grid gap-6">
      {/* Venues */}
      <div className={`reveal ${panelClass}`}>
        <PanelHeader title="Venues" />
        {venues.map((v: any) => {
          const expanded = expandedVenueId === v.id
          const courtCount = v.venue.courtList?.length ?? 0
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
                    {courtCount > 0
                      ? `${courtCount} court${courtCount !== 1 ? "s" : ""}`
                      : "No courts defined"}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setExpandedVenueId(expanded ? null : v.id)}
                    className="text-play-700 hover:text-play-800 text-xs font-semibold"
                  >
                    {expanded ? "Close" : "Edit courts & hours"}
                  </button>
                  <button
                    onClick={async () => {
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
                    hours={v.venue.venueHours ?? []}
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
            onSelect={(v) => {
              setSelectedVenueId(v.id)
              setSelectedVenueName(v.name)
            }}
            onClear={() => {
              setSelectedVenueId("")
              setSelectedVenueName("")
            }}
          />
          {selectedVenueId && (
            <Button size="sm" block onClick={addVenue}>
              Add to League
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
