"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import {
  TrainingSessionForm,
  EMPTY_TRAINING_FORM,
  type TrainingSessionFormValues,
} from "../../training-session-form"

function toDateInput(value: string | null): string {
  if (!value) return ""
  return new Date(value).toISOString().slice(0, 10)
}

function toDateTimeInput(value: string | null): string {
  if (!value) return ""
  const d = new Date(value)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function EditTrainingSessionPage() {
  const params = useParams()
  const clubId = params?.id as string
  const sessionId = params?.sessionId as string
  const [initial, setInitial] = useState<TrainingSessionFormValues | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/training-sessions/${sessionId}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then(({ session }) => {
        setInitial({
          ...EMPTY_TRAINING_FORM,
          title: session.title ?? "",
          description: session.description ?? "",
          sessionType: session.sessionType ?? "GROUP_TRAINING",
          ageGroup: session.ageGroup ?? "",
          gender: session.gender ?? "",
          scheduleType: session.scheduleType ?? "ONE_TIME",
          startAt: toDateTimeInput(session.startAt),
          dayOfWeek: session.dayOfWeek ?? 2,
          startTime: session.startTime ?? "18:00",
          startDate: toDateInput(session.startDate),
          endDate: toDateInput(session.endDate),
          durationMinutes: session.durationMinutes ?? 60,
          capacity: session.capacity ? String(session.capacity) : "",
          fee: String(session.fee ?? ""),
          venueId: session.venueId ?? "",
          venueName: session.venue?.name ?? "",
          location: session.location ?? "",
        })
      })
      .catch(() => setError("Couldn't load the program."))
  }, [sessionId])

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h2 className="text-ink-900 text-2xl font-semibold">Edit Training Program</h2>
      </div>
      {error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : initial ? (
        <TrainingSessionForm clubId={clubId} sessionId={sessionId} initial={initial} />
      ) : (
        <p className="text-ink-500 text-sm">Loading…</p>
      )}
    </div>
  )
}
