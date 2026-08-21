import Link from "next/link"
import { format } from "date-fns"
import { formatCurrency } from "@/lib/countries"
import { VenueLink } from "@/components/venues/venue-link"
import { genderLabel } from "@/lib/teams/naming"
import type { PublicTryoutSession } from "@/lib/queries/tryout-events"

/**
 * Ruling 10 (owner, 2026-08-20) rendered once, for every public surface.
 *
 * ONE CARD PER SESSION: per age group, per time, per place. Two age groups in
 * the same gym at the same hour are two cards, each carrying its own start,
 * end, location and fee — times and venues are NEVER merged into a combined
 * card. The only nod to a shared slot is a quiet "runs alongside" line, which
 * tells a family the gym will be busy without hiding either session.
 *
 * Ruling 11: no capacity, ever. `signupCount` is absent from the query module
 * unless the club opted in, and a zero is suppressed even then — a public
 * "0 signed up" reads as "nobody is coming", which is the thing the ruling
 * exists to prevent.
 *
 * The event page and the club page's Open programs block both render through
 * here, so a card can never drift between the two.
 */

/** "6:00 – 7:30 PM", or just "6:00 PM" when the session has no duration. */
export function sessionTimeRange(session: PublicTryoutSession): string {
  const start = new Date(session.scheduledAt)
  if (!session.endsAt) return format(start, "h:mm a")
  const end = new Date(session.endsAt)
  const sameHalf = format(start, "a") === format(end, "a")
  return `${format(start, sameHalf ? "h:mm" : "h:mm a")} – ${format(end, "h:mm a")}`
}

function slotKey(session: PublicTryoutSession): string {
  const place = session.venue?.id ?? session.location
  return `${place}|${new Date(session.scheduledAt).getTime()}`
}

/**
 * For each session, the OTHER age groups sharing its venue and start time.
 * Empty for a session that has the gym to itself.
 */
export function alongsideAgeGroups(
  sessions: PublicTryoutSession[]
): Record<string, string[]> {
  const bySlot = new Map<string, PublicTryoutSession[]>()
  for (const s of sessions) {
    const key = slotKey(s)
    bySlot.set(key, [...(bySlot.get(key) ?? []), s])
  }
  const out: Record<string, string[]> = {}
  for (const s of sessions) {
    const peers = bySlot.get(slotKey(s)) ?? []
    out[s.id] = peers
      .filter((p) => p.id !== s.id)
      .map((p) => p.ageGroup)
      .filter((label, i, arr) => arr.indexOf(label) === i)
  }
  return out
}

/** "U11" or "U11 Girls" — family words, never the raw MALE/FEMALE enum. */
export function sessionLabel(session: PublicTryoutSession): string {
  return [session.ageGroup, genderLabel(session.gender as any)].filter(Boolean).join(" ")
}

