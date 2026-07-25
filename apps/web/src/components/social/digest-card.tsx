"use client"

import { useState } from "react"
import Link from "next/link"
import type { DigestFeedItem } from "@/lib/queries/feed"

/**
 * Virtual "Yesterday around your clubs" digest card (business-model-v2
 * §12/§16 S1, owner ruling: routine finals never flood the feed). No Post
 * row backs this — no reactions/comments/repost bar, just a compact
 * expandable list of the folded-in finals, each tappable to its game.
 */
export function DigestCard({ item }: { item: DigestFeedItem }) {
  const [open, setOpen] = useState(false)

  return (
    <article className="ring-ink-950/10 overflow-hidden rounded-3xl bg-white shadow-[0_24px_60px_-18px_rgba(30,41,59,0.55)] ring-1">
      <div className="flex items-center justify-between gap-2 px-4 pt-3.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="bg-ink-950 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base text-white">
            📅
          </span>
          <div className="min-w-0">
            <p className="text-ink-900 truncate text-[13px] font-semibold">SportsHub One</p>
            <p className="text-ink-400 text-[11px] font-medium">Digest</p>
          </div>
        </div>
        <span className="bg-ink-50 text-ink-600 ring-ink-200 shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset">
          📅 Digest
        </span>
      </div>

      <button
        onClick={() => setOpen((o) => !o)}
        className="block w-full px-4 pb-3 pt-1.5 text-left"
        aria-expanded={open}
      >
        <h3 className="text-ink-950 text-[15px] font-bold leading-snug">{item.title}</h3>
        <p className="text-ink-500 mt-1 text-sm">
          {item.games.length} final{item.games.length === 1 ? "" : "s"} ·{" "}
          {open ? "Hide scores" : "Tap to see scores"}
        </p>
      </button>

      {open && (
        <div className="border-ink-100 divide-ink-100 divide-y border-t">
          {item.games.map((g) => (
            <Link
              key={g.gameId}
              href={`/live/${g.gameId}`}
              className="hover:bg-ink-50 flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
            >
              <span className="text-ink-800 min-w-0 truncate font-medium">
                {g.homeTeam} <span className="text-ink-400">vs</span> {g.awayTeam}
              </span>
              <span className="text-ink-900 shrink-0 font-bold">
                {g.homeScore}–{g.awayScore}
              </span>
            </Link>
          ))}
        </div>
      )}
    </article>
  )
}
