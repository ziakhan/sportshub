"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { formatCurrency } from "@/lib/countries"

type EventType = "all" | "tryouts" | "house-leagues" | "camps" | "leagues"

interface EventItem {
  id: string
  type: "tryout" | "house-league" | "camp"
  name: string
  clubName: string
  clubSlug: string
  ageGroup: string
  gender: string | null
  startDate: string
  endDate?: string
  location: string
  fee: number
  currency: string
  primaryColor: string
  spotsInfo: string
  extra?: string // camp type, schedule, etc.
  href: string
}

const TYPE_LABELS: Record<string, string> = {
  MARCH_BREAK: "March Break",
  HOLIDAY: "Holiday",
  SUMMER: "Summer",
  WEEKLY: "Weekly",
}

export default function EventsPage() {
  const [events, setEvents] = useState<EventItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<EventType>("all")
  const [search, setSearch] = useState("")

  useEffect(() => {
    async function fetchAll() {
      setLoading(true)
      try {
        const [tryoutsRes, leaguesRes, campsRes, compLeaguesRes] = await Promise.all([
          fetch("/api/tryouts?marketplace=true"),
          fetch("/api/house-leagues?public=true"),
          fetch("/api/camps?public=true"),
          fetch("/api/leagues?public=true"),
        ])

        const tryoutsData = await tryoutsRes.json()
        const leaguesData = await leaguesRes.json()
        const campsData = await campsRes.json()
        const compLeaguesData = await compLeaguesRes.json()

        const items: EventItem[] = []

        // Tryouts
        for (const t of tryoutsData.tryouts || []) {
          items.push({
            id: t.id,
            type: "tryout",
            name: t.title,
            clubName: t.tenant?.name || "",
            clubSlug: t.tenant?.slug || "",
            ageGroup: t.ageGroup,
            gender: t.gender,
            startDate: t.scheduledAt,
            location: t.location,
            fee: Number(t.fee),
            currency: t.tenant?.currency || "CAD",
            primaryColor: t.tenant?.branding?.primaryColor || "#1a73e8",
            spotsInfo: `${t._count?.signups || 0}${t.maxParticipants ? `/${t.maxParticipants}` : ""} signed up`,
            href: `/tryout/${t.id}`,
          })
        }

        // House Leagues
        for (const l of leaguesData.leagues || []) {
          items.push({
            id: l.id,
            type: "house-league",
            name: l.name,
            clubName: l.tenant?.name || "",
            clubSlug: l.tenant?.slug || "",
            ageGroup: (l.ageGroups || l.ageGroup || "").split(",").join(", "),
            gender: l.gender,
            startDate: l.startDate,
            endDate: l.endDate,
            location: l.location,
            fee: Number(l.fee),
            currency: l.tenant?.currency || "CAD",
            primaryColor: l.tenant?.branding?.primaryColor || "#1a73e8",
            spotsInfo: `${l._count?.signups || 0}${l.maxParticipants ? `/${l.maxParticipants}` : ""} registered`,
            extra: `${l.daysOfWeek} ${l.startTime}-${l.endTime}`,
            href: `/house-league/${l.id}`,
          })
        }

        // Camps
        for (const c of campsData.camps || []) {
          items.push({
            id: c.id,
            type: "camp",
            name: c.name,
            clubName: c.tenant?.name || "",
            clubSlug: c.tenant?.slug || "",
            ageGroup: c.ageGroup,
            gender: c.gender,
            startDate: c.startDate,
            endDate: c.endDate,
            location: c.location,
            fee: Number(c.weeklyFee),
            currency: c.tenant?.currency || "CAD",
            primaryColor: c.tenant?.branding?.primaryColor || "#1a73e8",
            spotsInfo: `${c._count?.signups || 0}${c.maxParticipants ? `/${c.maxParticipants}` : ""} registered`,
            extra: `${TYPE_LABELS[c.campType] || c.campType} \u2022 ${c.numberOfWeeks} week${c.numberOfWeeks !== 1 ? "s" : ""}`,
            href: `/camp/${c.id}`,
          })
        }

        // Competitive Leagues
        for (const l of compLeaguesData.leagues || []) {
          items.push({
            id: l.id,
            type: "league" as any,
            name: l.name,
            clubName: l.season,
            clubSlug: "",
            ageGroup: l.divisions?.map((d: any) => d.ageGroup).filter((v: string, i: number, a: string[]) => a.indexOf(v) === i).join(", ") || "All",
            gender: null,
            startDate: l.startDate || l.createdAt,
            endDate: l.endDate,
            location: "Multiple Venues",
            fee: l.teamFee ? Number(l.teamFee) : 0,
            currency: l.currency || "CAD",
            primaryColor: "#7c3aed",
            spotsInfo: `${l._count?.teams || 0} teams`,
            extra: `${l.gamesGuaranteed || "?"} games guaranteed`,
            href: `/league/${l.id}`,
          })
        }

        // Sort by start date
        items.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
        setEvents(items)
      } catch {
        setEvents([])
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
  }, [])

  const filterMap: Record<EventType, string | null> = {
    all: null, tryouts: "tryout", "house-leagues": "house-league", camps: "camp", leagues: "league",
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
    tryout: { bg: "bg-orange-100", text: "text-orange-700", label: "Tryout" },
    "house-league": { bg: "bg-green-100", text: "text-green-700", label: "Program" },
    camp: { bg: "bg-purple-100", text: "text-purple-700", label: "Camp" },
    league: { bg: "bg-indigo-100", text: "text-indigo-700", label: "League" },
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Events &amp; Programs</h1>
        <p className="mt-2 text-gray-600">
          Find tryouts, house leagues, and camps near you
        </p>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex gap-1.5">
          {([
            { key: "all", label: "All" },
            { key: "tryouts", label: "Tryouts" },
            { key: "house-leagues", label: "Programs" },
            { key: "camps", label: "Camps" },
            { key: "leagues", label: "Leagues" },
          ] as const).map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium ${
                filter === f.key ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
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
          className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
        />
      </div>

      {loading ? (
        <div className="text-gray-500 py-12 text-center">Loading events...</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white p-12 text-center">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No events found</h3>
          <p className="text-gray-600">Try adjusting your filters or search terms.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((event) => {
            const badge = typeBadge[event.type]
            return (
              <Link
                key={`${event.type}-${event.id}`}
                href={event.href}
                className="rounded-lg border border-gray-200 bg-white overflow-hidden shadow-sm transition hover:shadow-md"
              >
                <div className="h-2" style={{ backgroundColor: event.primaryColor }} />
                <div className="p-5">
                  <div className="flex items-start justify-between mb-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.bg} ${badge.text}`}>
                      {badge.label}
                    </span>
                    <span className="text-xs text-gray-400">{event.spotsInfo}</span>
                  </div>

                  <h3 className="font-semibold text-gray-900 mb-1">{event.name}</h3>
                  <p className="text-sm text-gray-500 mb-2">{event.clubName}</p>

                  <div className="space-y-1 text-xs text-gray-500">
                    <div>
                      {format(new Date(event.startDate), "MMM d, yyyy")}
                      {event.endDate && ` - ${format(new Date(event.endDate), "MMM d, yyyy")}`}
                    </div>
                    <div>{event.location}</div>
                    <div>
                      {event.ageGroup}{event.gender ? ` \u2022 ${event.gender}` : ""}
                    </div>
                    {event.extra && <div>{event.extra}</div>}
                  </div>

                  <div className="mt-3 pt-3 border-t flex items-center justify-between">
                    <span className="text-lg font-bold text-orange-600">
                      {event.fee === 0 ? "FREE" : formatCurrency(event.fee, event.currency)}
                    </span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
