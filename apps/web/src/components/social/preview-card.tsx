import Link from "next/link"
import type { PreviewFeedItem } from "@/lib/queries/feed"

/**
 * Virtual upcoming-matchup preview card ("Sat: Lords vs Kings") — injected
 * for followed teams' games in the next 48h (business-model-v2 §12/§16 S1).
 * No Post row backs this — a plain heads-up card, tap through to the game.
 */
export function PreviewCard({ item }: { item: PreviewFeedItem }) {
  return (
    <Link
      href={`/live/${item.gameId}`}
      className="ring-ink-950/10 block overflow-hidden rounded-3xl bg-white shadow-[0_24px_60px_-18px_rgba(30,41,59,0.55)] ring-1"
    >
      <div className="flex items-center justify-between gap-2 px-4 pt-3.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="bg-ink-950 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base text-white">
            🗓️
          </span>
          <div className="min-w-0">
            <p className="text-ink-900 truncate text-[13px] font-semibold">SportsHub One</p>
            <p className="text-ink-400 text-[11px] font-medium">Upcoming</p>
          </div>
        </div>
        <span className="bg-court-50 text-court-700 ring-court-200 shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset">
          🗓️ Preview
        </span>
      </div>
      <div className="px-4 pb-3.5 pt-1.5">
        <h3 className="text-ink-950 text-[15px] font-bold leading-snug">{item.title}</h3>
      </div>
    </Link>
  )
}
