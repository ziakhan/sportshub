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

  if (loading) return <div className="text-gray-500 py-12 text-center">Loading...</div>

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">House Leagues</h2>
          <p className="text-sm text-gray-500 mt-1">Manage your recreational programs</p>
        </div>
        <Link
          href={`/clubs/${clubId}/house-leagues/create`}
          className="rounded-md bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
        >
          Create Program
        </Link>
      </div>

      {leagues.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white p-12 text-center">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No house leagues yet</h3>
          <p className="text-gray-600 mb-6">
            Create a house league program for parents to sign up their kids.
          </p>
          <Link
            href={`/clubs/${clubId}/house-leagues/create`}
            className="inline-block rounded-md bg-orange-500 px-6 py-2 text-white font-semibold hover:bg-orange-600"
          >
            Create Your First Program
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {leagues.map((league) => {
            const isPast = new Date(league.endDate) < new Date()
            return (
              <div key={league.id} className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="mb-1 flex items-center gap-2">
                      <h3 className="text-lg font-semibold text-gray-900">{league.name}</h3>
                      {isPast ? (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">Past</span>
                      ) : league.isPublished ? (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Published</span>
                      ) : (
                        <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">Draft</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-3 text-sm text-gray-500">
                      <span>{league.ageGroups.split(",").join(", ")}{league.gender ? ` \u2022 ${league.gender}` : ""}</span>
                      <span>{league.daysOfWeek} {league.startTime}-{league.endTime}</span>
                      <span>{format(new Date(league.startDate), "MMM d")} - {format(new Date(league.endDate), "MMM d, yyyy")}</span>
                      <span>{league.location}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-lg font-bold text-orange-600">
                        {league._count.signups}
                        {league.maxParticipants ? ` / ${league.maxParticipants}` : ""}
                      </div>
                      <div className="text-xs text-gray-500">registered</div>
                    </div>
                    <div className="text-sm font-medium text-gray-700">
                      {formatCurrency(league.fee)}
                    </div>
                    {!isPast && (
                      <button
                        onClick={() => togglePublish(league.id, !league.isPublished)}
                        className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                          league.isPublished
                            ? "border border-gray-300 text-gray-700 hover:bg-gray-50"
                            : "bg-green-600 text-white hover:bg-green-700"
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
