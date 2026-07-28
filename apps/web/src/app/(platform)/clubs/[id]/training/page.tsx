"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { Badge, Button } from "@/components/ui"
import { programLifecycle } from "@/lib/lifecycle"
import { formatCurrency } from "@/lib/countries"
import { formatTrainingSchedule, trainingTypeLabel } from "@/lib/training"

interface SessionRow {
  id: string
  title: string
  sessionType: string
  scheduleType: string
  startAt: string | null
  dayOfWeek: number | null
  startTime: string | null
  startDate: string | null
  endDate: string | null
  durationMinutes: number
  capacity: number | null
  fee: number
  location: string | null
  isPublished: boolean
  _count: { signups: number }
}

export default function ClubTrainingPage() {
  const params = useParams()
  const clubId = params?.id as string
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = () => {
    fetch(`/api/training-sessions?tenantId=${clubId}`)
      .then((res) => res.json())
      .then((data) => setSessions(data.sessions || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(refresh, [clubId]) // eslint-disable-line react-hooks/exhaustive-deps

  const togglePublish = async (id: string, publish: boolean) => {
    setBusyId(id)
    setError(null)
    try {
      const res = await fetch(`/api/training-sessions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublished: publish }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Couldn't update")
      }
      refresh()
    } catch (e: any) {
      setError(e?.message || "Couldn't update the session.")
    } finally {
      setBusyId(null)
    }
  }

  const remove = async (id: string, title: string, registrationCount: number) => {
    const confirmed = confirm(
      `Delete "${title}"? This permanently removes the program and its ${registrationCount} registration${registrationCount === 1 ? "" : "s"}. Every registered family is notified. Unpaid fees are cancelled automatically. If families already PAID through the platform, you must process their refunds. If you collected money outside the platform (cash/e-transfer), refunding those families is your responsibility — the platform takes no part in offline payments. This cannot be undone.`
    )
    if (!confirmed) return
    setBusyId(id)
    setError(null)
    try {
      const res = await fetch(`/api/training-sessions/${id}`, { method: "DELETE" })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Couldn't delete")
      }
      refresh()
    } catch (e: any) {
      setError(e?.message || "Couldn't delete the session.")
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-ink-900 text-2xl font-semibold">Training Programs</h2>
          <p className="text-ink-500 mt-1 text-sm">
            Group training, clinics, strength &amp; conditioning, and open workouts families can
            register for.
          </p>
        </div>
        <Link href={`/clubs/${clubId}/training/create`}>
          <Button>New Program</Button>
        </Link>
      </div>

      {error && (
        <div className="border-hoop-200 text-hoop-700 mb-4 rounded-lg border bg-red-50 p-3 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-ink-500 text-sm">Loading…</p>
      ) : sessions.length === 0 ? (
        <div className="border-ink-200 rounded-2xl border border-dashed bg-white p-10 text-center">
          <p className="text-ink-700 font-medium">No training programs yet</p>
          <p className="text-ink-500 mt-1 text-sm">
            Create your first program — it goes live in the marketplace when you publish it.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((s) => (
            <div
              key={s.id}
              className="border-ink-100 flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-white p-4"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-ink-900 font-semibold">{s.title}</span>
                  {(() => {
                    // Real lifecycle (Full/In progress/Ended), not just a
                    // published bit — audit 2026-07-23.
                    const lc = programLifecycle({
                      isPublished: s.isPublished,
                      startAt: s.scheduleType === "RECURRING" ? (s.startDate ?? new Date()) : (s.startAt ?? new Date()),
                      endAt: s.scheduleType === "RECURRING" ? s.endDate : s.startAt,
                      maxParticipants: s.capacity,
                      signupCount: s._count.signups,
                    })
                    return <Badge tone={lc.badge.tone} dot={lc.badge.dot}>{lc.label}</Badge>
                  })()}
                  <span className="text-ink-400 text-xs">{trainingTypeLabel(s.sessionType)}</span>
                </div>
                <p className="text-ink-500 mt-1 text-sm">
                  {formatTrainingSchedule(s)} · {s.durationMinutes} min
                  {s.location ? ` · ${s.location}` : ""}
                </p>
                <p className="text-ink-500 mt-0.5 text-sm">
                  {formatCurrency(s.fee, "CAD")}
                  {s.capacity
                    ? ` · ${s._count.signups}/${s.capacity} registered`
                    : ` · ${s._count.signups} registered`}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Link
                  href={`/clubs/${clubId}/training/${s.id}/edit`}
                  className="text-play-700 hover:text-play-800 text-sm font-semibold"
                >
                  Edit
                </Link>
                <Button
                  size="sm"
                  variant={s.isPublished ? "secondary" : "primary"}
                  disabled={busyId === s.id}
                  onClick={() => togglePublish(s.id, !s.isPublished)}
                >
                  {s.isPublished ? "Unpublish" : "Publish"}
                </Button>
                {s._count.signups === 0 && (
                  <button
                    onClick={() => remove(s.id, s.title, s._count.signups)}
                    disabled={busyId === s.id}
                    className="hover:text-hoop-700 text-sm text-red-500"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
