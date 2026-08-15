import Link from "next/link"
import type { PreviewFeedItem } from "@/lib/queries/feed"

/**
 * Upcoming-matchup card for followed teams (business-model-v2 §12/§16 S1).
 * No Post row backs this — it's computed at query time.
 *
 * REBUILT 2026-08-13. It used to be one line of text — "Sat: Northgate Wolves
 * Grade 10 vs Lakeside Storm Grade 10" — with a calendar emoji, which told a
 * parent nothing: no tip-off time, no venue, and no way to tell WHICH of the
 * two teams is theirs. Now it renders as a real matchup: both clubs, the
 * followed side marked, and the details a parent actually needs before
 * Saturday.
 *
 * Neutral crests (owner ruling 2026-08-14). This card used to paint each side
 * in its club colour, falling back to a hashed palette when a club had none,
 * which meant the colour was decorative at best and invented at worst. The
 * amber "Your team" marker is the only fill that survives, and it is the one a
 * parent is actually scanning for.
 */

/** "NW" from "Northgate Wolves Grade 10" — the club, not the grade. */
function initials(name: string) {
  return name
    .replace(/\b(grade|gr\.?)\s*\d+\w*/gi, "")
    .replace(/\bu\d+\b/gi, "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("")
}

export function PreviewCard({ item }: { item: PreviewFeedItem }) {
  const when = new Date(item.scheduledAt)
  const day = when.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })
  const time = when.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
  const side = (name: string, isMine: boolean, label: string) => (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-2 text-center">
      <span className="bg-ink-100 text-ink-700 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-[15px] font-black shadow-sm">
        {initials(name)}
      </span>
      <p className="text-ink-950 line-clamp-2 w-full text-[13px] font-bold leading-tight">{name}</p>
      <span
        className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${
          isMine ? "bg-highlight text-highlight-on" : "text-ink-500 bg-ink-100"
        }`}
      >
        {isMine ? "Your team" : label}
      </span>
    </div>
  )

  return (
    <Link
      href={`/live/${item.gameId}`}
      className="ring-ink-950/10 block overflow-hidden rounded-3xl bg-white shadow-[0_24px_60px_-18px_rgba(30,41,59,0.55)] ring-1 transition hover:-translate-y-0.5 hover:shadow-xl"
    >
      <div
        className="flex items-center justify-between px-4 py-2.5"
        style={{ background: "linear-gradient(100deg, var(--stage), var(--stage-2))" }}
      >
        <span className="text-[11px] font-black uppercase tracking-[0.18em] text-white/90">
          Coming up
        </span>
        <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-bold text-white">
          {day}
        </span>
      </div>

      <div className="flex items-start gap-3 px-4 py-4">
        {side(item.homeTeam, item.mine === "home", "Home")}
        <span className="text-ink-300 font-condensed self-center text-[1.5rem] font-black italic">
          VS
        </span>
        {side(item.awayTeam, item.mine === "away", "Away")}
      </div>

      <div className="border-ink-100 flex flex-wrap items-center gap-x-4 gap-y-1 border-t px-4 py-2.5">
        <span className="text-ink-900 text-[13px] font-extrabold">{time}</span>
        {item.venueName && (
          <span className="text-ink-500 truncate text-[12.5px] font-semibold">{item.venueName}</span>
        )}
        <span className="text-play-700 ml-auto shrink-0 text-[12.5px] font-extrabold">
          Game page →
        </span>
      </div>
    </Link>
  )
}
