"use client"

import type { ReactNode } from "react"
import { cn } from "@/components/ui/cn"

/**
 * Scene kit (owner ruling 2026-08-16, audit D2).
 *
 * The 2026-08-15 mock kit was authored for a browser window rendered at about
 * 0.85, so it leans on 9 to 12px type that reaches the viewer at 8 to 10px.
 * This kit is authored for the SCENE presentation instead: a region composed at
 * 1160 logical and rendered at scale 1.0, which means what is written here is
 * what the viewer reads.
 *
 * THE ONE RULE: nothing in this file is smaller than 14px. Not a chip, not a
 * table header, not an eyebrow, not a court label. `scripts/demo/readability-audit.mjs`
 * walks the rendered demo and fails on anything under it, so the rule is
 * machine-checked rather than remembered.
 *
 * Every component mirrors a real league-console element. The names in the
 * comments are the screens they came from, captured 2026-08-16 from the seeded
 * NPH Showcase League as owner-nph@sportshub.demo.
 */

/* ── Atoms ───────────────────────────────────────────────────────────────── */

type Tone = "court" | "play" | "gold" | "hoop" | "neutral" | "ink"

const TONES: Record<Tone, string> = {
  court: "bg-court-50 text-court-700 border-court-200",
  play: "bg-play-50 text-play-700 border-play-200",
  gold: "bg-gold-50 text-gold-600 border-gold-400",
  hoop: "bg-hoop-50 text-hoop-700 border-hoop-200",
  neutral: "bg-ink-50 text-ink-600 border-ink-200",
  ink: "bg-ink-900 text-white border-ink-900",
}

/** The console's status and count pills. */
export function Chip({
  children,
  tone = "neutral",
  id,
  strong,
}: {
  children: ReactNode
  tone?: Tone
  id?: string
  strong?: boolean
}) {
  return (
    <span
      data-demo-target={id}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[14px] leading-[1.5]",
        strong ? "font-bold" : "font-semibold",
        TONES[tone]
      )}
    >
      {children}
    </span>
  )
}

/** Uppercase status chips, exactly the console's APPROVED / PAID register. */
export function StatusChip({ children, tone = "court" }: { children: ReactNode; tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-md border px-2 py-0.5 text-[14px] font-bold uppercase tracking-[0.06em]",
        TONES[tone]
      )}
    >
      {children}
    </span>
  )
}

export function Btn({
  children,
  id,
  tone = "primary",
  size = "md",
}: {
  children: ReactNode
  id?: string
  tone?: "primary" | "court" | "quiet" | "ghost"
  size?: "sm" | "md"
}) {
  return (
    <span
      data-demo-target={id}
      className={cn(
        "inline-flex shrink-0 cursor-default items-center justify-center gap-2 rounded-xl font-bold transition-shadow duration-150 data-[demo-press=true]:shadow-inner data-[demo-press=true]:brightness-95 motion-reduce:transition-none",
        size === "sm" ? "px-3.5 py-1.5 text-[14px]" : "px-4 py-2 text-[15px]",
        tone === "primary" && "bg-play-600 text-white shadow-sm data-[demo-hover=true]:bg-play-700",
        tone === "court" && "bg-court-600 text-white shadow-sm data-[demo-hover=true]:bg-court-700",
        tone === "quiet" &&
          "border-ink-200 text-ink-700 border bg-white data-[demo-hover=true]:border-ink-300 data-[demo-hover=true]:bg-ink-50",
        tone === "ghost" && "text-play-700 data-[demo-hover=true]:text-play-800"
      )}
    >
      {children}
    </span>
  )
}

/* ── Console chrome ──────────────────────────────────────────────────────── */

/**
 * The season console tab strip, verbatim from the real screen:
 * Overview · Clubs · Teams · Plan Your Season · Schedule · Standings ·
 * Playoffs · Referees · Settings.
 */
export function ConsoleTabs({ active }: { active: string }) {
  const tabs = [
    "Overview",
    "Clubs",
    "Teams",
    "Plan Your Season",
    "Schedule",
    "Standings",
    "Playoffs",
    "Referees",
  ]
  return (
    <div className="border-ink-100 flex shrink-0 items-center gap-5 border-b px-6">
      {tabs.map((t) => (
        <span
          key={t}
          className={cn(
            "relative py-2.5 text-[15px] font-semibold",
            t === active ? "text-play-700" : "text-ink-500"
          )}
        >
          {t}
          {t === active && (
            <span className="bg-play-600 absolute inset-x-0 -bottom-px h-[2px] rounded-full" />
          )}
        </span>
      ))}
    </div>
  )
}

