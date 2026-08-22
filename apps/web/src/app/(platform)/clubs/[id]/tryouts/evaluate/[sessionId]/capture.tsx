"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { cn } from "@/components/ui/cn"

/**
 * Scoring a tryout from a phone, in one hand, while standing at a station.
 *
 * THE FLOW IS CATEGORY FIRST, and that is the whole design (owner
 * 2026-08-21): *"If I'm walking by and they're working on free throws, I
 * should be able to choose one. I don't need everybody's free throws about
 * wherever I see."* A tryout runs as stations, so a coach at the free-throw
 * station scores free throws for whoever comes through, and nothing should
 * ask them to fill in a whole player before moving on. Pick the category
 * once, then it is two taps per kid: number, score.
 *
 * The interaction language is lifted from the live scoring console, which the
 * owner already approves of: 44px minimum targets, 8px gaps, rounded-2xl,
 * a sticky bar in thumb reach, and a [@media(max-height:520px)] pass because
 * a phone at a scorer's table is often landscape and short.
 *
 * NOTHING IS LOST TO GYM WIFI. Scores land in local state and a queue that
 * persists to localStorage, and flush on an interval, on reconnect, and when
 * the tab is hidden. A coach who walks out of signal keeps scoring and the
 * work syncs when they walk back in.
 */

interface Category {
  id: string
  key: string
  label: string
  hint: string | null
  anchors: Record<string, string>
}

interface RosterEntry {
  poolMemberId: string
  ageGroup: string
  name: string
  number: number
  assigned: boolean
}

interface Props {
  sessionId: string
  clubId: string
  title: string
  status: "DRAFT" | "OPEN" | "CLOSED"
  categories: Category[]
  roster: RosterEntry[]
  initialScores: Record<string, number>
  isAdmin: boolean
}

const key = (poolMemberId: string, categoryId: string) => `${poolMemberId}|${categoryId}`
const QUEUE_KEY = (sessionId: string) => `eval-queue:${sessionId}`

const SCORE_TONE: Record<number, string> = {
  1: "bg-hoop-100 text-hoop-800 border-hoop-300",
  2: "bg-hoop-50 text-hoop-700 border-hoop-200",
  3: "bg-ink-100 text-ink-700 border-ink-300",
  4: "bg-play-50 text-play-700 border-play-300",
  5: "bg-play-100 text-play-800 border-play-400",
}

