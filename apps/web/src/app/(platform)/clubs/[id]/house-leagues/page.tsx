"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { format } from "date-fns"
import { formatCurrency } from "@/lib/countries"

interface HouseLeague {
  id: string
  name: string
  ageGroups: string
  gender: string | null
  season: string | null
  startDate: string
  endDate: string
  daysOfWeek: string
  startTime: string
  endTime: string
  location: string
  fee: number
  maxParticipants: number | null
  isPublished: boolean
  _count: { signups: number }
}

export default function ClubHouseLeaguesPage() {
  const params = useParams()
  const clubId = params?.id as string
  const [leagues, setLeagues] = useState<HouseLeague[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/house-leagues?tenantId=${clubId}`)
      .then((res) => res.json())
      .then((data) => setLeagues(data.leagues || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [clubId])

  const togglePublish = async (id: string, publish: boolean) => {
    await fetch(`/api/house-leagues/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPublished: publish }),
    })
    setLeagues((prev) =>
      prev.map((l) => (l.id === id ? { ...l, isPublished: publish } : l))
    )
  }

  if (loading) return <div className="text-ink-500 py-12 text-center">Loading...</div>

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-ink-900">House Leagues</h2>
          <p className="text-sm text-ink-500 mt-1">Manage your recreational programs</p>
        </div>
        <Link
          href={`/clubs/${clubId}/house-leagues/create`}
          className="rounded-xl bg-play-600 px-4 py-2 text-sm font-semibold text-white hover:bg-play-700"
        >
          Create Program
        </Link>
      </div>

      {leagues.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink-300 bg-white p-12 text-center shadow-soft">
          <h3 className="text-lg font-semibold text-ink-900 mb-2">No house leagues yet</h3>
          <p className="text-ink-600 mb-6">
            Create a house league program for parents to sign up their kids.
          </p>
          <Link
            href={`/clubs/${clubId}/house-leagues/create`}
            className="inline-block rounded-xl bg-play-600 px-6 py-2 text-white font-semibold hover:bg-play-700"
          >
            Create Your First Program
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {leagues.map((league) => {
            const isPast = new Date(league.endDate) < new Date()
            return (
              <div key={league.id} className="rounded-2xl border border-ink-100 bg-white p-6 shadow-soft">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="mb-1 flex items-center gap-2">
                      <h3 className="text-lg font-semibold text-ink-900">{league.name}</h3>
                      {isPast ? (
                        <span className="rounded-full bg-court-100 px-2 py-0.5 text-xs font-medium text-ink-600">Past</span>
                      ) : league.isPublished ? (
                        <span className="rounded-full bg-court-100 px-2 py-0.5 text-xs font-medium text-court-700">Published</span>
                      ) : (
                        <span className="rounded-full bg-hoop-100 px-2 py-0.5 text-xs font-medium text-hoop-700">Draft</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-3 text-sm text-ink-500">
                      <span>{league.ageGroups.split(",").join(", ")}{league.gender ? ` \u2022 ${league.gender}` : ""}</span>
                      <span>{league.daysOfWeek} {league.startTime}-{league.endTime}</span>
                      <span>{format(new Date(league.startDate), "MMM d")} - {format(new Date(league.endDate), "MMM d, yyyy")}</span>
                      <span>{league.location}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-lg font-bold text-play-700">
                        {league._count.signups}
                        {league.maxParticipants ? ` / ${league.maxParticipants}` : ""}
                      </div>
                      <div className="text-xs text-ink-500">registered</div>
                    </div>
                    <div className="text-sm font-medium text-ink-700">
                      {formatCurrency(league.fee)}
                    </div>
                    {!isPast && (
                      <button
                        onClick={() => togglePublish(league.id, !league.isPublished)}
                        className={`rounded-xl px-3 py-1.5 text-xs font-semibold ${
                          league.isPublished
                            ? "border border-ink-200 text-ink-700 hover:bg-court-50"
                            : "bg-play-600 text-white hover:bg-play-700"
                        }`}
                      >
                        {league.isPublished ? "Unpublish" : "Publish"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
