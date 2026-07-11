"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { addDays, format, isSameDay, isToday, isTomorrow, startOfWeek } from "date-fns"
import { rsvpKey, type RsvpItemType, type RsvpStatus } from "@/lib/rsvp-shared"
import { AddToPhone } from "@/components/calendar/add-to-phone"
import { ItemPopover } from "@/components/calendar/item-popover"
import { RsvpControl, RsvpRollup } from "@/components/calendar/rsvp-control"

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

interface TeamEventView {
  id: string
  title: string
  description: string | null
  location: string | null
  startAt: string
  durationMinutes: number
  status: "SCHEDULED" | "CANCELLED"
}

/** Family view: players = my kids on this team. Staff view: full roster. */
interface RsvpBlock {
  players: Array<{ id: string; name: string }>
  byItem: Record<string, Record<string, { status: RsvpStatus; note: string | null }>>
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

export function TeamCalendar({
  teamId,
  tenantId,
  isStaff,
}: {
  teamId: string
  tenantId: string
  isStaff: boolean
}) {
  const [practices, setPractices] = useState<PracticeView[]>([])
  const [games, setGames] = useState<GameView[]>([])
  const [teamEvents, setTeamEvents] = useState<TeamEventView[]>([])
  const [rsvp, setRsvp] = useState<RsvpBlock | null>(null)
  const [slots, setSlots] = useState<SlotView[]>([])
  const [announcedAt, setAnnouncedAt] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [showSchedule, setShowSchedule] = useState(false)
  const [showEventForm, setShowEventForm] = useState(false)
  const [movingId, setMovingId] = useState<string | null>(null)
  const [moveValue, setMoveValue] = useState("")
  // Agenda for phones; week-by-week grid for desktop demos (owner ask).
  // Staff default by viewport; families always start in Agenda — that's
  // where the RSVP buttons live (grid chips are read-only).
  const [view, setView] = useState<"agenda" | "grid">("agenda")
  useEffect(() => {
    if (
      isStaff &&
      typeof window !== "undefined" &&
      window.matchMedia("(min-width: 1024px)").matches
    ) {
      setView("grid")
    }
  }, [isStaff])

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
    setTeamEvents(events.events ?? [])
    setRsvp(events.rsvp ?? null)
    setSlots(slotData.slots)
    setAnnouncedAt(slotData.announcedAt)
  }, [teamId])

  // Optimistic write; the 45s poll (and the trailing refresh) reconciles
  const setRsvpStatus = useCallback(
    async (itemType: RsvpItemType, itemId: string, playerId: string, status: RsvpStatus) => {
      const key = rsvpKey(itemType, itemId)
      setRsvp((prev) =>
        prev
          ? {
              ...prev,
              byItem: {
                ...prev.byItem,
                [key]: { ...(prev.byItem[key] ?? {}), [playerId]: { status, note: null } },
              },
            }
          : prev
      )
      try {
        const res = await fetch("/api/rsvp", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playerId, itemType, itemId, status }),
        })
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error)
      } catch (e: any) {
        setError(e?.message || "Couldn't save your RSVP — try again.")
        refresh().catch(() => {})
      }
    },
    [refresh]
  )

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

  async function eventAction(
    eventId: string,
    method: "PATCH" | "DELETE",
    body?: Record<string, unknown>
  ) {
    if (method === "DELETE" && !window.confirm("Remove this event from all team calendars?")) {
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/team-events/${eventId}`, {
        method,
        ...(body
          ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
          : {}),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      await refresh()
    } catch (e: any) {
      setError(e?.message || "Couldn't update the event — try again.")
    } finally {
      setBusy(false)
    }
  }

  // Merge practices + games + team events — ONE calendar, two projections
  type Entry =
    | { kind: "practice"; at: Date; practice: PracticeView }
    | { kind: "game"; at: Date; game: GameView }
    | { kind: "event"; at: Date; event: TeamEventView }

  // Grid chips open this popover so the compact view is interactive too
  const [openGrid, setOpenGrid] = useState<Entry | null>(null)

  /** RSVP row for one item: family buttons or staff roll-up (upcoming only). */
  function itemRsvp(itemType: RsvpItemType, itemId: string, at: Date, active: boolean, bare = false) {
    if (!rsvp || !active || at.getTime() <= Date.now() || rsvp.players.length === 0) return null
    const answers = rsvp.byItem[rsvpKey(itemType, itemId)] ?? {}
    const inner = isStaff ? (
      <RsvpRollup roster={rsvp.players} answers={answers} />
    ) : (
      <RsvpControl
        players={rsvp.players}
        answers={answers}
        onSet={(playerId, status) => setRsvpStatus(itemType, itemId, playerId, status)}
      />
    )
    return bare ? inner : <div className="border-ink-100 mt-2 border-t pt-2">{inner}</div>
  }
  const allEntries = useMemo<Entry[]>(
    () =>
      [
        ...practices.map((p) => ({
          kind: "practice" as const,
          at: new Date(p.scheduledAt),
          practice: p,
        })),
        ...games.map((g) => ({ kind: "game" as const, at: new Date(g.scheduledAt), game: g })),
        ...teamEvents.map((e) => ({ kind: "event" as const, at: new Date(e.startAt), event: e })),
      ].sort((a, b) => a.at.getTime() - b.at.getTime()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [practices, games, teamEvents]
  )

  // Agenda projection: day buckets from this week forward
  const days = useMemo(() => {
    const cutoff = startOfWeek(new Date(), { weekStartsOn: 1 })
    const byDay = new Map<string, { date: Date; entries: Entry[] }>()
    for (const entry of allEntries) {
      if (entry.at < cutoff) continue
      const key = format(entry.at, "yyyy-MM-dd")
      const bucket = byDay.get(key) ?? { date: entry.at, entries: [] }
      bucket.entries.push(entry)
      byDay.set(key, bucket)
    }
    return [...byDay.values()]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allEntries])

  // Grid projection: 6 weeks of 7-day rows (Mon-start), entries per cell
  const weeks = useMemo(() => {
    const byKey = new Map<string, Entry[]>()
    for (const entry of allEntries) {
      const key = format(entry.at, "yyyy-MM-dd")
      byKey.set(key, [...(byKey.get(key) ?? []), entry])
    }
    const start = startOfWeek(new Date(), { weekStartsOn: 1 })
    return Array.from({ length: 6 }, (_, w) =>
      Array.from({ length: 7 }, (_, d) => {
        const date = addDays(start, w * 7 + d)
        return { date, entries: byKey.get(format(date, "yyyy-MM-dd")) ?? [] }
      })
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allEntries])

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

      {/* View toggle (agenda = phone-first list, grid = desktop weeks) + add event */}
      <div className="flex items-center justify-between gap-2">
        <div className="border-ink-200 inline-flex rounded-xl border p-0.5">
          {(["agenda", "grid"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded-lg px-3 py-1 text-xs font-semibold capitalize transition ${
                view === v ? "bg-play-600 text-white" : "text-ink-500 hover:text-ink-800"
              }`}
            >
              {v === "agenda" ? "Agenda" : "Grid"}
            </button>
          ))}
        </div>
        {isStaff && (
          <button
            onClick={() => setShowEventForm((v) => !v)}
            className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
              showEventForm
                ? "border-play-400 bg-play-50 text-play-700"
                : "border-ink-200 text-ink-600 hover:bg-ink-50"
            }`}
          >
            {showEventForm ? "Close" : "+ Add event"}
          </button>
        )}
      </div>
      {isStaff && showEventForm && (
        <AddEventForm
          teamId={teamId}
          tenantId={tenantId}
          onCreated={() => {
            setShowEventForm(false)
            setNotice("Event added — the team has been notified.")
            refresh().catch(() => {})
          }}
        />
      )}

      {/* Week-by-week grid — desktop demo view; chips link games to /live */}
      {view === "grid" && (
        <div className="border-ink-100 overflow-x-auto rounded-2xl border bg-white p-2">
          <div className="min-w-[720px]">
            <div className="grid grid-cols-7">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                <p
                  key={d}
                  className="text-ink-400 px-2 pb-1 pt-1.5 text-center text-[11px] font-bold uppercase tracking-wide"
                >
                  {d}
                </p>
              ))}
            </div>
            {weeks.map((week, wi) => (
              <div key={wi} className="grid grid-cols-7">
                {week.map((cell) => (
                  <div
                    key={format(cell.date, "yyyy-MM-dd")}
                    className={`border-ink-100/70 m-0.5 min-h-[88px] rounded-lg border p-1.5 ${
                      isToday(cell.date) ? "ring-play-400 bg-play-50/40 ring-1" : ""
                    }`}
                  >
                    <p className="text-ink-400 mb-1 text-[11px] font-semibold">
                      {format(cell.date, cell.date.getDate() === 1 || (wi === 0 && isSameDay(cell.date, weeks[0][0].date)) ? "MMM d" : "d")}
                    </p>
                    <div className="space-y-0.5">
                      {cell.entries.map((entry) =>
                        entry.kind === "game" ? (
                          <button
                            key={`g-${entry.game.id}`}
                            onClick={() => setOpenGrid(entry)}
                            className={`bg-play-100 text-play-800 hover:bg-play-200 block w-full truncate rounded px-1.5 py-0.5 text-left text-[11px] font-medium ${
                              entry.game.status === "LIVE" ? "ring-1 ring-red-400" : ""
                            }`}
                            title={`${entry.game.isHome ? "vs" : "@"} ${entry.game.opponent}`}
                          >
                            {format(entry.at, "h:mma").toLowerCase()}{" "}
                            {entry.game.isHome ? "vs" : "@"} {entry.game.opponent}
                            {entry.game.status === "COMPLETED" &&
                            entry.game.usScore != null &&
                            entry.game.themScore != null
                              ? ` · ${entry.game.usScore}–${entry.game.themScore}`
                              : ""}
                          </button>
                        ) : entry.kind === "practice" ? (
                          <button
                            key={`p-${entry.practice.id}`}
                            onClick={() => setOpenGrid(entry)}
                            className={`bg-ink-100/80 text-ink-700 hover:bg-ink-200/80 block w-full truncate rounded px-1.5 py-0.5 text-left text-[11px] font-medium ${
                              entry.practice.status === "CANCELLED" ? "line-through opacity-60" : ""
                            }`}
                            title={entry.practice.location ?? undefined}
                          >
                            {format(entry.at, "h:mma").toLowerCase()} Practice
                          </button>
                        ) : (
                          <button
                            key={`e-${entry.event.id}`}
                            onClick={() => setOpenGrid(entry)}
                            className={`bg-hoop-100/80 text-hoop-800 hover:bg-hoop-200/80 block w-full truncate rounded px-1.5 py-0.5 text-left text-[11px] font-medium ${
                              entry.event.status === "CANCELLED" ? "line-through opacity-60" : ""
                            }`}
                            title={entry.event.location ?? undefined}
                          >
                            {format(entry.at, "h:mma").toLowerCase()} {entry.event.title}
                          </button>
                        )
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ))}
            <p className="text-ink-400 px-2 py-1.5 text-[11px]">
              <span className="bg-play-100 mr-1 inline-block h-2.5 w-2.5 rounded-sm align-middle" />
              Games ·
              <span className="bg-ink-100 mx-1 inline-block h-2.5 w-2.5 rounded-sm align-middle" />
              Practices ·
              <span className="bg-hoop-100 mx-1 inline-block h-2.5 w-2.5 rounded-sm align-middle" />
              Events — click any item to {isStaff ? "see who's coming" : "RSVP"}
              {isStaff ? "; switch to Agenda to move or cancel items" : ""}.
            </p>
          </div>
        </div>
      )}

      {/* Agenda */}
      {view === "agenda" && (days.length === 0 ? (
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
                    {itemRsvp("PRACTICE", entry.practice.id, entry.at, entry.practice.status === "SCHEDULED")}
                  </div>
                ) : entry.kind === "event" ? (
                  <div
                    key={`e-${entry.event.id}`}
                    className={`border-hoop-200 bg-hoop-50/40 rounded-xl border px-4 py-2.5 ${
                      entry.event.status === "CANCELLED" ? "opacity-60" : ""
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-ink-800 text-sm font-semibold">
                          <span
                            className={entry.event.status === "CANCELLED" ? "line-through" : ""}
                          >
                            {entry.event.title} · {format(entry.at, "h:mm a")}
                          </span>
                          {entry.event.status === "CANCELLED" && (
                            <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold uppercase text-red-600">
                              Cancelled
                            </span>
                          )}
                        </p>
                        <p className="text-ink-400 text-xs">
                          Event · {entry.event.durationMinutes} min
                          {entry.event.location ? ` · ${entry.event.location}` : ""}
                          {entry.event.description ? ` · ${entry.event.description}` : ""}
                        </p>
                      </div>
                      {isStaff && (
                        <div className="flex shrink-0 items-center gap-1.5">
                          {entry.event.status === "CANCELLED" ? (
                            <button
                              onClick={() =>
                                eventAction(entry.event.id, "PATCH", { status: "SCHEDULED" })
                              }
                              disabled={busy}
                              className="border-court-200 text-court-700 hover:bg-court-50 rounded-lg border px-2.5 py-1 text-xs font-semibold"
                            >
                              Restore
                            </button>
                          ) : (
                            <button
                              onClick={() =>
                                eventAction(entry.event.id, "PATCH", { status: "CANCELLED" })
                              }
                              disabled={busy}
                              className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                            >
                              Cancel
                            </button>
                          )}
                          <button
                            onClick={() => eventAction(entry.event.id, "DELETE")}
                            disabled={busy}
                            className="text-ink-400 hover:text-red-600 px-1 text-xs font-semibold"
                            title="Remove event"
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </div>
                    {itemRsvp("TEAM_EVENT", entry.event.id, entry.at, entry.event.status === "SCHEDULED")}
                  </div>
                ) : (
                  <div
                    key={`g-${entry.game.id}`}
                    className="border-play-200 bg-play-50/50 rounded-xl border px-4 py-2.5"
                  >
                    <a href={`/live/${entry.game.id}`} className="block hover:opacity-80">
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
                    {itemRsvp("GAME", entry.game.id, entry.at, entry.game.status === "SCHEDULED")}
                  </div>
                )
              )}
            </div>
          </div>
        ))
      ))}

      {openGrid && (
        <ItemPopover
          title={
            openGrid.kind === "game"
              ? `Game ${openGrid.game.isHome ? "vs" : "@"} ${openGrid.game.opponent}`
              : openGrid.kind === "practice"
                ? "Practice"
                : openGrid.event.title
          }
          subtitle={`${format(openGrid.at, "EEE MMM d, h:mm a")}${
            openGrid.kind === "practice" && openGrid.practice.location
              ? ` · ${openGrid.practice.location}`
              : openGrid.kind === "game" && openGrid.game.venue
                ? ` · ${openGrid.game.venue}`
                : openGrid.kind === "event" && openGrid.event.location
                  ? ` · ${openGrid.event.location}`
                  : ""
          }`}
          onClose={() => setOpenGrid(null)}
        >
          {(openGrid.kind === "game"
            ? itemRsvp("GAME", openGrid.game.id, openGrid.at, openGrid.game.status === "SCHEDULED", true)
            : openGrid.kind === "practice"
              ? itemRsvp("PRACTICE", openGrid.practice.id, openGrid.at, openGrid.practice.status === "SCHEDULED", true)
              : itemRsvp("TEAM_EVENT", openGrid.event.id, openGrid.at, openGrid.event.status === "SCHEDULED", true)) ?? (
            <p className="text-ink-500 text-xs">
              {openGrid.at.getTime() <= Date.now()
                ? "This item has already started — RSVP is closed."
                : "Nothing to answer here."}
            </p>
          )}
          {openGrid.kind === "game" && (
            <a
              href={`/live/${openGrid.game.id}`}
              className="text-play-600 hover:text-play-700 mt-3 block text-xs font-semibold"
            >
              Open game page →
            </a>
          )}
        </ItemPopover>
      )}
    </div>
  )
}