export function EvaluationCapture({
  sessionId,
  clubId,
  title,
  status,
  categories,
  roster,
  initialScores,
  isAdmin,
}: Props) {
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "")
  const [ageGroup, setAgeGroup] = useState<string>("all")
  const [scores, setScores] = useState<Record<string, number>>(initialScores)
  const [open, setOpen] = useState<RosterEntry | null>(null)
  const [pending, setPending] = useState(0)
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const queue = useRef<{ poolMemberId: string; categoryId: string; score: number }[]>([])

  const category = categories.find((c) => c.id === categoryId) ?? categories[0]
  const ageGroups = useMemo(() => [...new Set(roster.map((r) => r.ageGroup))].sort(), [roster])

  const visible = useMemo(
    () => (ageGroup === "all" ? roster : roster.filter((r) => r.ageGroup === ageGroup)),
    [roster, ageGroup]
  )
  const doneHere = visible.filter((r) => scores[key(r.poolMemberId, categoryId)] !== undefined).length

  /* Restore anything a previous visit could not deliver. */
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(QUEUE_KEY(sessionId))
      if (raw) {
        queue.current = JSON.parse(raw)
        setPending(queue.current.length)
      }
    } catch {
      /* a corrupt queue is not worth breaking the screen over */
    }
  }, [sessionId])

  const flush = useCallback(async () => {
    if (queue.current.length === 0) return
    const batch = queue.current.slice()
    try {
      const res = await fetch(`/api/evaluation-sessions/${sessionId}/ratings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ratings: batch }),
      })
      if (!res.ok) return // keep the queue; try again on the next tick
      queue.current = queue.current.slice(batch.length)
      window.localStorage.setItem(QUEUE_KEY(sessionId), JSON.stringify(queue.current))
      setPending(queue.current.length)
      setSavedAt(new Date())
    } catch {
      /* offline: the queue is the point, so simply wait */
    }
  }, [sessionId])

  useEffect(() => {
    const t = setInterval(flush, 4000)
    const onVisible = () => document.visibilityState === "hidden" && flush()
    document.addEventListener("visibilitychange", onVisible)
    window.addEventListener("online", flush)
    return () => {
      clearInterval(t)
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener("online", flush)
    }
  }, [flush])

  const score = (member: RosterEntry, value: number) => {
    setScores((prev) => ({ ...prev, [key(member.poolMemberId, categoryId)]: value }))
    queue.current = [
      ...queue.current.filter(
        (q) => !(q.poolMemberId === member.poolMemberId && q.categoryId === categoryId)
      ),
      { poolMemberId: member.poolMemberId, categoryId, score: value },
    ]
    window.localStorage.setItem(QUEUE_KEY(sessionId), JSON.stringify(queue.current))
    setPending(queue.current.length)
    setOpen(null)
    if (navigator.vibrate) navigator.vibrate(8)
  }

  if (status !== "OPEN") {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-ink-900 text-lg font-bold">
          {status === "CLOSED" ? "This evaluation is closed" : "This evaluation has not opened yet"}
        </p>
        <p className="text-ink-500 mt-2 text-sm">
          {status === "CLOSED"
            ? "Scores are frozen. The report is still available."
            : "A club admin opens it when the tryout starts."}
        </p>
        <Link
          href={`/clubs/${clubId}/tryouts/evaluate/${sessionId}/report`}
          className="bg-play-600 mt-6 inline-flex min-h-[44px] items-center rounded-xl px-5 font-semibold text-white"
        >
          See the report
        </Link>
      </div>
    )
  }

  return (
    <div className="pb-28" style={{ touchAction: "manipulation" }}>
      <div className="mb-3">
        <h1 className="text-ink-950 text-xl font-bold tracking-tight">{title}</h1>
        <p className="text-ink-500 text-sm">Pick what you are watching, then tap a number.</p>
      </div>

      {/* WHAT AM I WATCHING. The mode switch, and the first thing a coach
          touches when they arrive at a station. */}
      <div className="-mx-4 mb-3 overflow-x-auto px-4">
        <div className="flex gap-2">
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategoryId(c.id)}
              className={cn(
                "min-h-[44px] whitespace-nowrap rounded-xl border px-4 text-sm font-semibold transition-colors",
                c.id === categoryId
                  ? "border-play-600 bg-play-600 text-white"
                  : "border-ink-200 text-ink-700 bg-white"
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {ageGroups.length > 1 && (
        <div className="-mx-4 mb-3 overflow-x-auto px-4">
          <div className="flex gap-2">
            {["all", ...ageGroups].map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setAgeGroup(g)}
                className={cn(
                  "min-h-[36px] whitespace-nowrap rounded-lg border px-3 text-xs font-semibold",
                  g === ageGroup ? "border-ink-900 bg-ink-900 text-white" : "border-ink-200 text-ink-600 bg-white"
                )}
              >
                {g === "all" ? "All ages" : g}
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="text-ink-500 mb-2 text-xs font-semibold uppercase tracking-wide">
        {category?.label} · {doneHere} of {visible.length} scored
      </p>

      {/* THE NUMBERS. A coach identifies a kid by their pinnie across a gym,
          never by reading a name, so the number is the target and the name is
          the small print under it. */}
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
        {visible.map((m) => {
          const v = scores[key(m.poolMemberId, categoryId)]
          return (
            <button
              key={m.poolMemberId}
              type="button"
              onClick={() => setOpen(m)}
              className={cn(
                "flex min-h-[76px] flex-col items-center justify-center rounded-2xl border p-1 transition-colors",
                v !== undefined ? SCORE_TONE[v] : "border-ink-200 bg-white"
              )}
            >
              <span className="text-2xl font-bold tabular-nums leading-none">{m.number}</span>
              <span className="text-ink-500 mt-1 line-clamp-1 w-full px-1 text-center text-[10px] leading-tight">
                {m.name.split(" ")[0]}
              </span>
              {v !== undefined && <span className="mt-0.5 text-[11px] font-bold">{v}</span>}
            </button>
          )
        })}
      </div>

      {visible.length === 0 && (
        <p className="text-ink-500 rounded-2xl border border-dashed py-10 text-center text-sm">
          Nobody is in this pool yet.
        </p>
      )}

      {/* SAVE STATE, always in thumb reach and always honest about the queue. */}
      <div className="border-ink-200 fixed inset-x-0 bottom-0 z-20 border-t bg-white/95 px-4 py-2 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
          <span className="text-ink-500 text-xs">
            {pending > 0 ? (
              <span className="text-hoop-700 font-semibold">{pending} waiting to save</span>
            ) : savedAt ? (
              <span className="text-play-700 font-semibold">All saved</span>
            ) : (
              "Nothing scored yet"
            )}
          </span>
          <Link
            href={`/clubs/${clubId}/tryouts/evaluate/${sessionId}/report`}
            className="border-ink-200 text-ink-800 flex min-h-[44px] items-center rounded-xl border px-4 text-sm font-semibold"
          >
            Report
          </Link>
        </div>
      </div>

      {/* THE SCORE PAD. A bottom sheet because that is where a thumb already
          is, and it carries the anchor text so a 4 means the same thing to
          every coach in the gym. Without that the averages are noise. */}
      {open && category && (
        <div className="fixed inset-0 z-30 flex items-end" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label="Cancel"
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(null)}
          />
          <div className="relative w-full rounded-t-3xl bg-white p-4 pb-6 shadow-2xl">
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <div>
                <p className="text-ink-950 text-lg font-bold">
                  <span className="tabular-nums">#{open.number}</span> {open.name}
                </p>
                <p className="text-ink-500 text-xs">
                  {open.ageGroup} · scoring {category.label.toLowerCase()}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(null)}
                className="text-ink-500 min-h-[44px] px-2 text-sm font-semibold"
              >
                Cancel
              </button>
            </div>

            <div className="space-y-2">
              {[5, 4, 3, 2, 1].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => score(open, v)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-colors",
                    SCORE_TONE[v]
                  )}
                >
                  <span className="w-8 shrink-0 text-center text-2xl font-bold tabular-nums">{v}</span>
                  <span className="text-[13px] leading-snug">{category.anchors?.[String(v)]}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
