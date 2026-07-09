"use client"

import { useState, useEffect } from "react"
import type { ReactNode } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { format } from "date-fns"
import { formatCurrency } from "@/lib/countries"
import { Badge, Button } from "@/components/ui"
import { programLifecycle } from "@/lib/lifecycle"

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
  const [togglingId, setTogglingId] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/camps?tenantId=${clubId}`)
      .then((res) => res.json())
      .then((data) => setCamps(data.camps || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [clubId])

  const togglePublish = async (id: string, publish: boolean) => {
    setTogglingId(id)
    try {
      await fetch(`/api/camps/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublished: publish }),
      })
      setCamps((prev) => prev.map((c) => (c.id === id ? { ...c, isPublished: publish } : c)))
    } finally {
      setTogglingId(null)
    }
  }

  if (loading) return <div className="text-ink-500 py-12 text-center">Loading...</div>

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-ink-900">Camps</h2>
          <p className="text-sm text-ink-500 mt-1">March break, holiday, summer, and weekly camps</p>
        </div>
        <Link href={`/clubs/${clubId}/camps/create`}
          className="rounded-xl bg-play-600 px-4 py-2 text-sm font-semibold text-white hover:bg-play-700">
          Create Camp
        </Link>
      </div>

      {camps.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink-300 bg-white p-12 text-center shadow-soft">
          <h3 className="text-lg font-semibold text-ink-900 mb-2">No camps yet</h3>
          <p className="text-ink-600 mb-6">Create a camp for parents to register their kids.</p>
          <Link href={`/clubs/${clubId}/camps/create`}
            className="inline-block rounded-xl bg-play-600 px-6 py-2 text-white font-semibold hover:bg-play-700">
            Create Your First Camp
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {camps.map((camp, i) => {
            const lifecycle = programLifecycle({
              isPublished: camp.isPublished,
              startAt: camp.startDate,
              endAt: camp.endDate,
              maxParticipants: camp.maxParticipants,
              signupCount: camp._count.signups,
            })
            return (
              <div
                key={camp.id}
                className="reveal card-lift rounded-2xl border border-ink-100 bg-white p-6 shadow-soft hover:shadow-panel hover:border-[color:var(--brand-line)]"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                {/* Title + badges */}
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-semibold text-ink-900">{camp.name}</h3>
                  <span className="rounded-full bg-play-100 px-2 py-0.5 text-xs font-medium text-play-700">
                    {CAMP_TYPE_LABELS[camp.campType] || camp.campType}
                  </span>
                  <Badge tone={lifecycle.badge.tone} dot={lifecycle.badge.dot}>
                    {lifecycle.label}
                  </Badge>
                </div>

                {/* Details */}
                <div className="mb-4 flex flex-wrap gap-3 text-sm text-ink-500">
                  <span>{camp.ageGroup}{camp.gender ? ` • ${camp.gender}` : ""}</span>
                  <span>{format(new Date(camp.startDate), "MMM d")} - {format(new Date(camp.endDate), "MMM d, yyyy")}</span>
                  <span>{camp.numberOfWeeks} week{camp.numberOfWeeks !== 1 ? "s" : ""}</span>
                  <span>{camp.location}</span>
                </div>

                {/* Stats + actions */}
                <div className="flex flex-wrap items-center gap-3">
                  <div>
                    <div className="text-lg font-bold text-play-700">
                      {camp._count.signups}{camp.maxParticipants ? ` / ${camp.maxParticipants}` : ""}
                    </div>
                    <div className="text-xs text-ink-500">registered</div>
                  </div>
                  <div className="text-sm">
                    <div className="font-medium">{formatCurrency(camp.weeklyFee)}/wk</div>
                    {camp.fullCampFee && camp.numberOfWeeks > 1 && (
                      <div className="text-xs text-green-600">{formatCurrency(camp.fullCampFee)} all</div>
                    )}
                  </div>
                  <div className="ml-auto flex flex-wrap items-center gap-2">
                    {lifecycle.can.viewRegistrants && (
                      <Button
                        href={`/clubs/${clubId}/camps/${camp.id}/signups`}
                        variant="subtle"
                        size="sm"
                        icon={ICONS.users}
                      >
                        Registrants &middot; {camp._count.signups}
                      </Button>
                    )}
                    {lifecycle.can.edit && (
                      <Button
                        href={`/clubs/${clubId}/camps/${camp.id}/edit`}
                        variant="subtle"
                        size="sm"
                        icon={ICONS.pencil}
                      >
                        Edit
                      </Button>
                    )}
                    <Button href={`/camp/${camp.id}`} variant="subtle" size="sm" icon={ICONS.eye}>
                      View public
                    </Button>
                    {lifecycle.can.publish && (
                      <Button
                        onClick={() => togglePublish(camp.id, true)}
                        disabled={togglingId === camp.id}
                        size="sm"
                      >
                        {togglingId === camp.id ? "..." : "Publish"}
                      </Button>
                    )}
                    {lifecycle.can.unpublish && (
                      <Button
                        onClick={() => togglePublish(camp.id, false)}
                        disabled={togglingId === camp.id}
                        variant="subtle"
                        size="sm"
                      >
                        {togglingId === camp.id ? "..." : "Unpublish"}
                      </Button>
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

/** Leading SVG icons for the kit Buttons (the Button component sizes them). */
const ICONS: Record<string, ReactNode> = {
  users: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" strokeLinecap="round" />
    </svg>
  ),
  pencil: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 20h9M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4 12.5-12.5z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  eye: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
}
