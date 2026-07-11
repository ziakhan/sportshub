"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { addDays, format, isToday, startOfWeek } from "date-fns"
import { rsvpKey, type RsvpItemType, type RsvpStatus } from "@/lib/rsvp-shared"
import { AddToPhone } from "@/components/calendar/add-to-phone"
import { AgendaList } from "@/components/calendar/agenda-list"
import { ItemPopover } from "@/components/calendar/item-popover"
import {
  RsvpControl,
  RsvpRollup,
  type RsvpAnswers,
  type RsvpPlayer,
} from "@/components/calendar/rsvp-control"

/**
 * My Calendar client — agenda (act) + grid (scan) projections of the
 * cross-team feed. Grid chips open a popover with the same RSVP controls,
 * so both views are interactive. Polls like the team calendar.
 */

interface TeamView {
  teamId: string
  teamName: string
  clubName: string
  family: boolean
  staff: boolean
}

interface LensView {
  key: string
  kind: "family" | "staff" | "referee"
  label: string
  teamId?: string
  playerId?: string
  leagueId?: string
}

interface ItemView {
  kind: "practice" | "game" | "event"
  id: string
  teamIds: string[]
  lensKeys: string[]
  at: string
  durationMinutes: number
  status: string
  title: string
  location: string | null
  detail: string | null
}

interface Payload {
  teams: TeamView[]
  lenses: LensView[]
  items: ItemView[]
  rsvp: {
    playersByTeam: Record<string, RsvpPlayer[]>
    rosterByTeam: Record<string, RsvpPlayer[]>
    byItem: Record<string, RsvpAnswers>
  }
}

const POLL_MS = 45_000

// One stable color per calendar (lens), assigned by position. dot = the
// colored marker; chipOn = the toggle chip when the lens is visible.
const LENS_COLORS = [
  { dot: "bg-play-600", chipOn: "border-play-300 bg-play-50 text-play-800" },
  { dot: "bg-court-600", chipOn: "border-court-300 bg-court-50 text-court-800" },
  { dot: "bg-hoop-500", chipOn: "border-hoop-300 bg-hoop-50 text-hoop-800" },
  { dot: "bg-violet-600", chipOn: "border-violet-300 bg-violet-50 text-violet-800" },
  { dot: "bg-amber-500", chipOn: "border-amber-300 bg-amber-50 text-amber-800" },
  { dot: "bg-sky-600", chipOn: "border-sky-300 bg-sky-50 text-sky-800" },
  { dot: "bg-rose-500", chipOn: "border-rose-300 bg-rose-50 text-rose-800" },
  { dot: "bg-teal-600", chipOn: "border-teal-300 bg-teal-50 text-teal-800" },
]
const HIDDEN_LENSES_KEY = "mycal-hidden-lenses"

const itemTypeOf = (kind: ItemView["kind"]): RsvpItemType =>
  kind === "practice" ? "PRACTICE" : kind === "game" ? "GAME" : "TEAM_EVENT"

const KIND_CHIP: Record<ItemView["kind"], string> = {
  game: "bg-play-100 text-play-800 hover:bg-play-200",
  practice: "bg-ink-100/80 text-ink-700 hover:bg-ink-200/80",
  event: "bg-hoop-100/80 text-hoop-800 hover:bg-hoop-200/80",
}
const KIND_CARD: Record<ItemView["kind"], string> = {
  game: "border-play-200 bg-play-50/50",
  practice: "border-ink-100 bg-white",
  event: "border-hoop-200 bg-hoop-50/40",
}

