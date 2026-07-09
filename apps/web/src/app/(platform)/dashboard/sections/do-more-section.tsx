import Link from "next/link"
import { PanelHeader } from "@/components/ui"

interface DoMoreSectionProps {
  hasParent: boolean
  hasClub: boolean
  hasLeague: boolean
  hasReferee: boolean
}

/**
 * Discoverability card for self-serve capabilities the user hasn't adopted yet.
 * Roles accrue from actions — anyone can start any of these at any time, no
 * matter how they joined. Mirrors the "+ New" menu in the top nav; surfaces the
 * actions the user doesn't already have so they know the door is open.
 */
export function DoMoreSection({ hasParent, hasClub, hasLeague, hasReferee }: DoMoreSectionProps) {
  const actions = [
    {
      show: !hasParent,
      href: "/players/add",
      title: "Add a child",
      description: "Register a player you manage and track their schedule, tryouts, and offers.",
    },
    {
      show: !hasClub,
      href: "/clubs/create",
      title: "Create a club",
      description: "Organize teams, run tryouts, and send offers to players.",
    },
    {
      show: !hasLeague,
      href: "/manage/leagues/create",
      title: "Create a league",
      description: "Set up divisions, schedules, and standings for competitive play.",
    },
    {
      show: !hasReferee,
      href: "/referee/profile",
      title: "Become a referee",
      description: "Set your certification, fee, and availability to officiate games.",
    },
  ].filter((a) => a.show)

  if (actions.length === 0) return null

  return (
    <div className="reveal border-ink-100 shadow-soft rounded-[30px] border bg-white p-8">
      <PanelHeader title="Do more on the platform" />
      <p className="text-ink-600 -mt-2 text-sm">
        Start anything below — you can take on a new role at any time, no setup required first.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {actions.map((action, i) => (
          <Link
            key={action.href}
            href={action.href}
            className="reveal card-lift border-ink-100 group flex items-start gap-3 rounded-2xl border bg-white p-4 transition-colors hover:border-[color:var(--brand-line)] hover:bg-[var(--brand-softer)]"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-[var(--brand-soft)] text-[color:var(--brand-ink)] transition group-hover:brightness-95">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
              </svg>
            </span>
            <div>
              <div className="text-ink-900 text-sm font-semibold">{action.title}</div>
              <div className="text-ink-600 mt-0.5 text-sm">{action.description}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
