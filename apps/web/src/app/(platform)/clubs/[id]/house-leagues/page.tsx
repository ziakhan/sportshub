"use client"

import { useState, useEffect } from "react"
import type { ReactNode } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { format } from "date-fns"
import { formatCurrency } from "@/lib/countries"
import { Badge, Button } from "@/components/ui"
import { programLifecycle } from "@/lib/lifecycle"

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
  const router = useRouter()
  const clubId = params?.id as string
  const [leagues, setLeagues] = useState<HouseLeague[]>([])
  const [loading, setLoading] = useState(true)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = () => {
    fetch(`/api/house-leagues?tenantId=${clubId}`)
      .then((res) => res.json())
      .then((data) => setLeagues(data.leagues || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(refresh, [clubId]) // eslint-disable-line react-hooks/exhaustive-deps

  const togglePublish = async (id: string, publish: boolean) => {
    setTogglingId(id)
    try {
      await fetch(`/api/house-leagues/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublished: publish }),
      })
      setLeagues((prev) =>
        prev.map((l) => (l.id === id ? { ...l, isPublished: publish } : l))
      )
    } finally {
      setTogglingId(null)
    }
  }

  const duplicateLeague = async (id: string) => {
    setDuplicatingId(id)
    try {
      const res = await fetch(`/api/house-leagues/${id}/duplicate`, { method: "POST" })
      if (!res.ok) {
        alert("Failed to duplicate program. Please try again.")
        return
      }
      const data = await res.json()
      router.push(`/clubs/${clubId}/house-leagues/${data.id}/edit`)
    } catch {
      alert("Failed to duplicate program. Please try again.")
    } finally {
      setDuplicatingId(null)
    }
  }

  const deleteLeague = async (league: HouseLeague) => {
    const count = league._count.signups
    const confirmed = window.confirm(
      `Delete "${league.name}"? This permanently removes the program and its ${count} registration${count === 1 ? "" : "s"}. Every registered family is notified. Unpaid fees are cancelled automatically. If families already PAID through the platform, you must process their refunds. If you collected money outside the platform (cash/e-transfer), refunding those families is your responsibility — the platform takes no part in offline payments. This cannot be undone.`
    )
    if (!confirmed) return

    setDeletingId(league.id)
    setError(null)
    try {
      const res = await fetch(`/api/house-leagues/${league.id}`, { method: "DELETE" })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Couldn't delete the program.")
      }
      refresh()
    } catch (e: any) {
      setError(e?.message || "Couldn't delete the program.")
    } finally {
      setDeletingId(null)
    }
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

      {error && (
        <div className="border-hoop-200 text-hoop-700 mb-4 rounded-lg border bg-red-50 p-3 text-sm">
          {error}
        </div>
      )}

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
          {leagues.map((league, i) => {
            const lifecycle = programLifecycle({
              isPublished: league.isPublished,
              startAt: league.startDate,
              endAt: league.endDate,
              maxParticipants: league.maxParticipants,
              signupCount: league._count.signups,
            })
            return (
              <div
                key={league.id}
                className="reveal card-lift rounded-2xl border border-ink-100 bg-white p-6 shadow-soft hover:shadow-panel hover:border-[color:var(--brand-line)]"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                {/* Title + badges */}
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-semibold text-ink-900">{league.name}</h3>
                  <Badge tone={lifecycle.badge.tone} dot={lifecycle.badge.dot}>
                    {lifecycle.label}
                  </Badge>
                </div>

                {/* Details */}
                <div className="mb-4 flex flex-wrap gap-3 text-sm text-ink-500">
                  <span>{league.ageGroups.split(",").join(", ")}{league.gender ? ` • ${league.gender}` : ""}</span>
                  <span>{league.daysOfWeek} {league.startTime}-{league.endTime}</span>
                  <span>{format(new Date(league.startDate), "MMM d")} - {format(new Date(league.endDate), "MMM d, yyyy")}</span>
                  <span>{league.location}</span>
                </div>

                {/* Stats + actions */}
                <div className="flex flex-wrap items-center gap-3">
                  <div>
                    <div className="text-lg font-bold text-play-700">
                      {league._count.signups}
                      {league.maxParticipants ? ` / ${league.maxParticipants}` : ""}
                    </div>
                    <div className="text-xs text-ink-500">registered</div>
                  </div>
                  <div className="text-sm font-medium text-ink-700">
                    {formatCurrency(league.fee)}
                  </div>
                  <div className="ml-auto flex flex-wrap items-center gap-2">
                    {lifecycle.can.viewRegistrants && (
                      <Button
                        href={`/clubs/${clubId}/house-leagues/${league.id}/signups`}
                        variant="subtle"
                        size="sm"
                        icon={ICONS.users}
                      >
                        Registrants &middot; {league._count.signups}
                      </Button>
                    )}
                    {lifecycle.can.edit && (
                      <Button
                        href={`/clubs/${clubId}/house-leagues/${league.id}/edit`}
                        variant="subtle"
                        size="sm"
                        icon={ICONS.pencil}
                      >
                        Edit
                      </Button>
                    )}
                    <Button
                      onClick={() => duplicateLeague(league.id)}
                      disabled={duplicatingId === league.id}
                      variant="subtle"
                      size="sm"
                      icon={ICONS.copy}
                    >
                      {duplicatingId === league.id ? "..." : "Duplicate"}
                    </Button>
                    <Button
                      href={`/house-league/${league.id}`}
                      variant="subtle"
                      size="sm"
                      icon={ICONS.eye}
                    >
                      View public
                    </Button>
                    {lifecycle.can.publish && (
                      <Button
                        onClick={() => togglePublish(league.id, true)}
                        disabled={togglingId === league.id}
                        size="sm"
                      >
                        {togglingId === league.id ? "..." : "Publish"}
                      </Button>
                    )}
                    {lifecycle.can.unpublish && (
                      <Button
                        onClick={() => togglePublish(league.id, false)}
                        disabled={togglingId === league.id}
                        variant="subtle"
                        size="sm"
                      >
                        {togglingId === league.id ? "..." : "Unpublish"}
                      </Button>
                    )}
                    <button
                      type="button"
                      onClick={() => deleteLeague(league)}
                      disabled={deletingId === league.id}
                      className="text-sm text-red-500 hover:text-hoop-700 disabled:opacity-50"
                    >
                      {deletingId === league.id ? "..." : "Delete"}
                    </button>
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
  copy: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
}
