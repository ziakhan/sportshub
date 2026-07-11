"use client"

import { useEffect, useRef, useState } from "react"
import { format, isSameDay } from "date-fns"

/**
 * TeamSnap-style agenda (owner direction 2026-07-11): sticky month headers
 * that swap as you scroll, a date tile on the LEFT of each day's items,
 * default scroll position = today, and a floating "Today" pill (with ↑/↓)
 * whenever today is off screen. Shared by My Calendar + the team calendar —
 * each passes its own card renderer.
 */

export interface AgendaDay<T> {
  date: Date
  items: T[]
}

export function AgendaList<T>({
  days,
  renderItem,
  emptyState,
}: {
  /** Ascending by date; may include past days (scroll up for history). */
  days: Array<AgendaDay<T>>
  renderItem: (item: T) => React.ReactNode
  emptyState: React.ReactNode
}) {
  const todayRef = useRef<HTMLDivElement | null>(null)
  const didInitialScroll = useRef(false)
  const [todayOff, setTodayOff] = useState<"up" | "down" | null>(null)

  const now = new Date()
  // The anchor day: today if listed, else the first upcoming day
  const anchorIndex = days.findIndex(
    (d) => isSameDay(d.date, now) || d.date.getTime() > now.getTime()
  )

  // Default position = today (jump, not smooth — it's the start state)
  useEffect(() => {
    if (didInitialScroll.current || !todayRef.current) return
    didInitialScroll.current = true
    // Only scroll if there's history above the anchor to skip past
    if (anchorIndex > 0) {
      todayRef.current.scrollIntoView({ block: "start" })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days.length])

  // Show the floating pill (with direction) whenever the anchor is off screen
  useEffect(() => {
    const el = todayRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setTodayOff(null)
        else setTodayOff(entry.boundingClientRect.top < 0 ? "up" : "down")
      },
      { rootMargin: "-64px 0px 0px 0px" } // past the sticky month header
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [days.length])

  if (days.length === 0) return <>{emptyState}</>

  // Group consecutive days into month sections for the sticky headers
  const months: Array<{ label: string; days: Array<AgendaDay<T> & { index: number }> }> = []
  days.forEach((day, index) => {
    const label = format(day.date, "MMMM yyyy")
    const current = months[months.length - 1]
    if (current?.label === label) current.days.push({ ...day, index })
    else months.push({ label, days: [{ ...day, index }] })
  })

  return (
    <div className="relative">
      {months.map((month) => (
        <section key={month.label}>
          <div className="bg-ink-50/95 sticky top-0 z-10 -mx-1 px-1 py-1.5 backdrop-blur-sm">
            <p className="text-ink-500 text-xs font-bold uppercase tracking-widest">
              {month.label}
            </p>
          </div>
          <div className="space-y-3 py-2">
            {month.days.map((day) => {
              const isToday = isSameDay(day.date, now)
              const isAnchor = day.index === anchorIndex
              return (
                <div
                  key={format(day.date, "yyyy-MM-dd")}
                  ref={isAnchor ? todayRef : undefined}
                  className="flex items-start gap-3 scroll-mt-10"
                >
                  {/* Date tile — the left rail the eye scans down */}
                  <div
                    className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl ${
                      isToday
                        ? "bg-play-600 text-white"
                        : "bg-ink-100/70 text-ink-700"
                    }`}
                  >
                    <span className="text-xl font-bold leading-none">
                      {format(day.date, "d")}
                    </span>
                    <span
                      className={`mt-0.5 text-[10px] font-semibold uppercase ${
                        isToday ? "text-white/80" : "text-ink-400"
                      }`}
                    >
                      {format(day.date, "EEE")}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    {day.items.map((item) => renderItem(item))}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      ))}

      {todayOff && (
        <button
          onClick={() => todayRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
          className="bg-play-600 hover:bg-play-700 fixed bottom-20 left-1/2 z-20 -translate-x-1/2 rounded-full px-4 py-2 text-sm font-bold text-white shadow-lg sm:bottom-8"
        >
          Today {todayOff === "up" ? "↑" : "↓"}
        </button>
      )}
    </div>
  )
}
