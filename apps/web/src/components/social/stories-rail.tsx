"use client"

import { useCallback, useEffect, useState, type ReactNode } from "react"
import { cn } from "@/components/ui/cn"

interface RailStory {
  id: string
  cardUrl: string
  cardType: string
  createdAt: string
  viewed: boolean
}
interface RailEntry {
  playerId: string
  name: string
  own: boolean
  stories: RailStory[]
  allViewed: boolean
}

/**
 * Stories rail + fullscreen viewer (social-feed-plan P4): unexpired stories
 * from followed players and your own kids. Gold ring = unseen. Self-fetching;
 * renders nothing when signed out or empty.
 */
export function StoriesRail({
  className,
  chrome,
}: {
  className?: string
  /** "home" wraps the rail in the homepage's bordered band (only when non-empty) */
  chrome?: "home"
}) {
  const [rail, setRail] = useState<RailEntry[] | null>(null)
  const [open, setOpen] = useState<{ entry: number; story: number } | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/stories/rail")
      if (res.ok) setRail((await res.json()).rail)
    } catch {
      /* rail is best-effort */
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const markViewed = (storyId: string) => {
    void fetch(`/api/stories/${storyId}/view`, { method: "POST" })
    setRail(
      (prev) =>
        prev?.map((e) => ({
          ...e,
          stories: e.stories.map((s) => (s.id === storyId ? { ...s, viewed: true } : s)),
          allViewed: e.stories.every((s) => (s.id === storyId ? true : s.viewed)),
        })) ?? null
    )
  }

  if (!rail || rail.length === 0) return null

  const wrap = (children: ReactNode) =>
    chrome === "home" ? (
      <div className="border-ink-100 border-b bg-white">
        <div className="container mx-auto px-4 py-3 sm:px-6">{children}</div>
      </div>
    ) : (
      <>{children}</>
    )

  const current = open ? rail[open.entry]?.stories[open.story] : null

  const step = (dir: 1 | -1) => {
    if (!open) return
    const entry = rail[open.entry]
    const nextStory = open.story + dir
    if (nextStory >= 0 && nextStory < entry.stories.length) {
      setOpen({ entry: open.entry, story: nextStory })
      markViewed(entry.stories[nextStory].id)
      return
    }
    const nextEntry = open.entry + dir
    if (nextEntry >= 0 && nextEntry < rail.length) {
      const idx = dir === 1 ? 0 : rail[nextEntry].stories.length - 1
      setOpen({ entry: nextEntry, story: idx })
      markViewed(rail[nextEntry].stories[idx].id)
      return
    }
    setOpen(null)
  }

  return wrap(
    <div className={className}>
      <div className="flex gap-4 overflow-x-auto pb-1">
        {rail.map((entry, ei) => (
          <button
            key={entry.playerId}
            onClick={() => {
              setOpen({ entry: ei, story: 0 })
              markViewed(entry.stories[0].id)
            }}
            className="flex w-16 shrink-0 flex-col items-center gap-1.5"
          >
            <span
              className={cn(
                "flex h-14 w-14 items-center justify-center rounded-full border-[3px] bg-white text-lg font-extrabold",
                entry.allViewed ? "border-ink-200 text-ink-400" : "border-gold-500 text-gold-600"
              )}
            >
              {entry.name.slice(0, 1)}
            </span>
            <span className="text-ink-600 w-full truncate text-center text-[11px] font-semibold">
              {entry.own ? `${entry.name} ⭐` : entry.name}
            </span>
          </button>
        ))}
      </div>

      {open && current && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-4">
          <div className="flex w-full max-w-2xl items-center justify-between pb-2">
            <span className="text-sm font-bold text-white">{rail[open.entry].name}</span>
            <button onClick={() => setOpen(null)} aria-label="Close" className="p-1 text-white/70 hover:text-white">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={current.cardUrl} alt="Story card" className="w-full max-w-2xl rounded-2xl" />
          <div className="flex w-full max-w-2xl justify-between pt-3">
            <button onClick={() => step(-1)} className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20">
              ← Prev
            </button>
            <span className="self-center text-xs font-semibold text-white/60">
              {open.story + 1} / {rail[open.entry].stories.length}
            </span>
            <button onClick={() => step(1)} className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20">
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