function listWords(items: string[]): string {
  if (items.length <= 1) return items.join("")
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`
}

function IconPin() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="mt-0.5 h-4 w-4 shrink-0"
    >
      <path d="M12 21s7-5.686 7-11a7 7 0 10-14 0c0 5.314 7 11 7 11z" strokeLinejoin="round" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  )
}

function IconClock() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="mt-0.5 h-4 w-4 shrink-0"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export interface TryoutSessionCardProps {
  session: PublicTryoutSession
  currency: string
  /** Register goes straight to the flow when signed in, via sign-in when not. */
  signedIn: boolean
  /** Other age groups in the same gym at the same time (ruling 10's quiet line). */
  alongside?: string[]
  /** Hide the date line when the caller already groups cards under a day. */
  showDate?: boolean
}

export function TryoutSessionCard({
  session,
  currency,
  signedIn,
  alongside = [],
  showDate = true,
}: TryoutSessionCardProps) {
  const start = new Date(session.scheduledAt)
  const isPast = start.getTime() < Date.now()
  const free = session.fee === 0
  // Ruling 11: absent means absent. A zero is suppressed too.
  const showCount = typeof session.signupCount === "number" && session.signupCount > 0
  const registerHref = signedIn
    ? `/tryouts/${session.id}`
    : `/sign-in?callbackUrl=/tryouts/${session.id}`

  return (
    <div
      className={`border-ink-100 hover:border-[color:var(--brand-line)] flex flex-col rounded-2xl border bg-white p-5 shadow-soft transition-colors duration-200 ${
        isPast ? "opacity-70" : ""
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-condensed rounded-full bg-[var(--brand-soft)] px-3 py-1 text-base font-bold uppercase leading-none tracking-wide text-[color:var(--brand-ink)]">
          {sessionLabel(session)}
        </span>
        {isPast ? (
          <span className="bg-ink-100 text-ink-600 rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wide">
            Closed
          </span>
        ) : (
          <span className="text-court-700 bg-court-50 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold">
            <span aria-hidden="true" className="bg-court-500 h-1.5 w-1.5 rounded-full" />
            Registering
          </span>
        )}
      </div>

      {showDate && (
        <p className="font-display text-ink-950 mt-3 text-xl font-black leading-tight">
          {format(start, "EEEE, MMMM d")}
        </p>
      )}

      <div className={`text-ink-700 space-y-1.5 text-base ${showDate ? "mt-1.5" : "mt-3"}`}>
        <p className="flex items-start gap-2">
          <IconClock />
          <span className="font-semibold">{sessionTimeRange(session)}</span>
        </p>
        <p className="flex items-start gap-2">
          <IconPin />
          <VenueLink
            venueId={session.venue?.id}
            name={session.venue?.name ?? session.location}
            className="text-[color:var(--brand-ink)] font-medium hover:underline"
          />
        </p>
      </div>

      {alongside.length > 0 && (
        <p className="text-ink-500 mt-2.5 text-sm">
          Runs alongside {listWords(alongside)} in the same gym.
        </p>
      )}

      {showCount && (
        <p className="text-ink-500 mt-2.5 text-sm">{session.signupCount} signed up</p>
      )}

      <div className="border-ink-100 mt-4 flex items-center justify-between gap-3 border-t pt-4">
        <div>
          <div
            className={`font-condensed text-2xl font-bold leading-none ${
              free ? "text-court-600" : "text-[color:var(--brand-ink)]"
            }`}
          >
            {free ? "FREE" : formatCurrency(session.fee, currency)}
          </div>
          <div className="text-ink-400 mt-1 text-[11px] font-semibold uppercase tracking-wide">
            Per player
          </div>
        </div>
        {isPast ? (
          <span className="text-ink-400 text-sm font-semibold">Registration closed</span>
        ) : (
          <Link
            href={registerHref}
            className="brand-focus inline-flex min-h-[44px] cursor-pointer items-center rounded-xl bg-[var(--brand)] px-5 text-sm font-bold uppercase tracking-wide text-[color:var(--brand-on)] shadow-sm transition-opacity duration-200 hover:opacity-90"
          >
            Register
          </Link>
        )}
      </div>
    </div>
  )
}

/**
 * The sessions of one event, one card each, grouped by day so a family reads
 * the announcement the way it was written ("Monday: U11 and U13, Wednesday:
 * U15"). Grouping is a heading only — nothing is ever merged into one card.
 */
export function TryoutSessionGrid({
  sessions,
  currency,
  signedIn,
}: {
  sessions: PublicTryoutSession[]
  currency: string
  signedIn: boolean
}) {
  if (sessions.length === 0) return null
  const alongside = alongsideAgeGroups(sessions)
  const days: Array<{ key: string; label: string; items: PublicTryoutSession[] }> = []
  for (const s of sessions) {
    const start = new Date(s.scheduledAt)
    const key = format(start, "yyyy-MM-dd")
    const found = days.find((d) => d.key === key)
    if (found) found.items.push(s)
    else days.push({ key, label: format(start, "EEEE, MMMM d, yyyy"), items: [s] })
  }

  return (
    <div className="space-y-6">
      {days.map((day) => (
        <div key={day.key}>
          <h3 className="text-ink-500 mb-3 flex items-center gap-2.5 text-xs font-bold uppercase tracking-[0.14em]">
            <span aria-hidden="true" className="h-3 w-1 shrink-0 rounded-full bg-[var(--brand)]" />
            {day.label}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {day.items.map((s) => (
              <TryoutSessionCard
                key={s.id}
                session={s}
                currency={currency}
                signedIn={signedIn}
                alongside={alongside[s.id] ?? []}
                showDate={false}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
