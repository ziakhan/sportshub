"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { DateTimePicker } from "@/components/ui"
import { VenueSelector } from "@/components/venue-selector"
import { AgePolicySelect } from "@/components/registration/age-policy-select"
import { TRAINING_SESSION_TYPES } from "@/lib/training"

export interface TrainingSessionFormValues {
  title: string
  description: string
  sessionType: string
  ageGroup: string
  agePolicy: string
  gender: string
  scheduleType: "ONE_TIME" | "RECURRING"
  startAt: string
  dayOfWeek: number
  /** Multi-day recurrence (QA-203) — wins over dayOfWeek when >1 selected. */
  daysOfWeek: number[]
  /** Group-size tier families filter by (QA-202). "" = none set. */
  groupTier: string
  startTime: string
  startDate: string
  endDate: string
  durationMinutes: number
  capacity: string
  fee: string
  venueId: string
  venueName: string
  location: string
}

export const EMPTY_TRAINING_FORM: TrainingSessionFormValues = {
  title: "",
  description: "",
  sessionType: "GROUP_TRAINING",
  ageGroup: "",
  agePolicy: "PREFERRED",
  gender: "",
  scheduleType: "ONE_TIME",
  startAt: "",
  dayOfWeek: 2,
  daysOfWeek: [2],
  groupTier: "",
  startTime: "18:00",
  startDate: "",
  endDate: "",
  durationMinutes: 60,
  capacity: "",
  fee: "",
  venueId: "",
  venueName: "",
  location: "",
}

const DAY_ABBR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

const GROUP_TIERS = [
  { value: "", label: "Not set" },
  { value: "PRIVATE", label: "Private (1-on-1)" },
  { value: "SMALL_GROUP", label: "Small group (2-4)" },
  { value: "LARGE_GROUP", label: "Large group (6-10)" },
]

/**
 * Shared create/edit form for a trainer's Training Program (batch-backlog
 * §5): preset TYPE dropdown drives discovery; the trainer freely NAMES the
 * program (owner ruling: hybrid preset + custom naming).
 */