/** The panel: left accent bar, uppercase display heading, optional action. */
export function Panel({
  title,
  meta,
  action,
  children,
  className,
  id,
}: {
  title: string
  meta?: ReactNode
  action?: ReactNode
  children?: ReactNode
  className?: string
  id?: string
}) {
  return (
    <section
      data-demo-target={id}
      className={cn(
        "border-ink-200 flex min-h-0 flex-col overflow-hidden rounded-2xl border bg-white shadow-[0_2px_10px_-8px_rgba(15,23,42,0.4)]",
        className
      )}
    >
      <div className="border-ink-100 flex shrink-0 items-center gap-3 border-b px-4 py-2.5">
        <span className="bg-play-600 h-4 w-[3px] shrink-0 rounded-full" />
        <h3 className="font-display text-ink-900 text-[17px] font-extrabold uppercase tracking-[0.02em]">
          {title}
        </h3>
        {meta && <span className="text-ink-500 truncate text-[14px] font-semibold">{meta}</span>}
        {action && <span className="ml-auto shrink-0">{action}</span>}
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  )
}

/** A headline number, the way the console's summary tiles read. */
export function Tile({
  label,
  value,
  note,
  tone = "neutral",
  id,
}: {
  label: string
  value: ReactNode
  note?: string
  tone?: Tone
  id?: string
}) {
  return (
    <div
      data-demo-target={id}
      className={cn("rounded-2xl border px-4 py-3", TONES[tone].replace(/text-\S+/, ""))}
    >
      <p className="text-ink-500 text-[14px] font-bold uppercase tracking-[0.08em]">{label}</p>
      <p className="text-ink-900 mt-0.5 text-[28px] font-extrabold leading-none tabular-nums">
        {value}
      </p>
      {note && <p className="text-ink-600 mt-1.5 text-[14px] font-medium">{note}</p>}
    </div>
  )
}

/* ── Teams tab ───────────────────────────────────────────────────────────── */

export function FilterRow({
  items,
  active,
  id,
}: {
  items: string[]
  active: string
  id?: string
}) {
  return (
    <div data-demo-target={id} className="flex flex-wrap items-center gap-1.5">
      {items.map((t) => (
        <span
          key={t}
          className={cn(
            "rounded-full px-3 py-1 text-[14px] font-semibold",
            t === active ? "bg-play-100 text-play-800" : "text-ink-500 bg-ink-50"
          )}
        >
          {t}
        </span>
      ))}
    </div>
  )
}

/** One row of REGISTERED TEAMS: club, team, division, status, payment. */
export function TeamRow({
  club,
  division,
  status,
  payment,
  id,
  fresh,
  action,
}: {
  club: string
  division: string
  status: "APPROVED" | "PENDING" | "REJECTED"
  payment?: "PAID" | "UNPAID"
  id?: string
  fresh?: boolean
  action?: ReactNode
}) {
  const tone: Tone = status === "APPROVED" ? "court" : status === "PENDING" ? "gold" : "hoop"
  return (
    <div
      data-demo-target={id}
      className={cn(
        "flex items-center gap-3 rounded-xl border px-3.5 py-2 transition-colors duration-300 motion-reduce:transition-none",
        status === "APPROVED" ? "border-court-100 bg-court-50/60" : "border-ink-200 bg-white",
        fresh && "live-row-in"
      )}
    >
      <span className="text-ink-900 shrink-0 text-[15px] font-bold">{club}</span>
      <span className="text-play-700 truncate text-[14px] font-semibold">{division}</span>
      <span className="ml-auto flex shrink-0 items-center gap-2">
        <StatusChip tone={tone}>{status}</StatusChip>
        {payment && (
          <StatusChip tone={payment === "PAID" ? "court" : "hoop"}>{payment}</StatusChip>
        )}
        {action}
      </span>
    </div>
  )
}

/* ── Plan wizard ─────────────────────────────────────────────────────────── */

