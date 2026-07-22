"use client"

import { useState } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { formatCurrency } from "@/lib/countries"
import { Badge, StarRating } from "@/components/ui"
import type { EventItem } from "./page"

type EventType = "all" | "tryouts" | "house-leagues" | "camps" | "training" | "tournaments"

export function EventsBrowser({ events }: { events: EventItem[] }) {
  const [filter, setFilter] = useState<EventType>("all")
  const [search, setSearch] = useState("")

  const filterMap: Record<EventType, string | null> = {
    all: null, tryouts: "tryout", "house-leagues": "house-league", camps: "camp", training: "training", tournaments: "tournament",
  }
  const filtered = events.filter((e) => {
    const ft = filterMap[filter]
    if (ft && ft !== e.type) return false
    if (search.length >= 2) {
      const q = search.toLowerCase()
      return e.name.toLowerCase().includes(q) || e.clubName.toLowerCase().includes(q) || e.location.toLowerCase().includes(q)
    }
    return true
  })

  const typeBadge: Record<string, { bg: string; text: string; label: string }> = {
    tryout: { bg: "bg-hoop-50", text: "text-hoop-600", label: "Tryout" },
    "house-league": { bg: "bg-court-50", text: "text-court-700", label: "House League" },
    camp: { bg: "bg-violet-100", text: "text-violet-700", label: "Camp" },
    training: { bg: "bg-sky-100", text: "text-sky-700", label: "Training" },
    tournament: { bg: "bg-gold-50", text: "text-gold-600", label: "Tournament" },
  }

  return (
    <>
      {/* Filters */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex flex-wrap gap-1.5">
          {([
            { key: "all", label: "All" },
            { key: "tryouts", label: "Tryouts" },
            { key: "house-leagues", label: "House Leagues" },
            { key: "camps", label: "Camps" },
            { key: "training", label: "Training" },
            { key: "tournaments", label: "Tournaments" },
          ] as const).map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium ${
                filter === f.key ? "bg-play-600 text-white" : "bg-ink-100 text-ink-700 hover:bg-ink-200"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, club, or location..."
          className="flex-1 rounded-xl border border-ink-200 px-4 py-2 text-sm shadow-sm focus:border-play-500 focus:outline-none focus:ring-1 focus:ring-play-500"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-[28px] border-2 border-dashed border-ink-200 bg-white p-12 text-center">
          <h3 className="text-lg font-bold text-ink-950 mb-2">No programs found</h3>
          <p className="text-ink-600">Try adjusting your filters or search terms.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((event) => {
            const badge = typeBadge[event.type]
            return (
              <Link
                key={`${event.type}-${event.id}`}
                href={event.href}
                className="card-lift rounded-[28px] border border-ink-100 bg-white overflow-hidden shadow-soft"
              >
                <div className="h-2" style={{ backgroundColor: event.primaryColor }} />
                <div className="p-5">
                  <div className="flex items-start justify-between mb-2">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.bg} ${badge.text}`}>
                        {badge.label}
                      </span>
                      {event.type === "tournament" && event.status === "REGISTRATION" && (
                        <Badge tone="court" dot>Open for teams</Badge>
                      )}
                      {event.type === "tournament" && event.status === "IN_PROGRESS" && (
                        <Badge tone="live" dot>Underway</Badge>
                      )}
                    </span>
                    <span className="text-xs text-ink-400">{event.spotsInfo}</span>
                  </div>

                  <h3 className="font-semibold text-ink-950 mb-1">{event.name}</h3>
                  {event.clubName && (
                    <p className={`text-sm text-ink-500 ${event.clubRating != null ? "mb-0.5" : "mb-2"}`}>
                      {event.clubName}
                    </p>
                  )}
                  {event.clubRating != null && (
                    <div className="mb-2">
                      <StarRating rating={event.clubRating} count={event.clubReviewCount} />
                    </div>
                  )}

                  <div className="space-y-1 text-xs text-ink-500">
                    <div>
                      {format(new Date(event.startDate), "MMM d, yyyy")}
                      {event.endDate && ` - ${format(new Date(event.endDate), "MMM d, yyyy")}`}
                    </div>
                    <div>{event.location}</div>
                    {(event.ageGroup || event.gender) && (
                      <div>
                        {event.ageGroup}{event.gender ? ` • ${event.gender}` : ""}
                      </div>
                    )}
                    {event.extra && <div>{event.extra}</div>}
                  </div>

                  <div className="mt-3 pt-3 border-t border-ink-100 flex items-center justify-between">
                    <span className="text-lg font-bold text-hoop-600">
                      {event.fee === 0 ? "FREE" : formatCurrency(event.fee, event.currency)}
                      {event.feeUnit && event.fee !== 0 && (
                        <span className="ml-1 text-xs font-normal text-ink-400">{event.feeUnit}</span>
                      )}
                    </span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </>
  )
}
