"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { format } from "date-fns"
import { formatCurrency } from "@/lib/countries"

interface HouseLeagueDetail {
  id: string
  name: string
  description: string | null
  details: string | null
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
  includesUniform: boolean
  includesJersey: boolean
  includesBall: boolean
  includesMedal: boolean
  isPublished: boolean
  _count: { signups: number }
  tenant: {
    id: string
    name: string
    slug: string
    currency: string
    branding: { primaryColor: string } | null
  }
}

export default function PublicHouseLeaguePage() {
  const params = useParams()
  const id = params?.id as string
  const [league, setLeague] = useState<HouseLeagueDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/house-leagues/${id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.id) setLeague(data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="text-gray-500 py-12 text-center">Loading...</div>
  if (!league) return <div className="text-gray-500 py-12 text-center">Program not found.</div>

  const isPast = new Date(league.endDate) < new Date()
  const isFull = league.maxParticipants !== null && league._count.signups >= league.maxParticipants
  const spotsLeft = league.maxParticipants ? league.maxParticipants - league._count.signups : null
  const currency = league.tenant.currency || "CAD"
  const primaryColor = league.tenant.branding?.primaryColor || "#1a73e8"

  const included = [
    league.includesUniform && "Uniform (Shirt + Shorts)",
    league.includesJersey && "Jersey",
    league.includesBall && "Basketball",
    league.includesMedal && "Medal/Trophy",
  ].filter(Boolean)

  const days = league.daysOfWeek.split(",").map((d) => d.trim())

  return (
    <>
      {/* Banner */}
      <div className="border-b" style={{ backgroundColor: primaryColor }}>
        <div className="container mx-auto px-4 py-6">
          <Link href="/marketplace" className="mb-2 inline-block text-sm text-white/80 hover:text-white">
            &larr; Back
          </Link>
          <Link href={`/club/${league.tenant.slug}`}>
            <h2 className="text-lg font-semibold text-white hover:text-white/90">{league.tenant.name}</h2>
          </Link>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Main */}
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-lg bg-white p-8 shadow border border-gray-200">
              <div className="mb-4 flex items-center gap-3">
                {isPast && <span className="rounded-full bg-gray-200 px-3 py-1 text-sm font-medium text-gray-700">Ended</span>}
                {!isPast && !isFull && <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700">Open</span>}
                {isFull && !isPast && <span className="rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-700">Full</span>}
                {league.season && <span className="rounded-full bg-orange-100 px-3 py-1 text-sm font-medium text-orange-700">{league.season}</span>}
              </div>

              <h1 className="text-3xl font-bold text-gray-900 mb-2">{league.name}</h1>
              <p className="text-gray-500 mb-4">
                {league.ageGroups.split(",").join(", ")}{league.gender ? ` \u2022 ${league.gender}` : ""}
              </p>

              {league.description && (
                <p className="text-gray-700 mb-6">{league.description}</p>
              )}

              {/* Schedule */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-md bg-gray-50 p-4">
                  <div className="text-sm font-medium text-gray-500 mb-1">Dates</div>
                  <div className="text-gray-900">
                    {format(new Date(league.startDate), "MMM d")} - {format(new Date(league.endDate), "MMM d, yyyy")}
                  </div>
                </div>
                <div className="rounded-md bg-gray-50 p-4">
                  <div className="text-sm font-medium text-gray-500 mb-1">Weekly Schedule</div>
                  <div className="text-gray-900">
                    {days.join(", ")} {league.startTime} - {league.endTime}
                  </div>
                </div>
                <div className="rounded-md bg-gray-50 p-4">
                  <div className="text-sm font-medium text-gray-500 mb-1">Location</div>
                  <div className="text-gray-900">{league.location}</div>
                </div>
                <div className="rounded-md bg-gray-50 p-4">
                  <div className="text-sm font-medium text-gray-500 mb-1">Spots</div>
                  <div className="text-gray-900">
                    {league._count.signups} registered
                    {spotsLeft !== null && <span className="text-sm text-gray-500"> ({spotsLeft} left)</span>}
                  </div>
                </div>
              </div>
            </div>

            {/* Details / What's Included */}
            {(league.details || included.length > 0) && (
              <div className="rounded-lg bg-white p-8 shadow border border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">What&apos;s Included</h2>

                {included.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {included.map((item) => (
                      <span key={item as string} className="rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700">
                        {item}
                      </span>
                    ))}
                  </div>
                )}

                {league.details && (
                  <div className="text-gray-700 whitespace-pre-line">{league.details}</div>
                )}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div>
            <div className="rounded-lg bg-white p-6 shadow border border-gray-200 sticky top-4">
              <div className="mb-4 text-center">
                <div className="text-3xl font-bold text-orange-600">
                  {league.fee === 0 ? "FREE" : formatCurrency(league.fee, currency)}
                </div>
                <p className="text-xs text-gray-500 mt-1">per player</p>
              </div>

              {isPast ? (
                <div className="rounded-md bg-gray-100 p-4 text-center text-sm text-gray-600">
                  This program has ended.
                </div>
              ) : isFull ? (
                <div className="rounded-md bg-red-50 p-4 text-center text-sm text-red-600">
                  This program is full.
                </div>
              ) : (
                <Link
                  href={`/sign-in?callbackUrl=/dashboard`}
                  className="block w-full rounded-md bg-orange-500 px-4 py-3 text-center font-semibold text-white hover:bg-orange-600"
                >
                  Sign Up
                </Link>
              )}

              <div className="mt-4 text-center">
                <Link href={`/club/${league.tenant.slug}`} className="text-sm text-orange-600 hover:underline">
                  View {league.tenant.name} &rarr;
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