/** The five-step rail, with the real labels and hints. */
export function StepRail({ step, idPrefix = "rail" }: { step: number; idPrefix?: string }) {
  const steps = [
    { label: "Teams", hint: "who's coming" },
    { label: "Your buildings", hint: "gyms, courts, hours" },
    { label: "Your calendar", hint: "we compute it" },
    { label: "Publish", hint: "post the card" },
    { label: "Schedule", hint: "when you're ready" },
  ]
  return (
    <div className="border-ink-200 flex items-center gap-2 rounded-2xl border bg-white px-4 py-2.5">
      {steps.map((s, i) => {
        const n = i + 1
        const active = n === step
        const done = n < step
        return (
          <span key={s.label} className="flex items-center gap-2">
            {i > 0 && <span className="bg-ink-200 h-px w-5" aria-hidden="true" />}
            <span
              data-demo-target={`${idPrefix}-${n}`}
              className="flex items-center gap-2 rounded-xl px-1.5 py-0.5"
            >
              <span
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[14px] font-bold tabular-nums",
                  active
                    ? "bg-court-600 text-white"
                    : done
                      ? "bg-court-100 text-court-700"
                      : "bg-ink-100 text-ink-500"
                )}
              >
                {done ? "✓" : n}
              </span>
              <span className="leading-tight">
                <span
                  className={cn(
                    "block text-[15px] font-bold",
                    active ? "text-ink-900" : "text-ink-600"
                  )}
                >
                  {s.label}
                </span>
                <span className="text-ink-400 block text-[14px] font-medium">{s.hint}</span>
              </span>
            </span>
          </span>
        )
      })}
    </div>
  )
}

