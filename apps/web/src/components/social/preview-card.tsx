import Link from "next/link"
import type { PreviewFeedItem } from "@/lib/queries/feed"

/**
 * Upcoming-matchup card for followed teams (business-model-v2 §12/§16 S1).
 * No Post row backs this — it's computed at query time.
 *
 * REBUILT 2026-08-13. It used to be one line of text — "Sat: Northgate Wolves
 * Grade 10 vs Lakeside Storm Grade 10" — with a calendar emoji, which told a
 * parent nothing: no tip-off time, no venue, no colours, and no way to tell
 * WHICH of the two teams is theirs. Now it renders as a real matchup: both
 * clubs in their own colours, the followed side marked, and the details a
 * parent actually needs before Saturday.
 */

const FALLBACK = ["#4f46e5", "#f24e1e", "#16a34a", "#a16642", "#0891b2"]
function tone(name: string, branded: string | null) {
  if (branded) return branded
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return FALLBACK[h % FALLBACK.length]
}

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
  const homeTone = tone(item.homeTeam, item.homeColor)
  const awayTone = tone(item.awayTeam, item.awayColor)

  const side = (name: string, color: string, isMine: boolean, label: string) => (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-2 text-center">
      <span
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-[15px] font-black text-white shadow-sm"
        style={{ backgroundColor: color }}
      >
        {initials(name)}
      </span>
      <p className="text-ink-950 line-clamp-2 w-full text-[13px] font-bold leading-tight">{name}</p>
      <span
        className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${
          isMine ? "text-white" : "text-ink-500 bg-ink-100"
        }`}
        style={isMine ? { backgroundColor: color } : undefined}
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
        style={{ background: `linear-gradient(100deg, ${homeTone}, ${awayTone})` }}
      >
        <span className="text-[11px] font-black uppercase tracking-[0.18em] text-white/90">
          Coming up
        </span>
        <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-bold text-white">
          {day}
        </span>
      </div>

      <div className="flex items-start gap-3 px-4 py-4">
        {side(item.homeTeam, homeTone, item.mine === "home", "Home")}
        <span className="text-ink-300 font-condensed self-center text-[1.5rem] font-black italic">
          VS
        </span>
        {side(item.awayTeam, awayTone, item.mine === "away", "Away")}
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
