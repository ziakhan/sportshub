"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { format, isToday, isTomorrow, startOfWeek } from "date-fns"

/**
 * Live agenda: practices + games grouped by week, polling for updates every
 * 45s so a moved practice shows up without a refresh. Staff manage the
 * recurring practice days, announce the schedule (bell + email to the
 * team), and move/cancel single practices inline.
 */

interface PracticeView {
  id: string
  scheduledAt: string
  durationMinutes: number
  location: string | null
  notes: string | null
  status: "SCHEDULED" | "COMPLETED" | "CANCELLED"
}

interface GameView {
  id: string
  scheduledAt: string
  status: string
  isHome: boolean
  opponent: string
  usScore: number | null
  themScore: number | null
  venue: string | null
}

interface SlotView {
  id?: string
  dayOfWeek: number
  startTime: string
  durationMinutes: number
  location: string | null
}

const POLL_MS = 45_000
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

function timeLabel(startTime: string): string {
  const [h, m] = startTime.split(":").map(Number)
  const suffix = h >= 12 ? "PM" : "AM"
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return `${hour12}:${String(m).padStart(2, "0")} ${suffix}`
}

function dayHeading(date: Date): string {
  if (isToday(date)) return `Today · ${format(date, "EEE MMM d")}`
  if (isTomorrow(date)) return `Tomorrow · ${format(date, "EEE MMM d")}`
  return format(date, "EEEE, MMM d")
}

