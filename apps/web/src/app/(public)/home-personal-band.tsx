import Link from "next/link"
import { format, isToday, isTomorrow } from "date-fns"
import { getMyContexts } from "@/lib/queries/my-contexts"

/**
 * The Home personal band (site-ia-plan §5.6.3): the signed-in participant's
 * week + actions due, ABOVE the public content. Order encodes priority —
 * money/attendance first, then the week. Renders nothing for accounts with
 * no participant contexts (operators keep their dashboard world).
 */
export async function HomePersonalBand({ userId }: { userId: string }) {
  let ctx
  try {
    ctx = await getMyContexts(userId)
  } catch {
    return null
  }
  if (!ctx.isParticipant) return null

  const { actionsDue, weekEvents } = ctx
  const actionCards: Array<{ href: string; title: string; detail: string; tone: string }> = []
  for (const offer of actionsDue.openOffers.slice(0, 2)) {
    actionCards.push({
      href: "/offers",
      title: `Offer for ${offer.playerName}`,
      detail: `${offer.teamName} — accept or decline`,
      tone: "border-hoop-200 bg-hoop-50 text-hoop-800",
    })
  }
  if (actionsDue.paymentsDue > 0) {
    actionCards.push({
      href: "/payments",
      title: `${actionsDue.paymentsDue} payment${actionsDue.paymentsDue === 1 ? "" : "s"} due`,
      detail: "View and pay",
      tone: "border-gold-200 bg-gold-50 text-gold-800",
    })
  }
  if (actionsDue.rsvpsNeeded > 0) {
    actionCards.push({
      href: "/calendar",
      title: `${actionsDue.rsvpsNeeded} event${actionsDue.rsvpsNeeded === 1 ? "" : "s"} awaiting RSVP`,
      detail: "Going or can't go?",
      tone: "border-play-200 bg-play-50 text-play-800",
    })
  }
  if (actionsDue.unreadChats > 0) {
    actionCards.push({
      href: "/messages",
      title: `${actionsDue.unreadChats} unread message${actionsDue.unreadChats === 1 ? "" : "s"}`,
      detail: "Open chat",
      tone: "border-court-200 bg-court-50 text-court-800",
    })
  }

  if (actionCards.length === 0 && weekEvents.length === 0) return null

  const dayLabel = (d: Date) =>
    isToday(d) ? "Today" : isTomorrow(d) ? "Tomorrow" : format(d, "EEEE, MMM d")

  const groups: Array<{ label: string; events: typeof weekEvents }> = []
  for (const ev of weekEvents) {
    const label = dayLabel(ev.item.at)
    const last = groups[groups.length - 1]
    if (last && last.label === label) last.events.push(ev)
    else groups.push({ label, events: [ev] })
  }

  return (
    <section className="border-ink-100 border-b bg-white">
      <div className="container mx-auto px-4 py-6 sm:px-6">
        {actionCards.length > 0 && (
          <div className="mb-5">
            <h2 className="text-ink-400 mb-2 text-xs font-semibold uppercase tracking-[0.16em]">
              Needs your attention
            </h2>
            <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
              {actionCards.slice(0, 4).map((card, i) => (
                <Link
                  key={i}
                  href={card.href}
                  className={`min-w-[220px] flex-1 rounded-2xl border p-4 transition hover:shadow-sm ${card.tone}`}
                >
                  <p className="text-sm font-semibold">{card.title}</p>
                  <p className="mt-0.5 text-xs opacity-80">{card.detail}</p>
                </Link>
              ))}
            </div>
          </div>
        )}

        {weekEvents.length > 0 && (
          <div>
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="text-ink-400 text-xs font-semibold uppercase tracking-[0.16em]">
                Your week
              </h2>
              <Link href="/calendar" className="text-play-700 text-xs font-semibold hover:underline">
                Full calendar &rarr;
              </Link>
            </div>
            <div className="border-ink-100 divide-y divide-ink-50 overflow-hidden rounded-2xl border">
              {groups.slice(0, 4).map((group) => (
                <div key={group.label}>
                  <div className="bg-ink-50/60 text-ink-500 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide">
                    {group.label}
                  </div>
                  {group.events.slice(0, 4).map(({ item, chips, awaitingRsvp }) => (
                    <Link
                      key={`${item.kind}:${item.id}`}
                      href="/calendar"
                      className="hover:bg-ink-50 flex items-center gap-3 px-4 py-2.5 transition"
                    >
                      <span className="text-ink-950 w-14 shrink-0 text-sm font-semibold tabular-nums">
                        {format(item.at, "h:mma").toLowerCase()}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="text-ink-900 block truncate text-sm font-medium">
                          {item.title}
                        </span>
                        <span className="text-ink-500 block truncate text-xs">
                          {chips.join(" · ")}
                          {item.location ? ` · ${item.location}` : ""}
                        </span>
                      </span>
                      {awaitingRsvp.length > 0 && (
                        <span className="bg-play-100 text-play-800 shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold">
                          RSVP: {awaitingRsvp.join(", ")}
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
