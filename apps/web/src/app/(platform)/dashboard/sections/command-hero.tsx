import type { CSSProperties, ReactNode } from "react"
import { format } from "date-fns"
import { Badge, Button, CourtBackdropLayer, toneForStatus } from "@/components/ui"
import { seasonStatusLabel } from "@/lib/leagues/season-progress"
import type { CommandHeroState } from "../command-hero-data"

/**
 * The command hero (operator dashboard rebuild, 2026-08-14).
 *
 * One card, one state, zero scrolls: the season an operator is running is the
 * first thing on the dashboard, with the single button that moves it forward.
 * Keeps the arena-night court treatment of the old greeting hero and adds the
 * amber CTA the rich-surface law asks for: the brand vars are overridden on
 * the card so every kit Button inside it fills amber with dark ink text.
 */
const AMBER_ON_NAVY = {
  "--brand": "#fbbf24",
  "--brand-on": "#0b1628",
  "--brand-soft": "rgba(251,191,36,0.18)",
  "--brand-ink": "#fcd34d",
  "--brand-line": "rgba(251,191,36,0.45)",
} as CSSProperties

export function CommandHero({
  hero,
  firstName,
}: {
  hero: CommandHeroState
  firstName: string
}) {
  return (
    <div
      style={AMBER_ON_NAVY}
      className="shadow-soft relative isolate overflow-hidden rounded-[30px]"
    >
      <CourtBackdropLayer variant="navy" intensity="band" />
      <div className="relative z-10 p-6 sm:p-8">
        <div className="text-ink-300 mb-4 text-xs font-semibold">
          Welcome back, {firstName}
        </div>
        <HeroBody hero={hero} />
      </div>
    </div>
  )
}

function HeroBody({ hero }: { hero: CommandHeroState }) {
  switch (hero.kind) {
    case "league-setup":
      return (
        <HeroLayout
          eyebrow="Season setup"
          title={hero.seasonLabel}
          subtitle={hero.leagueName}
          status={hero.status}
          actions={
            <>
              <Button href={hero.href} size="lg" icon={ICONS.arrow} className="w-full sm:w-auto">
                Continue setup
              </Button>
              <Button
                href="/manage/leagues"
                variant="subtle"
                size="lg"
                className="w-full sm:w-auto"
              >
                My leagues
              </Button>
            </>
          }
        >
          <Progress done={hero.done} total={hero.total} />
          {hero.nextStep && <NextUp label={hero.nextStep} />}
        </HeroLayout>
      )

    case "league-running":
      return (
        <HeroLayout
          eyebrow="Season command"
          title={hero.seasonLabel}
          subtitle={hero.leagueName}
          status={hero.status}
          actions={
            <>
              <Button href={hero.href} size="lg" icon={ICONS.arrow} className="w-full sm:w-auto">
                Open console
              </Button>
              <Button
                href="/manage/leagues"
                variant="subtle"
                size="lg"
                className="w-full sm:w-auto"
              >
                My leagues
              </Button>
            </>
          }
        >
          <StatStrip
            items={[
              { value: hero.gamesToday, label: "Games today" },
              { value: hero.gamesThisWeek, label: "Games this week" },
              { value: hero.rostersAwaiting, label: "Rosters awaiting approval" },
              { value: hero.waiversOutstanding, label: "Waivers outstanding" },
            ]}
          />
        </HeroLayout>
      )

    case "league-empty":
      return (
        <HeroLayout
          eyebrow="League operations"
          title={hero.hasLeague ? "Plan your next season" : "Plan your first season"}
          subtitle="Set the dates, divisions and venues, then open registration so clubs can enter."
          actions={
            <Button href={hero.href} size="lg" icon={ICONS.plus} className="w-full sm:w-auto">
              {hero.hasLeague ? "Start a season" : "Create a league"}
            </Button>
          }
        />
      )

    case "club-entry":
      return (
        <HeroLayout
          eyebrow="Open for entry"
          title={hero.leagueName}
          subtitle={
            hero.deadline
              ? `${hero.seasonLabel} · entries close ${format(new Date(hero.deadline), "MMM d")}`
              : hero.seasonLabel
          }
          status="REGISTRATION"
          actions={
            <>
              <Button href={hero.href} size="lg" icon={ICONS.arrow} className="w-full sm:w-auto">
                {hero.ctaLabel}
              </Button>
              <Button
                href="/browse-leagues"
                variant="subtle"
                size="lg"
                className="w-full sm:w-auto"
              >
                {hero.otherOpen > 0 ? `${hero.otherOpen} more open` : "Browse leagues"}
              </Button>
            </>
          }
        >
          <EntrySteps
            clubName={hero.clubName}
            entered={hero.entered}
            teamsRegistered={hero.teamsRegistered}
          />
        </HeroLayout>
      )

    case "club-running":
      return (
        <HeroLayout
          eyebrow="Club command"
          title={hero.clubName}
          subtitle={
            hero.nextGame
              ? `Next game ${format(new Date(hero.nextGame.scheduledAt), "EEE MMM d, h:mm a")}${
                  hero.nextGame.venue ? ` at ${hero.nextGame.venue}` : ""
                }`
              : "No games scheduled yet. Enter a league or add one from your club calendar."
          }
          actions={
            <>
              <Button href={hero.href} size="lg" icon={ICONS.arrow} className="w-full sm:w-auto">
                Open club
              </Button>
              <Button
                href="/browse-leagues"
                variant="subtle"
                size="lg"
                className="w-full sm:w-auto"
              >
                Browse leagues
              </Button>
            </>
          }
        >
          <StatStrip
            items={[
              {
                value: hero.nextGame ? hero.nextGame.label : "None",
                label: "Next game",
                wide: true,
              },
              { value: hero.offersPending, label: "Offers pending" },
              { value: hero.teamsMissingCoach, label: "Teams missing a coach" },
            ]}
          />
        </HeroLayout>
      )

    case "club-empty":
      return (
        <HeroLayout
          eyebrow="Club operations"
          title="Create your club"
          subtitle="Set up teams, run tryouts and enter leagues from one workspace."
          actions={
            <Button href={hero.href} size="lg" icon={ICONS.plus} className="w-full sm:w-auto">
              Create club
            </Button>
          }
        />
      )
  }
}

