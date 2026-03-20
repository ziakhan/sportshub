"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { format } from "date-fns"
import { formatCurrency } from "@/lib/countries"

interface Camp {
  id: string
  name: string
  campType: string
  ageGroup: string
  gender: string | null
  startDate: string
  endDate: string
  dailyStartTime: string
  dailyEndTime: string
  location: string
  numberOfWeeks: number
  weeklyFee: number
  fullCampFee: number | null
  maxParticipants: number | null
  isPublished: boolean
  _count: { signups: number }
}

const CAMP_TYPE_LABELS: Record<string, string> = {
  MARCH_BREAK: "March Break",
  HOLIDAY: "Holiday",
  SUMMER: "Summer",
  WEEKLY: "Weekly",
}

export default function ClubCampsPage() {
  const params = useParams()
  const clubId = params?.id as string
  const [camps, setCamps] = useState<Camp[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/camps?tenantId=${clubId}`)
      .then((res) => res.json())
      .then((data) => setCamps(data.camps || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [clubId])

  const togglePublish = async (id: string, publish: boolean) => {
    await fetch(`/api/camps/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPublished: publish }),
    })
    setCamps((prev) => prev.map((c) => (c.id === id ? { ...c, isPublished: publish } : c)))
  }

  if (loading) return <div className="text-gray-500 py-12 text-center">Loading...</div>

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Camps</h2>
          <p className="text-sm text-gray-500 mt-1">March break, holiday, summer, and weekly camps</p>
        </div>
        <Link href={`/clubs/${clubId}/camps/create`}
          className="rounded-md bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600">
          Create Camp
        </Link>
      </div>

      {camps.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white p-12 text-center">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No camps yet</h3>
          <p className="text-gray-600 mb-6">Create a camp for parents to register their kids.</p>
          <Link href={`/clubs/${clubId}/camps/create`}
            className="inline-block rounded-md bg-orange-500 px-6 py-2 text-white font-semibold hover:bg-orange-600">
            Create Your First Camp
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {camps.map((camp) => {
            const isPast = new Date(camp.endDate) < new Date()
            return (
              <div key={camp.id} className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="mb-1 flex items-center gap-2">
                      <h3 className="text-lg font-semibold text-gray-900">{camp.name}</h3>
                      <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
                        {CAMP_TYPE_LABELS[camp.campType] || camp.campType}
                      </span>
                      {isPast ? (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">Past</span>
                      ) : camp.isPublished ? (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Published</span>
                      ) : (
                        <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">Draft</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-3 text-sm text-gray-500">
                      <span>{camp.ageGroup}{camp.gender ? ` \u2022 ${camp.gender}` : ""}</span>
                      <span>{format(new Date(camp.startDate), "MMM d")} - {format(new Date(camp.endDate), "MMM d, yyyy")}</span>
                      <span>{camp.numberOfWeeks} week{camp.numberOfWeeks !== 1 ? "s" : ""}</span>
                      <span>{camp.location}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-lg font-bold text-orange-600">
                        {camp._count.signups}{camp.maxParticipants ? ` / ${camp.maxParticipants}` : ""}
                      </div>
                      <div className="text-xs text-gray-500">registered</div>
                    </div>
                    <div className="text-right text-sm">
                      <div className="font-medium">{formatCurrency(camp.weeklyFee)}/wk</div>
                      {camp.fullCampFee && camp.numberOfWeeks > 1 && (
                        <div className="text-xs text-green-600">{formatCurrency(camp.fullCampFee)} all</div>
                      )}
                    </div>
                    {!isPast && (
                      <button onClick={() => togglePublish(camp.id, !camp.isPublished)}
                        className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                          camp.isPublished ? "border border-gray-300 text-gray-700 hover:bg-gray-50" : "bg-green-600 text-white hover:bg-green-700"
                        }`}>
                        {camp.isPublished ? "Unpublish" : "Publish"}
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