/**
 * Add-event form: coaches/team managers add to this team; club managers can
 * tick sibling teams (server re-checks authority per team and names any it
 * rejects). League owners use the same API across their league's teams.
 */
function AddEventForm({
  teamId,
  tenantId,
  onCreated,
}: {
  teamId: string
  tenantId: string
  onCreated: () => void
}) {
  const [title, setTitle] = useState("")
  const [startAt, setStartAt] = useState("")
  const [duration, setDuration] = useState("60")
  const [location, setLocation] = useState("")
  const [description, setDescription] = useState("")
  const [clubTeams, setClubTeams] = useState<Array<{ id: string; name: string }>>([])
  const [extraIds, setExtraIds] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/teams?tenantId=${tenantId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.teams) {
          setClubTeams(
            data.teams
              .filter((t: any) => t.id !== teamId)
              .map((t: any) => ({ id: t.id, name: t.name }))
          )
        }
      })
      .catch(() => {})
  }, [tenantId, teamId])

  async function submit() {
    if (!title.trim() || !startAt || saving) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/team-events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamIds: [teamId, ...extraIds],
          title: title.trim(),
          startAt: new Date(startAt).toISOString(),
          durationMinutes: Number(duration),
          location: location.trim() || undefined,
          description: description.trim() || undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(
          data.deniedTeamIds
            ? "You don't manage some of the selected teams — uncheck them and try again."
            : data.error || "Couldn't add the event."
        )
      }
      onCreated()
    } catch (e: any) {
      setError(e?.message || "Couldn't add the event — try again.")
    } finally {
      setSaving(false)
    }
  }

  const inputClass =
    "border-ink-200 focus:border-play-500 w-full rounded-xl border px-3 py-2 text-sm focus:outline-none"

  return (
    <div className="border-ink-100 space-y-3 rounded-2xl border bg-white p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="text-ink-700 mb-1 block text-xs font-semibold">Event title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={150}
            placeholder="Team photo day"
            className={inputClass}
          />
        </div>
        <div>
          <label className="text-ink-700 mb-1 block text-xs font-semibold">When</label>
          <input
            type="datetime-local"
            value={startAt}
            onChange={(e) => setStartAt(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className="text-ink-700 mb-1 block text-xs font-semibold">Duration</label>
          <select value={duration} onChange={(e) => setDuration(e.target.value)} className={inputClass}>
            <option value="30">30 min</option>
            <option value="60">1 hour</option>
            <option value="90">1.5 hours</option>
            <option value="120">2 hours</option>
            <option value="180">3 hours</option>
            <option value="240">4 hours</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="text-ink-700 mb-1 block text-xs font-semibold">
            Location <span className="text-ink-400 font-normal">(optional)</span>
          </label>
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            maxLength={200}
            placeholder="Main gym"
            className={inputClass}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="text-ink-700 mb-1 block text-xs font-semibold">
            Details <span className="text-ink-400 font-normal">(optional)</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={1000}
            rows={2}
            placeholder="Wear the home jersey; families welcome."
            className={inputClass}
          />
        </div>
      </div>

      {clubTeams.length > 0 && (
        <div>
          <p className="text-ink-700 mb-1 text-xs font-semibold">Also add to other teams</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {clubTeams.map((t) => (
              <label key={t.id} className="text-ink-600 flex items-center gap-1.5 text-xs">
                <input
                  type="checkbox"
                  checked={extraIds.has(t.id)}
                  onChange={(e) =>
                    setExtraIds((cur) => {
                      const next = new Set(cur)
                      if (e.target.checked) next.add(t.id)
                      else next.delete(t.id)
                      return next
                    })
                  }
                />
                {t.name}
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <p className="text-ink-400 text-xs">
          Everyone on the team gets a notification and sees it on the calendar.
        </p>
        <button
          onClick={submit}
          disabled={saving || !title.trim() || !startAt}
          className="bg-play-600 hover:bg-play-700 shrink-0 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          {saving ? "Adding…" : "Add Event"}
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
