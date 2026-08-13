"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { formatCurrency } from "@/lib/countries"
import { Badge, StarRating } from "@/components/ui"
import type { EventItem } from "./page"

type EventType = "all" | "tryouts" | "house-leagues" | "camps" | "training" | "tournaments"

const VALID_TYPES: readonly EventType[] = [
  "all",
  "tryouts",
  "house-leagues",
  "camps",
  "training",
  "tournaments",
]

function isEventType(value: string | undefined): value is EventType {
  return !!value && (VALID_TYPES as readonly string[]).includes(value)
}

export function EventsBrowser({
  events,
  initialFilter,
}: {
  events: EventItem[]
  initialFilter?: string
}) {
  const router = useRouter()
  const [filter, setFilter] = useState<EventType>(
    isEventType(initialFilter) ? initialFilter : "all"
  )
  const [search, setSearch] = useState("")

  // Root-cause fix (owner 2026-07-23): the type tab is real URL state, not
  // just useState — a shared/reloaded /events?type=training link now filters
  // on first paint via initialFilter above, and clicking a tab keeps the URL
  // in sync so back/forward and copy-link both work.
  const selectFilter = (key: EventType) => {
    setFilter(key)
    router.replace(`/events?type=${key}`, { scroll: false })
  }

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

  /**
   * Each product type is bought on a different fact (2026-08-13). A tryout is
   * a deadline, a camp is a block of dates, a house league is its weekly
   * shape, a tournament is the field, a training block is its cadence.
   * Previously every card showed the same date/location/fee stack, so four
   * genuinely different products read identically. This is the line that
   * differs — same skeleton, different emphasis.
   */
  const typeLead = (e: EventItem): string => {
    const start = new Date(e.startDate)
    const days = Math.ceil((start.getTime() - Date.now()) / 86_400_000)
    const dateRange = e.endDate
      ? `${format(start, "MMM d")} – ${format(new Date(e.endDate), "MMM d")}`
      : format(start, "EEE, MMM d")
    switch (e.type) {
      case "tryout":
        return days > 0
          ? `Tryout in ${days} day${days === 1 ? "" : "s"} · ${format(start, "MMM d")}`
          : `Tryout ${dateRange}`
      case "camp":
        return `${dateRange}${e.extra ? ` · ${e.extra.split("·")[0].trim()}` : ""}`
      case "house-league":
        return e.extra ? `Weekly · ${e.extra}` : `Season from ${format(start, "MMM d")}`
      case "tournament":
        return `${dateRange} · ${e.spotsInfo}`
      case "training":
        return e.extra ?? `Starts ${format(start, "MMM d")}`
      default:
        return dateRange
    }
  }

  /** Genuine remaining capacity, or null when a program has no cap. */
  const spotsLeft = (e: EventItem): number | null =>
    e.capacity != null && e.capacity > 0 && e.signups != null
      ? Math.max(0, e.capacity - e.signups)
      : null

  /** "TL" from "Toronto Lords" — grade/age noise stripped. */
  const crestOf = (name: string) =>
    (name || "")
      .replace(/\b(grade|gr\.?)\s*\d+\w*/gi, "")
      .replace(/\bu\d+\b/gi, "")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "SH"

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
              onClick={() => selectFilter(f.key)}
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
                className="card-lift group flex flex-col overflow-hidden rounded-[28px] border border-ink-100 bg-white shadow-soft"
              >
                {/* Branded cover — no photos exist for programs, so the club's
                    own colour and crest do the work (same idea as the recap
                    matchup covers). Gives the grid the visual pull it lacked. */}
                <div
                  className="relative h-28 overflow-hidden"
                  style={{
                    background: `linear-gradient(125deg, ${event.primaryColor}, ${event.primaryColor}b0 55%, rgba(15,23,42,0.88))`,
                  }}
                >
                  <span className="pointer-events-none absolute -right-6 -top-8 h-32 w-32 rounded-full bg-white/15 blur-2xl" />
                  <span className="font-condensed pointer-events-none absolute -bottom-3 right-3 text-[4rem] font-black leading-none text-white/15">
                    {crestOf(event.clubName)}
                  </span>
                  <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3.5">
                    <span className="rounded-full bg-black/35 px-2.5 py-1 text-[10.5px] font-black uppercase tracking-[0.14em] text-white backdrop-blur-sm">
                      {badge.label}
                    </span>
                    {/* Authentic scarcity only: shown near the limit, never
                        invented (research: fake urgency costs trust). */}
                    {spotsLeft(event) != null && spotsLeft(event)! <= 5 && spotsLeft(event)! > 0 && (
                      <span className="rounded-full bg-amber-400 px-2.5 py-1 text-[10.5px] font-black uppercase tracking-wider text-amber-950">
                        {spotsLeft(event)} spot{spotsLeft(event) === 1 ? "" : "s"} left
                      </span>
                    )}
                    {spotsLeft(event) === 0 && (
                      <span className="rounded-full bg-ink-900/70 px-2.5 py-1 text-[10.5px] font-black uppercase tracking-wider text-white backdrop-blur-sm">
                        Full
                      </span>
                    )}
                  </div>
                  {/* The line that differs BY TYPE — a tryout is bought on the
                      deadline, a camp on the dates, a league on its shape. */}
                  <p className="absolute bottom-3 left-3.5 right-24 truncate text-[13px] font-bold text-white">
                    {typeLead(event)}
                  </p>
                </div>

                <div className="flex flex-1 flex-col p-5">
                  <div className="flex items-center gap-1.5">
                    {event.type === "tournament" && event.status === "REGISTRATION" && (
                      <Badge tone="court" dot>Open for teams</Badge>
                    )}
                    {event.type === "tournament" && event.status === "IN_PROGRESS" && (
                      <Badge tone="live" dot>Underway</Badge>
                    )}
                  </div>

                  <h3 className="text-ink-950 mt-1 text-[17px] font-extrabold leading-snug">
                    {event.name}
                  </h3>

                  {/* Club carries its own crest and colour — families choosing
                      between two camps are largely choosing between two clubs. */}
                  {event.clubName && (
                    <div className="mt-2 flex items-center gap-2">
                      <span
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-black text-white"
                        style={{ backgroundColor: event.primaryColor }}
                      >
                        {crestOf(event.clubName)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="text-ink-800 block truncate text-[13px] font-bold">
                          {event.clubName}
                        </span>
                        {event.clubRating != null && (
                          <StarRating rating={event.clubRating} count={event.clubReviewCount} />
                        )}
                      </span>
                    </div>
                  )}

                  <div className="text-ink-500 mt-3 space-y-1 text-[12.5px]">
                    <div>{event.location}</div>
                    {(event.ageGroup || event.gender) && (
                      <div>
                        {event.ageGroup}
                        {event.gender ? ` • ${event.gender}` : ""}
                      </div>
                    )}
                    {event.extra && <div className="truncate">{event.extra}</div>}
                  </div>

                  <div className="border-ink-100 mt-auto flex items-end justify-between gap-2 border-t pt-3">
                    <span>
                      <span className="font-condensed text-hoop-600 block text-[24px] font-black leading-none">
                        {event.fee === 0 ? "FREE" : formatCurrency(event.fee, event.currency)}
                      </span>
                      <span className="text-ink-400 mt-0.5 block text-[11.5px] font-semibold">
                        {event.feeUnit && event.fee !== 0 ? event.feeUnit : event.spotsInfo}
                      </span>
                    </span>
                    <span className="text-play-700 group-hover:text-play-800 text-[12.5px] font-extrabold">
                      View →
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