export function TrainingSessionForm({
  clubId,
  sessionId,
  initial,
}: {
  clubId: string
  sessionId?: string
  initial: TrainingSessionFormValues
}) {
  const router = useRouter()
  const [values, setValues] = useState<TrainingSessionFormValues>(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = <K extends keyof TrainingSessionFormValues>(
    key: K,
    value: TrainingSessionFormValues[K]
  ) => setValues((v) => ({ ...v, [key]: value }))

  const labelClass = "block text-sm font-medium text-ink-700"
  const inputClass =
    "mt-1 block w-full rounded-xl border border-ink-200 px-3 py-2 text-ink-900 shadow-sm focus:border-play-500 focus:outline-none focus:ring-2 focus:ring-play-500/20"

  const toggleDay = (day: number) =>
    setValues((v) => {
      const daysOfWeek = v.daysOfWeek.includes(day)
        ? v.daysOfWeek.filter((d) => d !== day)
        : [...v.daysOfWeek, day].sort((a, b) => a - b)
      return { ...v, daysOfWeek }
    })

  const submit = async () => {
    setError(null)
    if (values.title.trim().length < 3) return setError("Give the program a name.")
    if (values.scheduleType === "ONE_TIME" && !values.startAt)
      return setError("Pick a date and time.")
    if (
      values.scheduleType === "RECURRING" &&
      (values.daysOfWeek.length === 0 || !values.startTime || !values.startDate || !values.endDate)
    )
      return setError("Recurring programs need at least one weekday, a time, and a date range.")
    const fee = Number(values.fee)
    if (Number.isNaN(fee) || fee < 0) return setError("Enter a fee (0 for free).")

    setSaving(true)
    try {
      const payload: any = {
        title: values.title.trim(),
        description: values.description.trim() || undefined,
        sessionType: values.sessionType,
        ageGroup: values.ageGroup.trim() || undefined,
        agePolicy: values.agePolicy,
        gender: values.gender || undefined,
        groupTier: values.groupTier || null,
        scheduleType: values.scheduleType,
        durationMinutes: Number(values.durationMinutes),
        capacity: values.capacity ? Number(values.capacity) : null,
        fee,
        venueId: values.venueId || null,
        location: values.location.trim() || undefined,
      }
      if (values.scheduleType === "ONE_TIME") {
        payload.startAt = new Date(values.startAt).toISOString()
      } else {
        // A single selection also fills the legacy dayOfWeek column
        // (back-compat for older fielded clients that only read it).
        payload.dayOfWeek = values.daysOfWeek.length > 0 ? Math.min(...values.daysOfWeek) : null
        payload.daysOfWeek = values.daysOfWeek
        payload.startTime = values.startTime
        payload.startDate = values.startDate
        payload.endDate = values.endDate
      }
      if (!sessionId) payload.tenantId = clubId

      const res = await fetch(
        sessionId ? `/api/training-sessions/${sessionId}` : "/api/training-sessions",
        {
          method: sessionId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Couldn't save the program")
      router.push(`/clubs/${clubId}/training`)
      router.refresh()
    } catch (e: any) {
      setError(e?.message || "Couldn't save the program.")
      setSaving(false)
    }
  }

  return (
    <div className="border-ink-100 space-y-5 rounded-3xl border bg-white p-6 md:p-8">
      {error && (
        <div className="border-hoop-200 text-hoop-700 rounded-lg border bg-red-50 p-3 text-sm">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Program type</label>
          <select
            value={values.sessionType}
            onChange={(e) => set("sessionType", e.target.value)}
            className={inputClass}
          >
            {TRAINING_SESSION_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Program name</label>
          <input
            value={values.title}
            onChange={(e) => set("title", e.target.value)}
            maxLength={150}
            placeholder="Elite Guard Skills — Small Group"
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label className={labelClass}>
          Description <span className="text-ink-400 font-normal">(optional)</span>
        </label>
        <textarea
          value={values.description}
          onChange={(e) => set("description", e.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="What players work on, who it's for, what to bring."
          className={inputClass}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>
            Age group <span className="text-ink-400 font-normal">(optional)</span>
          </label>
          <input
            value={values.ageGroup}
            onChange={(e) => set("ageGroup", e.target.value)}
            maxLength={50}
            placeholder="2012-2014"
            className={inputClass}
          />
        </div>
        <AgePolicySelect
          value={values.agePolicy}
          onChange={(v) => set("agePolicy", v)}
        />
        <div>
          <label className={labelClass}>
            Who can join <span className="text-ink-400 font-normal">(optional)</span>
          </label>
          <select
            value={values.gender}
            onChange={(e) => set("gender", e.target.value)}
            className={inputClass}
          >
            <option value="">Everyone</option>
            <option value="COED">Coed</option>
            <option value="MALE">Boys</option>
            <option value="FEMALE">Girls</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>
            Group size <span className="text-ink-400 font-normal">(optional)</span>
          </label>
          <select
            value={values.groupTier}
            onChange={(e) => set("groupTier", e.target.value)}
            className={inputClass}
          >
            {GROUP_TIERS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="border-ink-200 border-t pt-5">
        <label className={labelClass}>Schedule</label>
        <div className="mt-2 flex gap-2">
          {(
            [
              ["ONE_TIME", "One-time session"],
              ["RECURRING", "Weekly recurring"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => set("scheduleType", value)}
              className={`rounded-xl border px-3 py-1.5 text-sm font-semibold ${
                values.scheduleType === value
                  ? "border-play-500 bg-play-50 text-play-700"
                  : "border-ink-200 text-ink-600"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {values.scheduleType === "ONE_TIME" ? (
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>When</label>
              <DateTimePicker
                mode="datetime"
                value={values.startAt}
                onChange={(v) => set("startAt", v)}
              />
            </div>
            <div>
              <label className={labelClass}>Duration</label>
              <select
                value={values.durationMinutes}
                onChange={(e) => set("durationMinutes", Number(e.target.value))}
                className={inputClass}
              >
                {[30, 45, 60, 75, 90, 120, 180].map((m) => (
                  <option key={m} value={m}>
                    {m} min
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : (
          <div className="mt-3 space-y-4">
            <div>
              <label className={labelClass}>Days of week</label>
              <div className="mt-1 flex flex-wrap gap-2">
                {DAY_ABBR.map((label, i) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => toggleDay(i)}
                    className={`rounded-md border px-3 py-1.5 text-sm font-medium ${
                      values.daysOfWeek.includes(i)
                        ? "border-play-600 bg-play-600 text-white"
                        : "border-ink-200 text-ink-600 hover:bg-court-50"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-xs text-ink-400">Pick every weekday this program runs.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Start time</label>
                <DateTimePicker
                  mode="time"
                  value={values.startTime}
                  onChange={(v) => set("startTime", v)}
                />
              </div>
              <div>
                <label className={labelClass}>First session</label>
                <DateTimePicker
                  mode="date"
                  value={values.startDate}
                  onChange={(v) => set("startDate", v)}
                />
              </div>
              <div>
                <label className={labelClass}>Last session</label>
                <DateTimePicker
                  mode="date"
                  value={values.endDate}
                  onChange={(v) => set("endDate", v)}
                />
              </div>
              <div>
                <label className={labelClass}>Duration</label>
                <select
                  value={values.durationMinutes}
                  onChange={(e) => set("durationMinutes", Number(e.target.value))}
                  className={inputClass}
                >
                  {[30, 45, 60, 75, 90, 120, 180].map((m) => (
                    <option key={m} value={m}>
                      {m} min
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="border-ink-200 grid gap-4 border-t pt-5 sm:grid-cols-2">
        <div>
          <label className={labelClass}>
            Fee {values.scheduleType === "RECURRING" ? "(for the full program)" : ""}
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={values.fee}
            onChange={(e) => set("fee", e.target.value)}
            placeholder="0.00"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>
            Capacity <span className="text-ink-400 font-normal">(optional)</span>
          </label>
          <input
            type="number"
            min="1"
            value={values.capacity}
            onChange={(e) => set("capacity", e.target.value)}
            placeholder="e.g. 4 for small group"
            className={inputClass}
          />
        </div>
      </div>

      <div className="border-ink-200 border-t pt-5">
        <label className={labelClass}>
          Venue <span className="text-ink-400 font-normal">(optional)</span>
        </label>
        <div className="mt-1">
          <VenueSelector
            value={values.venueId}
            venueName={values.venueName}
            onSelect={(v) =>
              setValues((cur) => ({
                ...cur,
                venueId: v.id,
                venueName: v.name,
                location: `${v.name}, ${v.address}`,
              }))
            }
            onClear={() =>
              setValues((cur) => ({ ...cur, venueId: "", venueName: "", location: "" }))
            }
          />
        </div>
        {!values.venueId && (
          <input
            value={values.location}
            onChange={(e) => set("location", e.target.value)}
            maxLength={200}
            placeholder="or type a location"
            className={`${inputClass} mt-2`}
          />
        )}
      </div>

      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={() => router.push(`/clubs/${clubId}/training`)}
          className="text-ink-500 hover:text-ink-700 text-sm font-semibold"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={saving}
          className="bg-play-600 hover:bg-play-700 rounded-xl px-5 py-2 font-semibold text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : sessionId ? "Save Changes" : "Create Program"}
        </button>
      </div>
    </div>
  )
}
