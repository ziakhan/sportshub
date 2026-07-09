import Link from "next/link"
import type { ReactNode } from "react"
import { AnimatedNumber, Badge, Button, PanelHeader, cn } from "@/components/ui"
import type { DashboardData } from "../get-dashboard-data"

interface RefereeSectionProps {
  data: NonNullable<DashboardData["referee"]>
}

export function RefereeSection({ data }: RefereeSectionProps) {
  return (
    <section className="space-y-6">
      <div>
        <h2 className="font-condensed text-ink-950 text-2xl font-bold uppercase tracking-wide">
          Referee dashboard
        </h2>
        <p className="text-ink-500 mt-1 text-sm">
          Your certification, assignments, and officiating performance.
        </p>
      </div>

      {data.profile ? (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <MetricCard
              label="Certification"
              value={data.profile.certificationLevel || "Not set"}
              tone="brand"
              delay={0}
              icon={<IconBadge className="h-5 w-5" />}
            />
            <MetricCard
              label="Games refereed"
              value={<AnimatedNumber value={data.profile.gamesRefereed} />}
              tone="court"
              delay={70}
              icon={<IconWhistle className="h-5 w-5" />}
            />
            <MetricCard
              label="Average rating"
              value={data.profile.averageRating ? `${data.profile.averageRating}/5` : "No ratings"}
              tone="gold"
              delay={140}
              icon={<IconStar className="h-5 w-5" />}
            />
            <MetricCard
              label="Standard fee"
              value={`$${String(data.profile.standardFee)}`}
              tone="ink"
              delay={210}
              icon={<IconCard className="h-5 w-5" />}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div
              className="reveal border-ink-100 shadow-soft rounded-[28px] border bg-white p-6 lg:col-span-2"
              style={{ animationDelay: "280ms" }}
            >
              <PanelHeader
                title="Profile snapshot"
                action={
                  <Button href="/referee/profile" variant="subtle" size="sm" icon={ACTION_ICONS.pencil}>
                    Edit
                  </Button>
                }
              />
              <dl className="grid gap-3 sm:grid-cols-2">
                <Detail
                  label="Certification"
                  value={data.profile.certificationLevel || "Not set"}
                />
                <Detail label="Games refereed" value={String(data.profile.gamesRefereed)} />
                <Detail
                  label="Average rating"
                  value={
                    data.profile.averageRating
                      ? `${data.profile.averageRating}/5`
                      : "No ratings yet"
                  }
                />
                <Detail label="Standard fee" value={`$${String(data.profile.standardFee)}`} />
              </dl>
            </div>

            <div
              className="reveal border-ink-100 shadow-soft rounded-[28px] border bg-white p-6"
              style={{ animationDelay: "340ms" }}
            >
              <PanelHeader title="My assignments" />
              {data.assignments.length > 0 ? (
                <ul className="space-y-2">
                  {data.assignments.map((a) => (
                    <li key={a.gameId}>
                      <Link
                        href={`/live/${a.gameId}`}
                        className="border-ink-100 bg-ink-50/60 hover:border-[color:var(--brand-line)] block rounded-2xl border p-3 transition-all duration-200 hover:translate-x-0.5 hover:bg-white hover:shadow-[0_10px_30px_-22px_rgba(15,23,42,0.45)]"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-ink-900 text-sm font-semibold">
                            {a.homeTeam} vs {a.awayTeam}
                          </p>
                          {a.status === "LIVE" && (
                            <Badge tone="live" dot>
                              LIVE
                            </Badge>
                          )}
                        </div>
                        <p className="text-ink-500 mt-0.5 text-xs">
                          {new Date(a.scheduledAt).toLocaleString()} {a.venue ? `· ${a.venue}` : ""}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-ink-500 text-sm">
                  No games assigned yet — live and upcoming games you can officiate are on the
                  scoring hub.
                </p>
              )}
              <Button href="/score" className="mt-5" icon={ACTION_ICONS.arrow}>
                Open scoring hub
              </Button>
            </div>
          </div>
        </>
      ) : (
        <div className="reveal border-ink-200 shadow-soft rounded-[28px] border border-dashed bg-white p-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--brand-soft)]">
            <IconFlag className="h-5 w-5 text-[color:var(--brand-ink)]" />
          </div>
          <h3 className="font-condensed text-ink-950 text-xl font-bold uppercase tracking-wide">
            Complete your referee profile
          </h3>
          <p className="text-ink-500 mx-auto mb-5 mt-2 max-w-xl text-sm">
            Add certification level, rate, and availability so leagues can discover and assign you
            to games.
          </p>
          <div className="flex justify-center">
            <Button href="/referee/profile" size="lg" icon={ACTION_ICONS.plus}>
              Set up profile
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}

type MetricTone = "brand" | "court" | "gold" | "hoop" | "ink"

const METRIC_TONES: Record<MetricTone, { chip: string; num: string; ring: string }> = {
  brand: {
    chip: "bg-[var(--brand-soft)] text-[color:var(--brand-ink)]",
    num: "text-[color:var(--brand-ink)]",
    ring: "group-hover:border-[color:var(--brand-line)]",
  },
  court: { chip: "bg-court-50 text-court-600", num: "text-court-700", ring: "group-hover:border-court-200" },
  gold: { chip: "bg-gold-50 text-gold-600", num: "text-gold-600", ring: "group-hover:border-gold-100" },
  hoop: { chip: "bg-hoop-50 text-hoop-600", num: "text-hoop-600", ring: "group-hover:border-hoop-200" },
  ink: { chip: "bg-ink-100 text-ink-700", num: "text-ink-800", ring: "group-hover:border-ink-300" },
}

function MetricCard({
  label,
  value,
  tone,
  icon,
  delay = 0,
}: {
  label: string
  value: ReactNode
  tone: MetricTone
  icon: JSX.Element
  delay?: number
}) {
  const t = METRIC_TONES[tone]
  return (
    <div
      style={{ animationDelay: `${delay}ms` }}
      className={cn(
        "reveal group border-ink-100 relative overflow-hidden rounded-3xl border bg-white p-5 shadow-[0_16px_50px_-34px_rgba(15,23,42,0.45)] transition-all duration-200",
        t.ring
      )}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <span className={cn("grid h-10 w-10 place-items-center rounded-2xl", t.chip)}>{icon}</span>
      </div>
      <div className={cn("font-condensed text-2xl font-bold leading-none", t.num)}>{value}</div>
      <div className="text-ink-500 mt-1.5 text-sm font-medium">{label}</div>
    </div>
  )
}

function IconBadge({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <circle cx="12" cy="8" r="5" />
      <path d="m8 14-2 8 6-3 6 3-2-8" />
    </svg>
  )
}

function IconWhistle({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <circle cx="7" cy="14" r="4" />
      <path d="M11 14h5a4 4 0 0 0 0-8h-2" />
      <circle cx="16" cy="8" r="1" />
    </svg>
  )
}

function IconStar({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <polygon points="12 2 15.1 8.3 22 9.3 17 14.2 18.2 21 12 17.7 5.8 21 7 14.2 2 9.3 8.9 8.3 12 2" />
    </svg>
  )
}

function IconCard({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <line x1="2" y1="10" x2="22" y2="10" />
    </svg>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-ink-100 bg-ink-50 rounded-xl border p-4">
      <dt className="text-ink-400 text-xs uppercase tracking-[0.12em]">{label}</dt>
      <dd className="text-ink-900 mt-1 text-sm font-semibold">{value}</dd>
    </div>
  )
}

function IconFlag({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" y1="22" x2="4" y2="15" />
    </svg>
  )
}

/** SVG icons for the kit buttons (the Button component sizes them). */
const ACTION_ICONS: Record<string, ReactNode> = {
  pencil: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4 12.5-12.5z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  arrow: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  plus: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  ),
}