function HeroLayout({
  eyebrow,
  title,
  subtitle,
  status,
  actions,
  children,
}: {
  eyebrow: string
  title: string
  subtitle?: string
  status?: string
  actions: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0 flex-1">
        <div className="text-gold-400 mb-2 text-[11px] font-black uppercase tracking-[0.22em]">
          {eyebrow}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-3xl font-black tracking-[-0.02em] text-white sm:text-4xl">
            {title}
          </h1>
          {status && <Badge tone={toneForStatus(status)}>{seasonStatusLabel(status)}</Badge>}
        </div>
        {subtitle && <p className="text-ink-200 mt-2 max-w-2xl text-sm sm:text-base">{subtitle}</p>}
        {children}
      </div>
      <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap lg:w-auto lg:shrink-0 lg:justify-end">
        {actions}
      </div>
    </div>
  )
}

function Progress({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  return (
    <div className="mt-5 max-w-md">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span className="text-sm font-semibold text-white">
          {done} of {total} steps done
        </span>
        <span className="text-ink-300 text-xs font-semibold">{pct}%</span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={done}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label="Season setup progress"
        className="h-2 overflow-hidden rounded-full bg-white/15"
      >
        <div className="bg-gold-400 h-full rounded-full" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function NextUp({ label }: { label: string }) {
  return (
    <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-[var(--brand-soft)] px-3.5 py-1.5 ring-1 ring-inset ring-[color:var(--brand-line)]">
      <span className="text-gold-400 text-[10px] font-black uppercase tracking-[0.18em]">
        Next
      </span>
      <span className="text-sm font-semibold text-white">{label}</span>
    </div>
  )
}

function StatStrip({
  items,
}: {
  items: Array<{ value: number | string; label: string; wide?: boolean }>
}) {
  return (
    <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.label}
          className={`rounded-2xl bg-white/10 px-4 py-3 ring-1 ring-inset ring-white/15 ${
            item.wide ? "col-span-2" : ""
          }`}
        >
          <div
            className={`text-white ${
              typeof item.value === "number"
                ? "font-condensed text-2xl font-bold leading-none"
                : "truncate text-sm font-semibold"
            }`}
          >
            {item.value}
          </div>
          <div className="text-ink-300 mt-1.5 text-[10px] font-semibold uppercase tracking-[0.14em]">
            {item.label}
          </div>
        </div>
      ))}
    </div>
  )
}

function EntrySteps({
  clubName,
  entered,
  teamsRegistered,
}: {
  clubName: string
  entered: boolean
  teamsRegistered: number
}) {
  const steps = [
    { label: `${clubName} entered`, done: entered },
    {
      label:
        teamsRegistered > 0
          ? `${teamsRegistered} team${teamsRegistered === 1 ? "" : "s"} registered`
          : "Teams registered",
      done: teamsRegistered > 0,
    },
  ]
  return (
    <div className="mt-5 flex flex-wrap gap-2.5">
      {steps.map((step) => (
        <span
          key={step.label}
          className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-semibold ring-1 ring-inset ${
            step.done
              ? "bg-court-500/20 text-white ring-court-400/40"
              : "text-ink-200 bg-white/10 ring-white/15"
          }`}
        >
          <span
            aria-hidden
            className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-black ${
              step.done ? "bg-court-400 text-ink-950" : "bg-white/20 text-white"
            }`}
          >
            {step.done ? "✓" : ""}
          </span>
          {step.label}
        </span>
      ))}
    </div>
  )
}

/** Unsized SVG icons for the kit Button (it sizes them per `size`). */
const ICONS: Record<string, ReactNode> = {
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