export function TeamCalendar({ teamId, isStaff }: { teamId: string; isStaff: boolean }) {
  const [practices, setPractices] = useState<PracticeView[]>([])
  const [games, setGames] = useState<GameView[]>([])
  const [slots, setSlots] = useState<SlotView[]>([])
  const [announcedAt, setAnnouncedAt] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [showSchedule, setShowSchedule] = useState(false)
  const [movingId, setMovingId] = useState<string | null>(null)
  const [moveValue, setMoveValue] = useState("")

  const refresh = useCallback(async () => {
    const [eventsRes, slotsRes] = await Promise.all([
      fetch(`/api/teams/${teamId}/practices?includeGames=1`),
      fetch(`/api/teams/${teamId}/practice-slots`),
    ])
    if (!eventsRes.ok || !slotsRes.ok) throw new Error()
    const events = await eventsRes.json()
    const slotData = await slotsRes.json()
    setPractices(events.practices)
    setGames(events.games)
    setSlots(slotData.slots)
    setAnnouncedAt(slotData.announcedAt)
  }, [teamId])

  useEffect(() => {
    let cancelled = false
    refresh()
      .catch(() => {
        if (!cancelled) setError("Couldn't load the calendar — refresh to try again.")
      })
      .finally(() => {
        if (!cancelled) setLoaded(true)
      })
    const timer = setInterval(() => {
      refresh().catch(() => {})
    }, POLL_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [refresh])

  async function announce() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/teams/${teamId}/practices/announce`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weeks: 10 }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setNotice(
        `Schedule announced — ${data.created} practice${data.created === 1 ? "" : "s"} added, ${data.notified} member${data.notified === 1 ? "" : "s"} notified.`
      )
      await refresh()
    } catch (e: any) {
      setError(e?.message || "Couldn't announce the schedule.")
    } finally {
      setBusy(false)
    }
  }

  async function saveSlots(next: SlotView[]) {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/teams/${teamId}/practice-slots`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slots: next.map((s) => ({
            dayOfWeek: s.dayOfWeek,
            startTime: s.startTime,
            durationMinutes: s.durationMinutes,
            location: s.location || undefined,
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSlots(data.slots)
    } catch (e: any) {
      setError(e?.message || "Couldn't save practice days.")
    } finally {
      setBusy(false)
    }
  }

  async function practiceAction(practiceId: string, body: any) {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/teams/${teamId}/practices/${practiceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setNotice("Change saved — the team has been notified.")
      setMovingId(null)
      await refresh()
    } catch (e: any) {
      setError(e?.message || "Couldn't update the practice.")
    } finally {
      setBusy(false)
    }
  }

  // Merge practices + games into day buckets
  const days = useMemo(() => {
    type Entry =
      | { kind: "practice"; at: Date; practice: PracticeView }
      | { kind: "game"; at: Date; game: GameView }
    const entries: Entry[] = [
      ...practices.map((p) => ({
        kind: "practice" as const,
        at: new Date(p.scheduledAt),
        practice: p,
      })),
      ...games.map((g) => ({ kind: "game" as const, at: new Date(g.scheduledAt), game: g })),
    ].sort((a, b) => a.at.getTime() - b.at.getTime())

    const cutoff = startOfWeek(new Date(), { weekStartsOn: 1 })
    const byDay = new Map<string, { date: Date; entries: Entry[] }>()
    for (const entry of entries) {
      if (entry.at < cutoff) continue
      const key = format(entry.at, "yyyy-MM-dd")
      const bucket = byDay.get(key) ?? { date: entry.at, entries: [] }
      bucket.entries.push(entry)
      byDay.set(key, bucket)
    }
    return [...byDay.values()]
  }, [practices, games])

  if (!loaded) {
    return <p className="text-ink-500 py-10 text-center text-sm">Loading calendar…</p>
  }

  return (
    <div className="space-y-4">
      {error && <p className="rounded-xl bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}
      {notice && (
        <p className="bg-court-50 text-court-700 rounded-xl px-4 py-2 text-sm">{notice}</p>
      )}

      {/* Practice days summary + staff manage */}
      <div className="border-ink-100 rounded-2xl border bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-ink-800 text-sm font-semibold">
              {slots.length > 0
                ? slots
                    .map((s) => `${DAYS[s.dayOfWeek]}s ${timeLabel(s.startTime)}`)
                    .join(" · ")
                : "Practice days TBD"}
            </p>
            <p className="text-ink-400 mt-0.5 text-xs">
              {announcedAt
                ? `Schedule announced ${format(new Date(announcedAt), "MMM d")}`
                : slots.length > 0
                  ? "Not announced yet — families haven't been notified"
                  : isStaff
                    ? "Set the days, then announce when the season nears"
                    : "Your coach will announce practice days closer to the season"}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <AddToPhone />
            {isStaff && (
              <button
                onClick={() => setShowSchedule((v) => !v)}
                className="border-ink-200 text-ink-700 hover:bg-ink-50 rounded-xl border px-3 py-1.5 text-xs font-semibold"
              >
                {showSchedule ? "Done" : "Manage"}
              </button>
            )}
          </div>
        </div>

        {isStaff && showSchedule && (
          <div className="border-ink-100 mt-3 space-y-2 border-t pt-3">
            {slots.map((slot, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <select
                  value={slot.dayOfWeek}
                  disabled={busy}
                  onChange={(e) =>
                    saveSlots(
                      slots.map((s, j) =>
                        j === i ? { ...s, dayOfWeek: Number(e.target.value) } : s
                      )
                    )
                  }
                  className="border-ink-200 rounded-lg border px-2 py-1.5 text-sm"
                >
                  {DAYS.map((d, di) => (
                    <option key={d} value={di}>
                      {d}
                    </option>
                  ))}
                </select>
                <input
                  type="time"
                  defaultValue={slot.startTime}
                  disabled={busy}
                  onBlur={(e) => {
                    if (e.target.value && e.target.value !== slot.startTime) {
                      saveSlots(
                        slots.map((s, j) => (j === i ? { ...s, startTime: e.target.value } : s))
                      )
                    }
                  }}
                  className="border-ink-200 rounded-lg border px-2 py-1.5 text-sm"
                />
                <select
                  value={slot.durationMinutes}
                  disabled={busy}
                  onChange={(e) =>
                    saveSlots(
                      slots.map((s, j) =>
                        j === i ? { ...s, durationMinutes: Number(e.target.value) } : s
                      )
                    )
                  }
                  className="border-ink-200 rounded-lg border px-2 py-1.5 text-sm"
                >
                  {[60, 75, 90, 105, 120, 150, 180].map((m) => (
                    <option key={m} value={m}>
                      {m} min
                    </option>
                  ))}
                </select>
                <input
                  defaultValue={slot.location ?? ""}
                  placeholder="Location"
                  maxLength={200}
                  disabled={busy}
                  onBlur={(e) => {
                    if (e.target.value !== (slot.location ?? "")) {
                      saveSlots(
                        slots.map((s, j) => (j === i ? { ...s, location: e.target.value } : s))
                      )
                    }
                  }}
                  className="border-ink-200 min-w-[120px] flex-1 rounded-lg border px-2 py-1.5 text-sm"
                />
                <button
                  onClick={() => saveSlots(slots.filter((_, j) => j !== i))}
                  disabled={busy}
                  className="text-ink-400 shrink-0 text-lg leading-none hover:text-red-500"
                  aria-label="Remove practice day"
                >
                  ×
                </button>
              </div>
            ))}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <button
                onClick={() =>
                  saveSlots([
                    ...slots,
                    { dayOfWeek: 2, startTime: "18:30", durationMinutes: 90, location: null },
                  ])
                }
                disabled={busy || slots.length >= 7}
                className="text-play-600 hover:text-play-700 text-xs font-semibold disabled:opacity-40"
              >
                + Add practice day
              </button>
              <button
                onClick={announce}
                disabled={busy || slots.length === 0}
                className="bg-play-600 hover:bg-play-700 rounded-xl px-4 py-2 text-xs font-semibold text-white disabled:opacity-40"
              >
                {announcedAt ? "Re-announce / extend schedule" : "Announce schedule to families"}
              </button>
            </div>
            <p className="text-ink-400 text-[11px]">
              Announcing creates dated practices for the next 10 weeks and notifies every family
              (bell + email). Re-announcing extends the dates — it never duplicates.
            </p>
          </div>
        )}
      </div>

      {/* Agenda */}
      {days.length === 0 ? (
        <div className="border-ink-200 rounded-2xl border border-dashed bg-white px-6 py-12 text-center">
          <p className="text-ink-700 text-sm font-semibold">Nothing scheduled yet</p>
          <p className="text-ink-500 mt-1 text-sm">
            {isStaff
              ? "Set practice days above and announce the schedule."
              : "Practices and games will appear here once scheduled."}
          </p>
        </div>
      ) : (
        days.map(({ date, entries }) => (
          <div key={format(date, "yyyy-MM-dd")}>
            <p className="text-ink-400 mb-1.5 text-xs font-bold uppercase tracking-wide">
              {dayHeading(date)}
            </p>
            <div className="space-y-1.5">
              {entries.map((entry) =>
                entry.kind === "practice" ? (
                  <div
                    key={`p-${entry.practice.id}`}
                    className={`border-ink-100 rounded-xl border bg-white px-4 py-2.5 ${
                      entry.practice.status === "CANCELLED" ? "opacity-60" : ""
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-ink-800 text-sm font-semibold">
                          <span
                            className={
                              entry.practice.status === "CANCELLED" ? "line-through" : ""
                            }
                          >
                            Practice · {format(entry.at, "h:mm a")}
                          </span>
                          {entry.practice.status === "CANCELLED" && (
                            <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold uppercase text-red-600">
                              Cancelled
                            </span>
                          )}
                        </p>
                        <p className="text-ink-400 text-xs">
                          {entry.practice.durationMinutes} min
                          {entry.practice.location ? ` · ${entry.practice.location}` : ""}
                          {entry.practice.notes ? ` · ${entry.practice.notes}` : ""}
                        </p>
                      </div>
                      {isStaff && (
                        <div className="flex shrink-0 items-center gap-1.5">
                          {movingId === entry.practice.id ? (
                            <>
                              <input
                                type="datetime-local"
                                value={moveValue}
                                onChange={(e) => setMoveValue(e.target.value)}
                                className="border-ink-200 rounded-lg border px-2 py-1 text-xs"
                              />
                              <button
                                onClick={() =>
                                  moveValue &&
                                  practiceAction(entry.practice.id, {
                                    action: "move",
                                    scheduledAt: new Date(moveValue).toISOString(),
                                  })
                                }
                                disabled={busy || !moveValue}
                                className="bg-play-600 rounded-lg px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-40"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setMovingId(null)}
                                className="text-ink-500 text-xs font-semibold"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => {
                                  setMovingId(entry.practice.id)
                                  setMoveValue(format(entry.at, "yyyy-MM-dd'T'HH:mm"))
                                }}
                                disabled={busy}
                                className="border-ink-200 text-ink-600 hover:bg-ink-50 rounded-lg border px-2.5 py-1 text-xs font-semibold"
                              >
                                Move
                              </button>
                              {entry.practice.status === "CANCELLED" ? (
                                <button
                                  onClick={() =>
                                    practiceAction(entry.practice.id, { action: "restore" })
                                  }
                                  disabled={busy}
                                  className="border-court-200 text-court-700 hover:bg-court-50 rounded-lg border px-2.5 py-1 text-xs font-semibold"
                                >
                                  Restore
                                </button>
                              ) : (
                                <button
                                  onClick={() =>
                                    practiceAction(entry.practice.id, { action: "cancel" })
                                  }
                                  disabled={busy}
                                  className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                                >
                                  Cancel
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <a
                    key={`g-${entry.game.id}`}
                    href={`/live/${entry.game.id}`}
                    className="border-play-200 bg-play-50/50 hover:bg-play-50 block rounded-xl border px-4 py-2.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-ink-800 text-sm font-semibold">
                          Game · {format(entry.at, "h:mm a")} {entry.game.isHome ? "vs" : "@"}{" "}
                          {entry.game.opponent}
                          {entry.game.status === "LIVE" && (
                            <span className="ml-2 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                              Live
                            </span>
                          )}
                        </p>
                        <p className="text-ink-400 text-xs">
                          {entry.game.status === "COMPLETED" &&
                          entry.game.usScore != null &&
                          entry.game.themScore != null
                            ? `Final ${entry.game.usScore}–${entry.game.themScore} · `
                            : ""}
                          {entry.game.venue ?? ""}
                        </p>
                      </div>
                    </div>
                  </a>
                )
              )}
            </div>
          </div>
        ))
      )}
    </div>
  )
}

/** "Add to phone calendar" — mints the personal feed token, shows links. */
function AddToPhone() {
  const [open, setOpen] = useState(false)
  const [path, setPath] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [failed, setFailed] = useState(false)

  async function openPanel() {
    setOpen((v) => !v)
    if (path || open) return
    try {
      const res = await fetch("/api/calendar/token", { method: "POST" })
      if (!res.ok) throw new Error()
      setPath((await res.json()).path)
    } catch {
      setFailed(true)
    }
  }

  const httpsUrl = path && typeof window !== "undefined" ? `${window.location.origin}${path}` : null
  const webcalUrl = httpsUrl ? httpsUrl.replace(/^https?:/, "webcal:") : null

  return (
    <div className="relative">
      <button
        onClick={openPanel}
        className="border-ink-200 text-ink-700 hover:bg-ink-50 rounded-xl border px-3 py-1.5 text-xs font-semibold"
      >
        📅 Add to phone
      </button>
      {open && (
        <div className="border-ink-200 absolute right-0 z-20 mt-2 w-72 rounded-2xl border bg-white p-4 shadow-lg">
          {failed ? (
            <p className="text-sm text-red-600">Couldn&apos;t create your calendar link.</p>
          ) : !httpsUrl ? (
            <p className="text-ink-500 text-sm">Creating your calendar link…</p>
          ) : (
            <div className="space-y-2 text-sm">
              <p className="text-ink-800 font-semibold">Subscribe once — updates flow in</p>
              <p className="text-ink-500 text-xs">
                Practices and games for all your teams. Moves and cancellations update
                automatically.
              </p>
              <a
                href={webcalUrl!}
                className="bg-play-600 hover:bg-play-700 block rounded-xl px-3 py-2 text-center text-xs font-semibold text-white"
              >
                iPhone / Apple Calendar
              </a>
              <a
                href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcalUrl!)}`}
                target="_blank"
                rel="noreferrer"
                className="border-ink-200 text-ink-700 hover:bg-ink-50 block rounded-xl border px-3 py-2 text-center text-xs font-semibold"
              >
                Google Calendar (Android)
              </a>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(httpsUrl).then(() => {
                    setCopied(true)
                    setTimeout(() => setCopied(false), 2000)
                  })
                }}
                className="text-play-600 hover:text-play-700 w-full text-center text-xs font-semibold"
              >
                {copied ? "Copied!" : "Copy feed URL"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
