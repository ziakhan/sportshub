"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Badge, Button, ChipGroup, DateTimePicker } from "@/components/ui"

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

interface RequestRow {
  id: string
  kind: "WINDOW" | "BLACKOUT"
  status: "PENDING" | "APPROVED" | "DECLINED" | "CANCELLED"
  dayOfWeek: number | null
  date: string | null
  earliestStart: string | null
  latestStart: string | null
  startTime: string | null
  endTime: string | null
  reason: string
  decisionNote: string | null
  createdAt: string
}

/**
 * The preset menu (owner 2026-08-01: "very limited — they cannot really
 * choose"): three shapes with fixed time choices, a reason, nothing else.
 */
const PRESETS = [
  {
    key: "early-sunday",
    label: "Early Sunday game",
    hint: "We need to head home early on Sundays",
    times: ["11:00", "12:30"],
    timeLabel: (t: string) => `start by ${t}`,
  },
  {
    key: "late-saturday",
    label: "Later Saturday start",
    hint: "We can't make early Saturday tip-offs",
    times: ["14:00", "16:00"],
    timeLabel: (t: string) => `start after ${t}`,
  },
  {
    key: "blackout",
    label: "Blackout a date",
    hint: "We can't play at all that day",
    times: [],
    timeLabel: (_t: string) => "",
  },
] as const

const toneFor = (status: RequestRow["status"]) =>
  status === "PENDING"
    ? "gold"
    : status === "APPROVED"
      ? "court"
      : status === "DECLINED"
        ? "hoop"
        : "neutral"

const describe = (r: RequestRow): string => {
  const day =
    r.dayOfWeek !== null
      ? `every ${DAY_NAMES[r.dayOfWeek]}`
      : r.date
        ? new Date(r.date).toLocaleDateString("en-CA", {
            month: "short",
            day: "numeric",
            timeZone: "UTC",
          })
        : ""
  if (r.kind === "BLACKOUT") return `No games ${day}`
  const parts: string[] = []
  if (r.earliestStart) parts.push(`no earlier than ${r.earliestStart}`)
  if (r.latestStart) parts.push(`no later than ${r.latestStart}`)
  return `Games ${day} start ${parts.join(", ")}`
}

export function ScheduleRequestManager({
  submissions,
  highlight,
}: {
  submissions: Array<{ id: string; leagueLabel: string; requests: RequestRow[] }>
  highlight?: string
}) {
  const router = useRouter()
  const [openFor, setOpenFor] = useState<string | null>(
    highlight ?? (submissions.length === 1 ? submissions[0].id : null)
  )
  const [preset, setPreset] = useState<(typeof PRESETS)[number]["key"]>("early-sunday")
  const [time, setTime] = useState<string>("11:00")
  const [date, setDate] = useState("")
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (submissionId: string) => {
    setBusy(true)
    setError(null)
    try {
      const body: Record<string, unknown> = { submissionId, reason }
      if (preset === "early-sunday") {
        Object.assign(body, { kind: "WINDOW", dayOfWeek: 0, latestStart: time })
      } else if (preset === "late-saturday") {
        Object.assign(body, { kind: "WINDOW", dayOfWeek: 6, earliestStart: time })
      } else {
        Object.assign(body, { kind: "BLACKOUT", date })
      }
      const res = await fetch("/api/schedule-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || "Couldn't submit the request")
        return
      }
      setReason("")
      setDate("")
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  const cancel = async (requestId: string) => {
    if (!window.confirm("Cancel this request?")) return
    const res = await fetch(`/api/schedule-requests/${requestId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel" }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      window.alert(data.error || "Couldn't cancel the request")
      return
    }
    router.refresh()
  }

  const activePreset = PRESETS.find((p) => p.key === preset)!

  return (
    <div className="mt-6 space-y-6">
      {submissions.map((sub) => (
        <section
          key={sub.id}
          className={`border-ink-100 shadow-soft rounded-[28px] border bg-white p-6 ${
            highlight === sub.id ? "ring-play-200 ring-2" : ""
          }`}
        >
          <h2 className="text-ink-900 text-sm font-bold uppercase tracking-wide">
            {sub.leagueLabel}
          </h2>

          {sub.requests.length === 0 ? (
            <p className="text-ink-500 mt-2 text-sm">No requests yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {sub.requests.map((r) => (
                <li key={r.id} className="border-ink-100 rounded-xl border px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-ink-800 text-sm">{describe(r)}</span>
                    <Badge tone={toneFor(r.status) as any}>{r.status.toLowerCase()}</Badge>
                    {r.status === "PENDING" && (
                      <button
                        onClick={() => cancel(r.id)}
                        className="text-ink-400 cursor-pointer text-xs hover:underline"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                  <p className="text-ink-500 mt-0.5 text-xs">
                    &ldquo;{r.reason}&rdquo;
                    {r.decisionNote ? ` · league: ${r.decisionNote}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}

          {openFor === sub.id ? (
            <div className="border-ink-100 bg-ink-25 mt-4 rounded-2xl border p-4">
              <div className="flex flex-wrap gap-2">
                {PRESETS.map((p) => (
                  <button
                    key={p.key}
                    onClick={() => {
                      setPreset(p.key)
                      const first = p.times[0]
                      if (first) setTime(first)
                    }}
                    className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                      preset === p.key
                        ? "border-play-500 bg-play-50 text-play-700"
                        : "border-ink-200 text-ink-600 hover:border-ink-300"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <p className="text-ink-400 mt-2 text-xs">{activePreset.hint}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {activePreset.times.length > 0 ? (
                  <span className="text-ink-600 flex items-center gap-1.5 text-xs">
                    Time{/* preset times only — owner: clubs can't free-type */}
                    <ChipGroup
                      ariaLabel="Time"
                      value={time}
                      onChange={setTime}
                      options={activePreset.times.map((t) => ({
                        value: t,
                        label: activePreset.timeLabel(t),
                      }))}
                    />
                  </span>
                ) : (
                  <span className="text-ink-600 flex items-center gap-1.5 text-xs">
                    Date
                    <DateTimePicker mode="date" value={date} onChange={setDate} className="w-40" />
                  </span>
                )}
                <input
                  type="text"
                  placeholder="Why? (required — the league reads this)"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="border-ink-200 min-w-[220px] flex-1 rounded-lg border px-2 py-1 text-xs"
                />
                <Button
                  size="sm"
                  tone="play"
                  onClick={() => submit(sub.id)}
                  disabled={busy || reason.trim().length < 3 || (preset === "blackout" && !date)}
                >
                  {busy ? "Submitting…" : "Submit request"}
                </Button>
              </div>
              {error && <p className="text-hoop-700 mt-2 text-xs">{error}</p>}
              <p className="text-ink-400 mt-2 text-xs">
                Best effort only — the league may not always be able to honor this, especially once
                games are already scheduled. Submitting doesn&apos;t guarantee a change.
              </p>
            </div>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              className="mt-3"
              onClick={() => setOpenFor(sub.id)}
            >
              New request
            </Button>
          )}
        </section>
      ))}
    </div>
  )
}