/** Step 2's month-grouped weekend chips: "24–25 on" / "7–8 off". */
export function WeekendGrid({
  months,
  id,
}: {
  months: { month: string; weekends: { label: string; on: boolean; id?: string }[] }[]
  id?: string
}) {
  return (
    <div data-demo-target={id} className="flex flex-wrap gap-x-6 gap-y-3">
      {months.map((m) => (
        <div key={m.month}>
          <p className="text-ink-500 mb-1.5 text-[14px] font-bold uppercase tracking-[0.1em]">
            {m.month}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {m.weekends.map((w) => (
              <span
                key={w.label}
                data-demo-target={w.id}
                className={cn(
                  "flex w-[72px] flex-col items-center rounded-lg border px-1.5 py-1 text-[14px] font-bold leading-tight transition-colors duration-300 motion-reduce:transition-none",
                  w.on
                    ? "border-play-600 bg-play-600 text-white"
                    : "border-ink-200 text-play-700 bg-white"
                )}
              >
                <span>{w.label}</span>
                <span className={cn("text-[14px] font-semibold", w.on ? "text-white/80" : "text-ink-400")}>
                  {w.on ? "on" : "off"}
                </span>
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * Step 2's gym card, on the CURRENT hosting model (owner ruling 2026-08-16:
 * "We select a damn home court then we give you floater gyms and then you
 * don't have to give the booking of those gyms").
 *
 * The real card is `plan/gyms-weekends-step.tsx`. A building is one of exactly
 * two things to a league, and the card says which in the product's own words:
 *
 *   HOME GYM: "You own this one. Its games cost you nothing, so it gets used
 *     before anything you rent."
 *   IN THE POOL: "In the pool. You rent it by the court when a weekend needs
 *     the space." plus, when it can be reordered, "The planner rents from the
 *     top of this list first."
 *
 * A pool gym also carries the OPTIONAL bookings affordance and its skip line,
 * which is the whole point of the floater model: a league that has phoned
 * nobody is not behind.
 */
export function GymCard({
  name,
  city,
  courts,
  hours,
  home,
  rank,
  note,
  bookings,
  bookingsCount,
  skip,
  id,
  fresh,
}: {
  name: string
  city: string
  courts: string
  hours: string
  home?: boolean
  /** Where a pool gym sits in the rental order, as the real ↑ N ↓ control. */
  rank?: number
  note?: string
  /** The collapsed "Already have dates booked here?" control, with the real
   *  count badge when the league has confirmed any. */
  bookings?: boolean
  bookingsCount?: number
  /** The skip line under it, shown when the story is making the point. */
  skip?: string
  id?: string
  fresh?: boolean
}) {
  return (
    <div
      data-demo-target={id}
      className={cn(
        "rounded-2xl border bg-white px-4 py-2.5 transition-colors duration-300 motion-reduce:transition-none",
        home ? "border-court-200 bg-court-50/50" : "border-ink-200",
        fresh && "live-row-in"
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-ink-900 text-[16px] font-bold">
          {name} <span className="text-ink-400 font-semibold">· {city}</span>
        </span>
        {home ? <Chip tone="court">Home gym</Chip> : <Chip tone="neutral">In the pool</Chip>}
        {rank != null && (
          <span className="border-ink-300 text-ink-600 inline-flex items-center gap-1.5 rounded-lg border bg-white px-2 py-0.5 text-[14px] font-bold">
            <span className="text-play-700">↑</span>
            <span className="tabular-nums">{rank}</span>
            <span className="text-play-700">↓</span>
          </span>
        )}
        <span className="text-ink-600 ml-auto text-[14px] font-semibold">{courts}</span>
      </div>
      <p className="text-ink-500 mt-0.5 text-[14px] font-medium">
        {home
          ? "You own this one. Its games cost you nothing, so it gets used before anything you rent."
          : "In the pool. You rent it by the court when a weekend needs the space."}
      </p>
      <p className="text-ink-500 mt-0.5 text-[14px] font-medium">{hours}</p>
      {bookings && (
        <span className="border-play-500 text-play-700 mt-1.5 inline-flex items-center gap-1.5 rounded-lg border bg-white px-2.5 py-1 text-[14px] font-bold">
          Already have dates booked here?
          {bookingsCount != null && bookingsCount > 0 && (
            <span className="border-court-200 bg-court-50 text-court-800 rounded-full border px-1.5 text-[14px]">
              {bookingsCount}
            </span>
          )}
        </span>
      )}
      {skip && <p className="text-ink-500 mt-1 text-[14px] font-medium">{skip}</p>}
      {note && <p className="text-court-700 mt-1 text-[14px] font-semibold">{note}</p>}
    </div>
  )
}

/**
 * WHAT YOU NEED TO BOOK (the real `AskSheet` in `plan/plan-ui.tsx`, reached
 * from the board's "What is left" rail).
 *
 * The owner's sentence for the whole hosting model ends here: "We just
 * schedule them and tell you how many you need." The sheet is the season's
 * off-home ask with no dates in it, in court-days and court-hours, month by
 * month, which is what an operator reads down the phone.
 */
export function AskSheet({
  season,
  months,
  id,
}: {
  season: string
  months: Array<{ label: string; courtDays: string; courtHours: string; weekends: string; chunks: string }>
  id?: string
}) {
  return (
    <div data-demo-target={id} className="border-ink-200 rounded-2xl border bg-white px-4 py-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="border-play-500 text-play-700 inline-flex items-center rounded-lg border bg-white px-2.5 py-1 text-[15px] font-bold">
          What you need to book
        </span>
        <span className="text-ink-900 text-[17px] font-extrabold tabular-nums">{season}</span>
      </div>
      <p className="text-ink-500 mt-2 text-[14px] font-bold uppercase tracking-[0.06em]">
        Month by month
      </p>
      <div className="mt-1.5 space-y-1.5">
        {months.map((m) => (
          <div
            key={m.label}
            className="border-ink-100 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border bg-white px-3 py-1.5"
          >
            <span className="text-ink-900 w-[86px] shrink-0 text-[15px] font-bold">{m.label}</span>
            <span className="text-ink-700 text-[14px] font-semibold tabular-nums">
              {m.courtDays}
            </span>
            <span className="text-ink-700 text-[14px] font-semibold tabular-nums">
              {m.courtHours}
            </span>
            <span className="text-ink-500 text-[14px] font-medium">{m.weekends}</span>
            <span className="text-ink-500 ml-auto text-[14px] font-medium italic">{m.chunks}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── The board (plan step 3) ─────────────────────────────────────────────── */

export interface BoardGym {
  gym: string
  dot: string
  courts: string
  grades: string[]
  /**
   * Where the booking stands (`plan/plan-ui.tsx` BLOCK_STATUS_WORDS). The home
   * gym is nobody's to book, so only a RENTED section ever carries a mark, and
   * a confirmed one says nothing: silence means confirmed. "assumed, not
   * booked yet" is the default state of a floater the draw took by itself.
   */
  status?: "assumed"
}

/** One weekend card on the board: date, fraction chip, gym rows, grade chips. */
export function WeekendCard({
  date,
  fraction,
  tone = "fits",
  gyms,
  id,
  tight,
}: {
  date: string
  fraction: string
  tone?: "fits" | "tight" | "over"
  gyms: BoardGym[]
  id?: string
  tight?: boolean
}) {
  return (
    <div
      data-demo-target={id}
      className={cn(
        "rounded-xl border px-2.5 py-2 transition-colors duration-300 motion-reduce:transition-none",
        tone === "over"
          ? "border-hoop-300 bg-hoop-50"
          : tight
            ? "border-gold-400 bg-gold-50/70"
            : "border-ink-200 bg-white"
      )}
    >
      <div className="flex items-center gap-2">
        <span className="text-ink-900 text-[15px] font-bold underline decoration-ink-200 underline-offset-2">
          {date}
        </span>
        <span
          className={cn(
            "ml-auto rounded-full border px-2 py-0.5 text-[14px] font-bold tabular-nums",
            tone === "over"
              ? "border-hoop-200 bg-white text-hoop-700"
              : tone === "tight"
                ? "border-gold-400 bg-white text-gold-600"
                : "border-court-200 bg-white text-court-700"
          )}
        >
          {fraction}
        </span>
      </div>
      <div className="mt-1.5 space-y-1.5">
        {gyms.map((g) => (
          <div
            key={g.gym}
            className={cn(
              "rounded-lg border bg-white px-2 py-1.5",
              g.status === "assumed" ? "border-gold-400 border-dashed" : "border-ink-100"
            )}
          >
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                aria-hidden="true"
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: g.dot }}
              />
              <span className="text-ink-800 text-[14px] font-bold">{g.gym}</span>
              <span className="text-ink-400 ml-auto text-[14px] font-semibold">{g.courts}</span>
              {g.status === "assumed" && (
                <span className="border-gold-400 bg-gold-50 text-gold-600 w-full rounded-md border px-1.5 text-[14px] font-bold">
                  assumed, not booked yet
                </span>
              )}
            </div>
            <div className="mt-1 flex flex-wrap gap-1">
              {g.grades.map((gr) => (
                <span
                  key={gr}
                  className="border-ink-200 text-ink-700 rounded-md border bg-white px-1.5 py-0.5 text-[14px] font-semibold"
                >
                  {gr}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/** The board's session column header: "SESSION 2 · NOV". */
export function SessionColumn({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border-ink-200 bg-ink-50/70 min-w-0 rounded-2xl border px-2 py-2">
      <p className="text-ink-500 mb-1.5 px-1 text-[14px] font-bold uppercase tracking-[0.08em]">
        {title}
      </p>
      <div className="space-y-1.5">{children}</div>
    </div>
  )
}

/* ── Generate the schedule ───────────────────────────────────────────────── */

/** The Plan → Divisions → Generate → Publish strip. */
export function Journey({ at }: { at: number }) {
  const stages = ["Plan", "Divisions", "Generate", "Publish"]
  return (
    <div className="flex items-center gap-2">
      {stages.map((s, i) => (
        <span key={s} className="flex items-center gap-2">
          {i > 0 && <span className="text-ink-300 text-[14px]">&rarr;</span>}
          <span
            className={cn(
              "rounded-full px-3 py-1 text-[14px] font-bold",
              i < at
                ? "bg-court-50 text-court-700"
                : i === at
                  ? "bg-play-600 text-white"
                  : "bg-ink-50 text-ink-400"
            )}
          >
            {i < at ? `✓ ${s}` : s}
          </span>
        </span>
      ))}
    </div>
  )
}

/**
 * The auditor's answer. The BLOCK shape is `lib/scheduler-v2/audit.ts`'s
 * `grade-does-not-fit` finding: the weekend, the grades and their demand, the
 * arithmetic, and the three options with the court-hours one first.
 */
export function Finding({
  severity,
  title,
  message,
  options,
  optionId,
  id,
}: {
  severity: "block" | "clear"
  title: string
  message: string
  options?: string[]
  optionId?: string
  id?: string
}) {
  const block = severity === "block"
  return (
    <div
      data-demo-target={id}
      className={cn(
        "live-pop rounded-2xl border px-4 py-3",
        block ? "border-hoop-300 bg-hoop-50" : "border-court-300 bg-court-50"
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[14px] font-black text-white",
            block ? "bg-hoop-600" : "bg-court-600"
          )}
          aria-hidden="true"
        >
          {block ? "!" : "✓"}
        </span>
        <p className={cn("text-[16px] font-bold", block ? "text-hoop-800" : "text-court-800")}>
          {title}
        </p>
      </div>
      <p className={cn("mt-1.5 text-[15px] leading-snug", block ? "text-hoop-900" : "text-court-900")}>
        {message}
      </p>
      {options && (
        <div className="mt-2 space-y-1.5">
          {options.map((o, i) => (
            <div
              key={o}
              data-demo-target={i === 0 ? optionId : undefined}
              className={cn(
                "flex items-center gap-2 rounded-xl border bg-white px-3 py-1.5 text-[15px] font-semibold",
                i === 0 ? "border-hoop-300 text-ink-900" : "border-ink-200 text-ink-600"
              )}
            >
              <span className="text-ink-400 text-[14px] font-bold tabular-nums">{i + 1}</span>
              {o}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/** What the schedule promises, revealed one line at a time. */
export function Promises({ items, shown }: { items: string[]; shown: number }) {
  return (
    <div className="space-y-1.5 px-4 py-3">
      {items.map((t, i) => (
        <div
          key={t}
          className={cn(
            "flex items-center gap-2.5 transition-opacity duration-500 motion-reduce:transition-none",
            i < shown ? "opacity-100" : "opacity-25"
          )}
        >
          <span
            className={cn(
              "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[14px] font-black text-white",
              i < shown ? "bg-court-600" : "bg-ink-200"
            )}
            aria-hidden="true"
          >
            {"✓"}
          </span>
          <span className="text-ink-800 text-[15px] font-semibold">{t}</span>
        </div>
      ))}
    </div>
  )
}

/* ── Requests ────────────────────────────────────────────────────────────── */

/**
 * One schedule request, in the real page's shape: the sentence
 * `describeScheduleRequest` builds, a status chip, the requester and reason,
 * and the pending row's three actions.
 */
export function RequestRow({
  team,
  division,
  sentence,
  status,
  requester,
  reason,
  children,
  id,
}: {
  team: string
  division: string
  sentence: string
  status: "PENDING" | "APPROVED"
  requester: string
  reason: string
  children?: ReactNode
  id?: string
}) {
  return (
    <div
      data-demo-target={id}
      className={cn(
        "rounded-2xl border px-4 py-2.5",
        status === "APPROVED" ? "border-court-200 bg-court-50/60" : "border-gold-400 bg-gold-50/70"
      )}
    >
      <p className="text-ink-900 text-[15px] font-bold">
        {team} <span className="text-ink-400 font-semibold">· {division}</span>
      </p>
      <p className="text-ink-800 mt-1 flex flex-wrap items-center gap-2 text-[15px] font-semibold">
        {sentence}
        <StatusChip tone={status === "APPROVED" ? "court" : "gold"}>{status}</StatusChip>
      </p>
      <p className="text-ink-500 mt-0.5 text-[14px] font-medium">
        {requester} · &ldquo;{reason}&rdquo;
      </p>
      {children && <div className="mt-2">{children}</div>}
    </div>
  )
}

/** The Simulate result panel, copy and chips from the real component. */
export function SimulateResult({ team, ok, total }: { team: string; ok: number; total: number }) {
  const deltas: [string, string][] = [
    ["unplaced games", "+0"],
    ["back-to-backs", "+0"],
    ["weekend-preference misses", "+0"],
    ["request misses", "-1"],
    ["two-gym days", "+0"],
    ["big gaps", "+0"],
  ]
  return (
    <div className="border-ink-200 live-pop rounded-2xl border bg-white px-4 py-2.5">
      <p className="text-ink-900 text-[15px] font-bold">
        Cost of approving ·{" "}
        <span className="text-court-700">none, everyone else is unaffected.</span>
      </p>
      <div className="text-ink-600 mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[14px] font-semibold">
        {deltas.map(([label, v]) => (
          <span key={label} className={v === "+0" ? "text-ink-500" : "text-court-700"}>
            {label} {v}
          </span>
        ))}
      </div>
      <p className="text-ink-600 mt-1.5 text-[14px] font-medium">
        {team} would have {ok} of {total} affected games inside the requested window.
      </p>
    </div>
  )
}

/* ── Dialog ──────────────────────────────────────────────────────────────── */

export function Dialog({
  open,
  title,
  subtitle,
  children,
  footer,
}: {
  open: boolean
  title: string
  subtitle?: string
  children?: ReactNode
  footer?: ReactNode
}) {
  if (!open) return null
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#0b1628]/45 px-8">
      <div className="live-pop w-full max-w-[560px] rounded-2xl bg-white p-5 shadow-[0_40px_90px_-40px_rgba(15,23,42,0.7)]">
        <h4 className="font-display text-ink-900 text-[20px] font-extrabold">{title}</h4>
        {subtitle && <p className="text-ink-500 mt-1 text-[15px] font-medium">{subtitle}</p>}
        {children && <div className="mt-3">{children}</div>}
        {footer && <div className="mt-4 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  )
}

/* ── Phone ───────────────────────────────────────────────────────────────── */

export function PhoneScreen({
  title,
  subtitle,
  tab,
  children,
}: {
  title: string
  subtitle: string
  tab: "Home" | "Calendar" | "Team" | "More"
  children: ReactNode
}) {
  const tabs: ("Home" | "Calendar" | "Team" | "More")[] = ["Home", "Calendar", "Team", "More"]
  return (
    <div className="flex h-full flex-col bg-[#f6f7f9]">
      <div className="bg-[#0b1628] px-4 pb-3 pt-2 text-white">
        <p className="text-[15px] font-bold leading-tight">{title}</p>
        <p className="text-[14px] font-medium text-white/60">{subtitle}</p>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden px-3 py-2.5">{children}</div>
      <div className="border-ink-200 flex shrink-0 items-center justify-around border-t bg-white px-2 pb-4 pt-2">
        {tabs.map((t) => (
          <span
            key={t}
            className={cn(
              "text-[14px] font-bold",
              t === tab ? "text-play-700" : "text-ink-400"
            )}
          >
            {t}
          </span>
        ))}
      </div>
    </div>
  )
}

export function PhoneMonth({
  month,
  days,
  filled,
}: {
  month: string
  days: number[]
  filled: boolean
}) {
  const cells = Array.from({ length: 30 }, (_, i) => i + 1)
  return (
    <div className="border-ink-200 rounded-2xl border bg-white px-3 py-2">
      <p className="text-ink-900 text-[15px] font-bold">{month}</p>
      <div className="text-ink-400 mt-1.5 grid grid-cols-7 gap-1 text-center text-[14px] font-bold">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <span key={`${d}${i}`}>{d}</span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((d) => {
          const has = filled && days.includes(d)
          return (
            <span
              key={d}
              className={cn(
                "flex h-6 items-center justify-center rounded-lg text-[14px] font-semibold tabular-nums transition-colors duration-500 motion-reduce:transition-none",
                has ? "bg-court-600 text-white" : "text-ink-500"
              )}
            >
              {d}
            </span>
          )
        })}
      </div>
    </div>
  )
}

export function PhoneGame({
  day,
  title,
  meta,
  fresh,
  delay = 0,
}: {
  day: string
  title: string
  meta: string
  fresh?: boolean
  delay?: number
}) {
  return (
    <div
      className={cn("border-ink-200 flex items-center gap-2.5 rounded-xl border bg-white px-3 py-2", fresh && "live-row-in")}
      style={fresh ? { animationDelay: `${delay}ms` } : undefined}
    >
      <span className="bg-court-50 text-court-700 shrink-0 rounded-lg px-2 py-1 text-[14px] font-bold">
        {day}
      </span>
      <span className="min-w-0">
        <span className="text-ink-900 block truncate text-[15px] font-bold">{title}</span>
        <span className="text-ink-500 block truncate text-[14px] font-medium">{meta}</span>
      </span>
    </div>
  )
}

export function PhoneNotice({
  title,
  body,
  id,
}: {
  title: string
  body: string
  id?: string
}) {
  return (
    <div
      data-demo-target={id}
      className="live-pop absolute inset-x-3 top-3 z-20 rounded-2xl bg-white/95 px-3.5 py-2.5 shadow-[0_20px_50px_-20px_rgba(15,23,42,0.6)] backdrop-blur"
    >
      <p className="text-ink-900 text-[15px] font-bold leading-tight">{title}</p>
      <p className="text-ink-600 mt-1 text-[14px] font-medium leading-snug">{body}</p>
    </div>
  )
}

export function PhoneEmpty({ title, body }: { title: string; body: string }) {
  return (
    <div className="border-ink-200 rounded-2xl border border-dashed bg-white px-4 py-6 text-center">
      <p className="text-ink-900 text-[15px] font-bold">{title}</p>
      <p className="text-ink-500 mt-1 text-[14px] font-medium leading-snug">{body}</p>
    </div>
  )
}