export function MyCalendar() {
  const [data, setData] = useState<Payload | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<"agenda" | "grid">("agenda")
  const [openKey, setOpenKey] = useState<string | null>(null)
  // Lens keys the user switched OFF (persisted; everything on by default)
  const [hiddenLenses, setHiddenLenses] = useState<Set<string>>(new Set())
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(HIDDEN_LENSES_KEY) || "[]")
      if (Array.isArray(saved)) setHiddenLenses(new Set(saved))
    } catch {
      /* fresh start */
    }
  }, [])
  const toggleLens = (key: string) => {
    setHiddenLenses((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      localStorage.setItem(HIDDEN_LENSES_KEY, JSON.stringify([...next]))
      return next
    })
  }

  const refresh = useCallback(async () => {
    const res = await fetch("/api/calendar/mine")
    if (!res.ok) throw new Error()
    setData(await res.json())
  }, [])

  useEffect(() => {
    let cancelled = false
    refresh()
      .catch(() => {
        if (!cancelled) setError("Couldn't load your calendar — refresh to try again.")
      })
      .finally(() => {
        if (!cancelled) setLoaded(true)
      })
    const timer = setInterval(() => refresh().catch(() => {}), POLL_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [refresh])

  // Staff-only accounts scan; family accounts act. Same rule as the team
  // calendar: families always start in Agenda (that's where RSVP lives),
  // pure staff get the grid on desktop.
  useEffect(() => {
    if (!data) return
    const hasFamilyTeam = data.teams.some((t) => t.family)
    if (
      !hasFamilyTeam &&
      data.teams.length > 0 &&
      window.matchMedia("(min-width: 1024px)").matches
    ) {
      setView("grid")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded])

  // Phones never get the grid — it squishes into a horizontal scroller
  // (owner 2026-07-11). Force agenda below sm, incl. rotation/resize.
  useEffect(() => {
    const q = window.matchMedia("(max-width: 639px)")
    const apply = () => {
      if (q.matches) setView("agenda")
    }
    apply()
    q.addEventListener("change", apply)
    return () => q.removeEventListener("change", apply)
  }, [])

  const setRsvpStatus = useCallback(
    async (item: ItemView, playerId: string, status: RsvpStatus) => {
      const itemType = itemTypeOf(item.kind)
      const key = rsvpKey(itemType, item.id)
      setData((prev) =>
        prev
          ? {
              ...prev,
              rsvp: {
                ...prev.rsvp,
                byItem: {
                  ...prev.rsvp.byItem,
                  [key]: { ...(prev.rsvp.byItem[key] ?? {}), [playerId]: { status, note: null } },
                },
              },
            }
          : prev
      )
      try {
        const res = await fetch("/api/rsvp", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playerId, itemType, itemId: item.id, status }),
        })
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error)
      } catch (e: any) {
        setError(e?.message || "Couldn't save your RSVP — try again.")
        refresh().catch(() => {})
      }
    },
    [refresh]
  )

  const teamById = useMemo(
    () => new Map((data?.teams ?? []).map((t) => [t.teamId, t])),
    [data]
  )

  const lensColor = useMemo(() => {
    const map = new Map<string, (typeof LENS_COLORS)[number]>()
    data?.lenses.forEach((l, i) => map.set(l.key, LENS_COLORS[i % LENS_COLORS.length]))
    return map
  }, [data])

  // A hidden lens removes items that belong ONLY to hidden calendars
  const visibleItems = useMemo(() => {
    if (!data) return []
    if (hiddenLenses.size === 0) return data.items
    return data.items.filter(
      (i) => i.lensKeys.length === 0 || i.lensKeys.some((k) => !hiddenLenses.has(k))
    )
  }, [data, hiddenLenses])

  const lensDots = (item: ItemView) => {
    const keys = item.lensKeys.filter((k) => !hiddenLenses.has(k)).slice(0, 3)
    if (keys.length === 0) return null
    return (
      <span className="mr-1.5 inline-flex items-center gap-0.5 align-middle">
        {keys.map((k) => (
          <span
            key={k}
            className={`inline-block h-2 w-2 rounded-full ${lensColor.get(k)?.dot ?? "bg-ink-300"}`}
          />
        ))}
      </span>
    )
  }

  // All fetched days, history included — the agenda opens scrolled to today
  // and you scroll UP for the past (TeamSnap pattern, owner 2026-07-11)
  const days = useMemo(() => {
    const byDay = new Map<string, { date: Date; items: ItemView[] }>()
    for (const item of visibleItems) {
      const at = new Date(item.at)
      const key = format(at, "yyyy-MM-dd")
      const bucket = byDay.get(key) ?? { date: at, items: [] }
      bucket.items.push(item)
      byDay.set(key, bucket)
    }
    return [...byDay.values()]
  }, [visibleItems])

  const weeks = useMemo(() => {
    const byKey = new Map<string, ItemView[]>()
    for (const item of visibleItems) {
      const key = format(new Date(item.at), "yyyy-MM-dd")
      byKey.set(key, [...(byKey.get(key) ?? []), item])
    }
    const start = startOfWeek(new Date(), { weekStartsOn: 1 })
    return Array.from({ length: 6 }, (_, w) =>
      Array.from({ length: 7 }, (_, d) => {
        const date = addDays(start, w * 7 + d)
        return { date, items: byKey.get(format(date, "yyyy-MM-dd")) ?? [] }
      })
    )
  }, [visibleItems])

  if (!loaded) {
    return <p className="text-ink-500 py-10 text-center text-sm">Loading your calendar…</p>
  }
  if (!data || data.teams.length === 0) {
    return (
      <div className="border-ink-200 rounded-2xl border border-dashed bg-white px-6 py-12 text-center">
        <p className="text-ink-700 text-sm font-semibold">No teams yet</p>
        <p className="text-ink-500 mt-1 text-sm">
          When your player joins a team — or you start coaching one — every game,
          practice and event lands here.
        </p>
      </div>
    )
  }

  /** Everything RSVP-related for one item, agenda card or popover alike. */
  const rsvpBlock = (item: ItemView, inPopover = false) => {
    const key = rsvpKey(itemTypeOf(item.kind), item.id)
    const answers = data.rsvp.byItem[key] ?? {}
    const upcoming = item.status === "SCHEDULED" && new Date(item.at).getTime() > Date.now()
    if (!upcoming) return null

    const blocks: React.ReactNode[] = []
    // Family side: one control row set per team the item touches
    const myPlayers = item.teamIds.flatMap((tid) => data.rsvp.playersByTeam[tid] ?? [])
    if (myPlayers.length > 0) {
      blocks.push(
        <RsvpControl
          key="control"
          players={myPlayers}
          answers={answers}
          onSet={(playerId, status) => setRsvpStatus(item, playerId, status)}
        />
      )
    }
    // Staff side: a roll-up per staff team on the item
    for (const tid of item.teamIds) {
      const team = teamById.get(tid)
      const roster = data.rsvp.rosterByTeam[tid]
      if (!team?.staff || !roster) continue
      blocks.push(
        <div key={`rollup-${tid}`}>
          {item.teamIds.filter((t) => teamById.get(t)?.staff).length > 1 && (
            <p className="text-ink-400 text-[11px] font-semibold">{team.teamName}</p>
          )}
          <RsvpRollup roster={roster} answers={answers} />
        </div>
      )
    }
    if (blocks.length === 0) return null
    return (
      <div className={inPopover ? "space-y-2" : "border-ink-100 mt-2 space-y-2 border-t pt-2"}>
        {blocks}
      </div>
    )
  }

  const teamLabel = (item: ItemView) =>
    item.kind === "game"
      ? null // matchup title already names both teams
      : item.teamIds
          .map((tid) => teamById.get(tid)?.teamName)
          .filter(Boolean)
          .join(" · ") || null

  const metaLine = (item: ItemView) =>
    [
      `${item.durationMinutes} min`,
      item.location,
      item.detail,
      teamLabel(item),
    ]
      .filter(Boolean)
      .join(" · ")

  const openItem =
    openKey && data ? data.items.find((i) => `${i.kind}-${i.id}` === openKey) ?? null : null

  return (
    <div className="space-y-4">
      {error && <p className="rounded-xl bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}

      {/* Your calendars — one chip per kid/team/league, click to show/hide */}
      {data.lenses.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {data.lenses.map((lens) => {
            const off = hiddenLenses.has(lens.key)
            const color = lensColor.get(lens.key) ?? LENS_COLORS[0]
            return (
              <button
                key={lens.key}
                onClick={() => toggleLens(lens.key)}
                aria-pressed={!off}
                title={off ? "Show this calendar" : "Hide this calendar"}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition ${
                  off ? "border-ink-200 bg-white text-ink-400" : color.chipOn
                }`}
              >
                <span
                  className={`inline-block h-2 w-2 rounded-full ${off ? "bg-ink-300" : color.dot}`}
                />
                <span className={off ? "line-through" : ""}>{lens.label}</span>
              </button>
            )
          })}
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <div className="border-ink-200 hidden rounded-xl border p-0.5 sm:inline-flex">
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
        <AddToPhone />
      </div>

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
                      {format(cell.date, cell.date.getDate() === 1 ? "MMM d" : "d")}
                    </p>
                    <div className="space-y-0.5">
                      {cell.items.map((item) => (
                        <button
                          key={`${item.kind}-${item.id}`}
                          onClick={() => setOpenKey(`${item.kind}-${item.id}`)}
                          className={`block w-full truncate rounded px-1.5 py-0.5 text-left text-[11px] font-medium ${KIND_CHIP[item.kind]} ${
                            item.status === "CANCELLED" ? "line-through opacity-60" : ""
                          } ${item.status === "LIVE" ? "ring-1 ring-red-400" : ""}`}
                          title={item.title}
                        >
                          {lensDots(item)}
                          {format(new Date(item.at), "h:mma").toLowerCase()} {item.title}
                        </button>
                      ))}
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
              Events — click any item to see details and RSVP.
            </p>
          </div>
        </div>
      )}

      {view === "agenda" && (
        <AgendaList
          days={days}
          emptyState={
            <div className="border-ink-200 rounded-2xl border border-dashed bg-white px-6 py-12 text-center">
              <p className="text-ink-700 text-sm font-semibold">Nothing scheduled yet</p>
              <p className="text-ink-500 mt-1 text-sm">
                Games, practices and events from all your teams will appear here.
              </p>
            </div>
          }
          renderItem={(item) => (
            <div
              key={`${item.kind}-${item.id}`}
              className={`rounded-xl border px-4 py-2.5 ${KIND_CARD[item.kind]} ${
                item.status === "CANCELLED" ? "opacity-60" : ""
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-ink-800 text-sm font-semibold">
                    {lensDots(item)}
                    <span className={item.status === "CANCELLED" ? "line-through" : ""}>
                      {item.kind === "game" ? "Game · " : ""}
                      {item.title} · {format(new Date(item.at), "h:mm a")}
                    </span>
                    {item.status === "LIVE" && (
                      <span className="ml-2 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                        Live
                      </span>
                    )}
                    {item.status === "CANCELLED" && (
                      <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold uppercase text-red-600">
                        Cancelled
                      </span>
                    )}
                  </p>
                  <p className="text-ink-400 text-xs">{metaLine(item)}</p>
                </div>
                {item.kind === "game" && (
                  <a
                    href={`/live/${item.id}`}
                    className="text-play-600 hover:text-play-700 shrink-0 text-xs font-semibold"
                  >
                    {item.status === "LIVE" ? "Watch live →" : "Game page →"}
                  </a>
                )}
              </div>
              {rsvpBlock(item)}
            </div>
          )}
        />
      )}

      {openItem && (
        <ItemPopover
          title={`${openItem.kind === "game" ? "Game — " : ""}${openItem.title}`}
          subtitle={`${format(new Date(openItem.at), "EEE MMM d, h:mm a")}${metaLine(openItem) ? ` · ${metaLine(openItem)}` : ""}`}
          onClose={() => setOpenKey(null)}
        >
          {rsvpBlock(openItem, true) ?? (
            <p className="text-ink-500 text-xs">
              {new Date(openItem.at).getTime() <= Date.now()
                ? "This item has already started — RSVP is closed."
                : openItem.lensKeys.some((k) => k.startsWith("ref:"))
                  ? "You're officiating this game."
                  : "Nothing to answer here."}
            </p>
          )}
          {openItem.kind === "game" && (
            <a
              href={`/live/${openItem.id}`}
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
