"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { format } from "date-fns"
import { formatCurrency } from "@/lib/countries"

const CAMP_TYPE_LABELS: Record<string, string> = {
  MARCH_BREAK: "March Break Camp",
  HOLIDAY: "Holiday Camp",
  SUMMER: "Summer Camp",
  WEEKLY: "Weekly Camp",
}

export default function PublicCampDetailPage() {
  const params = useParams()
  const id = params?.id as string
  const [camp, setCamp] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/camps/${id}`)
      .then((res) => res.json())
      .then((data) => { if (data.id) setCamp(data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="text-gray-500 py-12 text-center">Loading...</div>
  if (!camp) return <div className="text-gray-500 py-12 text-center">Camp not found.</div>

  const isPast = new Date(camp.endDate) < new Date()
  const isFull = camp.maxParticipants && camp._count.signups >= camp.maxParticipants
  const spotsLeft = camp.maxParticipants ? camp.maxParticipants - camp._count.signups : null
  const currency = camp.tenant.currency || "CAD"
  const primaryColor = camp.tenant.branding?.primaryColor || "#1a73e8"
  const weeks = camp.numberOfWeeks
  const hasDiscount = camp.fullCampFee && weeks > 1 && camp.fullCampFee < camp.weeklyFee * weeks
  const savingsPercent = hasDiscount ? Math.round((1 - camp.fullCampFee / (camp.weeklyFee * weeks)) * 100) : 0

  const included = [
    camp.includesLunch && "Lunch",
    camp.includesSnacks && "Snacks",
    camp.includesJersey && "Jersey/T-Shirt",
    camp.includesBall && "Basketball",
  ].filter(Boolean)

  return (
    <>
      <div className="border-b" style={{ backgroundColor: primaryColor }}>
        <div className="container mx-auto px-4 py-6">
          <Link href="/events" className="mb-2 inline-block text-sm text-white/80 hover:text-white">&larr; Back to Events</Link>
          <Link href={`/club/${camp.tenant.slug}`}>
            <h2 className="text-lg font-semibold text-white hover:text-white/90">{camp.tenant.name}</h2>
          </Link>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-lg bg-white p-8 shadow border border-gray-200">
              <div className="mb-4 flex items-center gap-3">
                <span className="rounded-full bg-purple-100 px-3 py-1 text-sm font-medium text-purple-700">
                  {CAMP_TYPE_LABELS[camp.campType] || camp.campType}
                </span>
                {isPast && <span className="rounded-full bg-gray-200 px-3 py-1 text-sm font-medium text-gray-700">Ended</span>}
                {!isPast && !isFull && <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700">Open</span>}
                {isFull && !isPast && <span className="rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-700">Full</span>}
              </div>

              <h1 className="text-3xl font-bold text-gray-900 mb-2">{camp.name}</h1>
              <p className="text-gray-500 mb-4">{camp.ageGroup}{camp.gender ? ` \u2022 ${camp.gender}` : ""}</p>

              {camp.description && <p className="text-gray-700 mb-6">{camp.description}</p>}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-md bg-gray-50 p-4">
                  <div className="text-sm font-medium text-gray-500 mb-1">Dates</div>
                  <div className="text-gray-900">
                    {format(new Date(camp.startDate), "MMM d")} - {format(new Date(camp.endDate), "MMM d, yyyy")}
                  </div>
                  <div className="text-sm text-gray-500">{weeks} week{weeks !== 1 ? "s" : ""}</div>
                </div>
                <div className="rounded-md bg-gray-50 p-4">
                  <div className="text-sm font-medium text-gray-500 mb-1">Daily Schedule</div>
                  <div className="text-gray-900">{camp.dailyStartTime} - {camp.dailyEndTime}</div>
                </div>
                <div className="rounded-md bg-gray-50 p-4">
                  <div className="text-sm font-medium text-gray-500 mb-1">Location</div>
                  <div className="text-gray-900">{camp.location}</div>
                </div>
                <div className="rounded-md bg-gray-50 p-4">
                  <div className="text-sm font-medium text-gray-500 mb-1">Spots</div>
                  <div className="text-gray-900">
                    {camp._count.signups} registered
                    {spotsLeft !== null && <span className="text-sm text-gray-500"> ({spotsLeft} left)</span>}
                  </div>
                </div>
              </div>
            </div>

            {(camp.details || included.length > 0) && (
              <div className="rounded-lg bg-white p-8 shadow border border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">What&apos;s Included</h2>
                {included.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {included.map((item) => (
                      <span key={item as string} className="rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700">{item}</span>
                    ))}
                  </div>
                )}
                {camp.details && <div className="text-gray-700 whitespace-pre-line">{camp.details}</div>}
              </div>
            )}
          </div>

          <div>
            <div className="rounded-lg bg-white p-6 shadow border border-gray-200 sticky top-4">
              <div className="mb-4 text-center">
                <div className="text-3xl font-bold text-blue-600">
                  {formatCurrency(camp.weeklyFee, currency)}
                </div>
                <p className="text-xs text-gray-500">per week</p>

                {hasDiscount && (
                  <div className="mt-2 rounded-md bg-green-50 p-3">
                    <div className="text-lg font-bold text-green-700">
                      {formatCurrency(camp.fullCampFee, currency)}
                    </div>
                    <p className="text-xs text-green-600">
                      All {weeks} weeks — save {savingsPercent}%
                    </p>
                  </div>
                )}
              </div>

              {isPast ? (
                <div className="rounded-md bg-gray-100 p-4 text-center text-sm text-gray-600">This camp has ended.</div>
              ) : isFull ? (
                <div className="rounded-md bg-red-50 p-4 text-center text-sm text-red-600">This camp is full.</div>
              ) : (
                <Link href="/sign-in?callbackUrl=/dashboard"
                  className="block w-full rounded-md bg-blue-600 px-4 py-3 text-center font-semibold text-white hover:bg-blue-700">
                  Sign Up
                </Link>
              )}

              <div className="mt-4 text-center">
                <Link href={`/club/${camp.tenant.slug}`} className="text-sm text-blue-600 hover:underline">
                  View {camp.tenant.name} &rarr;
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
