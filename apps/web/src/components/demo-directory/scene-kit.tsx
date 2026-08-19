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
 *
 * SUPERSEDED BY THE REALISM STANDARD, 2026-08-19. A story converted to
 * mock-ui.tsx R1–R8 owns its screens, because R1 wants the REAL component's
 * classes and this kit was authored to a 14px floor instead. `your-week`,
 * `roster` and `season` are converted and import little or nothing from here.
 * Everything below the atoms (Chip, StatusChip, Btn, ConsoleTabs, Panel,
 * Dialog, the Phone*) is therefore LEGACY: it is still what the unconverted
 * stories run on, and the planner/board/teams components in it are no longer
 * used by anything since season-story.tsx was converted. Do not build a NEW
 * screen out of them; copy the real file, the way the converted stories do.
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
  size?: "xs" | "sm" | "md"
}) {
  return (
    <span
      data-demo-target={id}
      className={cn(
        "inline-flex shrink-0 cursor-default items-center justify-center gap-2 rounded-xl font-bold transition-shadow duration-150 data-[demo-press=true]:shadow-inner data-[demo-press=true]:brightness-95 motion-reduce:transition-none",
        size === "xs" ? "px-2.5 py-0.5 text-[14px]" : size === "sm" ? "px-3.5 py-1.5 text-[14px]" : "px-4 py-2 text-[15px]",
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
            "relative py-2 text-[15px] font-semibold",
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
      <div className="border-ink-100 flex shrink-0 items-center gap-3 border-b px-4 py-1.5">
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
      className={cn(
        "flex items-baseline gap-2 rounded-xl border px-3 py-1.5",
        TONES[tone].replace(/text-\S+/, "")
      )}
    >
      <p className="text-ink-500 shrink-0 text-[14px] font-bold uppercase tracking-[0.08em]">
        {label}
      </p>
      <p className="text-ink-900 whitespace-nowrap text-[20px] font-extrabold leading-none tabular-nums">
        {value}
      </p>
      {note && <p className="text-ink-600 ml-auto truncate text-[14px] font-medium">{note}</p>}
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
        "flex items-center gap-3 rounded-xl border px-3 py-0.5 transition-colors duration-300 motion-reduce:transition-none",
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
      {/* OWNER LINE (2026-08-16 feedback round). The shipping card says "You own
          this one. Its games cost you nothing, so it gets used before anything
          you rent." The owner cut it to seven words. The demo carries his line;
          the product still carries its own until somebody changes it there, and
          the gap is written down in
          `docs/roadmap/product-corrections-from-demo-feedback.md`. */}
      <p className="text-ink-500 mt-0.5 text-[14px] font-medium">
        {home
          ? "Your home gym. It fills first."
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

/**
 * THE BOARD, and this kit's most faithful mirror (owner ruling 2026-08-16,
 * feedback round: "the board is the heart of the demo, make it pixel true").
 *
 * Every part below is the real `plan/weekend-card.tsx`, `plan/board-view.tsx`
 * and `plan/plan-ui.tsx`, matched against the 1440 capture in
 * `gold-standard/real2/s3-board.png`:
 *
 *   · the six-dot grip on a gym section, which is what a league drags to move
 *     a whole building's games to another weekend (`data-testid="section-grip"`,
 *     title "Move all N grades at {gym}");
 *   · the Move button and the ⋯ menu on every section;
 *   · the fraction chip in games, "84/80 games", in the product's own three
 *     tones (`FRACTION_TONE`);
 *   · the card tones themselves (`CARD_TONE`): amber for tight, red for over,
 *     plain white when there is room;
 *   · "Not planned" rows for the weekends the plan skipped, which is how the
 *     real board shows an off weekend inside a month.
 */

/** The product's own six-dot grip, same 10x16 viewBox and same six circles. */
export function Grip({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 10 16" aria-hidden="true" className={cn("h-3.5 w-2 shrink-0", className)}>
      {[4, 8, 12].map((cy) => (
        <g key={cy}>
          <circle cx="3" cy={cy} r="1.1" fill="currentColor" />
          <circle cx="7" cy={cy} r="1.1" fill="currentColor" />
        </g>
      ))}
    </svg>
  )
}

export interface BoardGym {
  gym: string
  dot: string
  /** "3/3 courts", the section's own fraction line. */
  courts: string
  /** "5 free", when the building has more courts than this weekend took. */
  free?: string
  grades: string[]
  /**
   * Where the booking stands (`plan/plan-ui.tsx` BLOCK_STATUS_WORDS). The home
   * gym is nobody's to book, so only a RENTED section ever carries a mark, and
   * a confirmed one says nothing: silence means confirmed. "assumed, not
   * booked yet" is the default state of a floater the draw took by itself.
   */
  status?: "assumed"
  /** The shortfall the auditor found at this gym, as the rail words it. */
  short?: string
  /** Target for the hand: the section itself, and its ⋯ trigger. */
  id?: string
  menuId?: string
  /** The ⋯ dropdown, shown open. */
  menu?: ReactNode
  /** The section lifts while it is being dragged. */
  dragging?: boolean
}

/** One weekend card on the board: date, fraction chip, gym sections. */
export function WeekendCard({
  date,
  fraction,
  tone = "fits",
  gyms,
  id,
}: {
  date: string
  fraction: string
  tone?: "fits" | "tight" | "over"
  gyms: BoardGym[]
  id?: string
}) {
  return (
    <div
      data-demo-target={id}
      className={cn(
        "rounded-xl border px-2 py-1 shadow-sm transition-colors duration-300 motion-reduce:transition-none",
        tone === "over"
          ? "border-hoop-400 bg-hoop-50"
          : tone === "tight"
            ? "border-gold-500 bg-gold-50"
            : "border-ink-300 bg-white"
      )}
    >
      <div className="flex items-center gap-1.5">
        <span className="text-ink-900 text-[15px] font-bold underline decoration-ink-200 underline-offset-2">
          {date}
        </span>
        <span aria-hidden="true" className="text-ink-300 text-[14px]">
          &rsaquo;
        </span>
        <span
          className={cn(
            "ml-auto rounded-full border px-2 py-0.5 text-[14px] font-bold tabular-nums",
            tone === "over"
              ? "border-hoop-300 bg-hoop-50 text-hoop-800"
              : tone === "tight"
                ? "border-gold-400 bg-gold-50 text-gold-600"
                : "border-court-200 bg-court-50 text-court-800"
          )}
        >
          {fraction}
        </span>
      </div>

      <div className="mt-1 space-y-1">
        {gyms.map((g) => (
          <div
            key={g.gym}
            data-demo-target={g.id}
            className={cn(
              "relative rounded-lg border bg-white px-1.5 py-1 transition-shadow duration-200 motion-reduce:transition-none",
              g.status === "assumed" ? "border-dashed border-gold-400" : "border-ink-200",
              g.dragging && "shadow-[0_18px_40px_-16px_rgba(15,23,42,0.55)] ring-2 ring-court-500"
            )}
            style={{ borderLeftColor: g.dot, borderLeftWidth: 3 }}
          >
            <div className="flex items-center gap-1">
              <span className="text-ink-300">
                <Grip />
              </span>
              <span
                aria-hidden="true"
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: g.dot }}
              />
              <span className="text-ink-800 truncate text-[14px] font-bold">{g.gym}</span>
              <span className="ml-auto flex shrink-0 items-center gap-1">
                <span className="border-play-300 text-play-700 rounded-md border bg-white px-1.5 py-0.5 text-[14px] font-bold">
                  Move
                </span>
                <span
                  data-demo-target={g.menuId}
                  className="border-ink-200 text-ink-500 flex h-[22px] w-[22px] items-center justify-center rounded-md border bg-white text-[14px] font-bold leading-none"
                >
                  &#8943;
                </span>
              </span>
            </div>

            <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5">
              <span className="text-ink-500 text-[14px] font-semibold tabular-nums">
                {g.courts}
              </span>
              {g.free && <span className="text-ink-400 text-[14px] font-medium">· {g.free}</span>}
              {g.short && (
                <span className="border-gold-400 bg-gold-50 text-gold-600 rounded-md border px-1.5 text-[14px] font-bold">
                  {g.short}
                </span>
              )}
            </div>

            {g.status === "assumed" && (
              <span className="border-gold-400 bg-gold-50 text-gold-600 mt-0.5 block rounded-md border px-1.5 text-[14px] font-bold">
                assumed, not booked yet
              </span>
            )}

            <div className="mt-0.5 flex flex-wrap gap-1">
              {g.grades.map((gr) => (
                <span
                  key={gr}
                  className="border-ink-200 text-ink-700 inline-flex items-center gap-0.5 rounded-md border bg-white px-1 text-[14px] font-semibold"
                >
                  <span className="text-ink-300">
                    <Grip className="h-3 w-1.5" />
                  </span>
                  {gr}
                </span>
              ))}
            </div>

            {g.menu}
          </div>
        ))}
      </div>
    </div>
  )
}

/** A weekend the plan skipped, exactly as the board lists it: "Not planned". */
export function NotPlanned({ date }: { date: string }) {
  return (
    <div className="border-ink-200 flex items-center gap-2 rounded-xl border border-dashed bg-white/60 px-2 py-0.5">
      <span className="text-ink-400 text-[14px] font-bold">{date}</span>
      <span className="text-ink-400 ml-auto text-[14px] font-medium">Not planned</span>
    </div>
  )
}

/** The board's session column header: "SESSION 2 · NOV". */
export function SessionColumn({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border-ink-200 bg-ink-50/70 flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border px-1.5 py-1.5">
      <p className="text-ink-500 mb-1 px-1 text-[14px] font-bold uppercase tracking-[0.08em]">
        {title}
      </p>
      <div className="min-h-0 space-y-1">{children}</div>
    </div>
  )
}

/**
 * The gym tray over the board: "YOUR GYMS · DRAG ONE ONTO A WEEKEND · TAP ONE
 * TO SPOTLIGHT IT", each building with its grip, its dot, its courts and how
 * many weekends it is on.
 */
export function GymTray({
  gyms,
  id,
}: {
  gyms: { name: string; dot: string; courts: string; home?: boolean; weekends: string }[]
  id?: string
}) {
  return (
    <div
      data-demo-target={id}
      className="border-ink-200 flex flex-nowrap items-center gap-2 overflow-hidden rounded-2xl border bg-white px-3 py-1"
    >
      <p className="text-ink-500 shrink-0 whitespace-nowrap text-[14px] font-bold uppercase tracking-[0.08em]">
        Your gyms
      </p>
      <div className="flex flex-nowrap gap-1.5 overflow-hidden">
        {gyms.map((g) => (
          <span
            key={g.name}
            className="border-ink-200 flex shrink-0 items-center gap-1.5 rounded-xl border bg-white px-2 py-1"
          >
            <span className="text-ink-300">
              <Grip />
            </span>
            <span
              aria-hidden="true"
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: g.dot }}
            />
            <span className="text-ink-900 text-[15px] font-bold">{g.name}</span>
            <span className="text-ink-500 text-[14px] font-medium">{g.courts}</span>
            {g.home && <Chip tone="court">Home gym</Chip>}
            <span className="text-ink-400 text-[14px] font-medium">{g.weekends}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

/** The board's HIGHLIGHT row of grade chips. */
export function HighlightRow({ grades }: { grades: string[] }) {
  return (
    <div className="border-ink-200 flex flex-wrap items-center gap-1.5 rounded-2xl border bg-white px-3 py-1.5">
      <span className="text-ink-500 mr-1 text-[14px] font-bold uppercase tracking-[0.08em]">
        Highlight
      </span>
      {grades.map((g) => (
        <span
          key={g}
          className="border-court-200 text-court-800 rounded-lg border bg-white px-2 py-0.5 text-[14px] font-bold"
        >
          {g}
        </span>
      ))}
    </div>
  )
}

/**
 * The ⋯ menu on a gym section (`plan-ui.tsx` `GymMenu`), open on its "Courts
 * this date" section: the stepper, the "of N courts on the floor" footer, and
 * the apply button whose label says what the league just did.
 */
export function GymMenu({
  gym,
  weekend,
  need,
  courts,
  wired,
  apply,
  applyId,
  id,
}: {
  gym: string
  weekend: string
  need: number
  courts: number
  wired: number
  apply: string
  applyId?: string
  id?: string
}) {
  return (
    <div
      data-demo-target={id}
      className="border-ink-200 live-pop absolute right-0 top-[26px] z-30 w-[248px] rounded-xl border bg-white px-3 py-2.5 shadow-[0_28px_60px_-24px_rgba(15,23,42,0.6)]"
    >
      <p className="text-ink-500 text-[14px] font-bold uppercase tracking-[0.06em]">
        This gym, this date
      </p>
      <p className="text-ink-900 mt-1 text-[15px] font-bold">
        {gym} on {weekend}
      </p>
      <p className="text-ink-500 text-[14px] font-medium">This date only. Nothing else moves.</p>

      <p className="text-ink-900 border-ink-100 mt-2 border-t pt-2 text-[15px] font-bold">
        Courts this date
      </p>
      <p className="text-ink-500 mt-0.5 text-[14px] font-medium leading-snug">
        The games here need {need} courts. Fewer if the gym could not give them all, more if you
        rented more of the building.
      </p>
      <div className="mt-1.5 flex items-center gap-2">
        <span className="border-ink-200 text-ink-500 flex h-7 w-7 items-center justify-center rounded-lg border bg-white text-[15px] font-bold">
          &minus;
        </span>
        <span className="text-ink-900 text-[17px] font-extrabold tabular-nums">{courts}</span>
        <span className="border-play-300 text-play-700 flex h-7 w-7 items-center justify-center rounded-lg border bg-white text-[15px] font-bold">
          +
        </span>
        <span className="text-ink-400 text-[14px] font-medium">of {wired} courts on the floor</span>
      </div>
      <span
        data-demo-target={applyId}
        className="bg-play-600 mt-2 flex w-full items-center justify-center rounded-lg px-3 py-1.5 text-[14px] font-bold text-white"
      >
        {apply}
      </span>
    </div>
  )
}

/**
 * The suggestions drawer (`plan/work-rail.tsx`), which is where the board
 * hands the league the answer: the weekend in trouble in the auditor's own
 * sentence, then the move that clears it with its two-press apply.
 */
export function WorkRail({
  open,
  count,
  about,
  problem,
  ideas,
  footer,
  id,
}: {
  open: boolean
  /** "all clear", or "1 open". */
  count: string
  about: string
  problem?: { label: string; fraction: string; text: string }
  ideas?: { headline: string; detail: string; tag: string; id?: string; applied?: boolean }[]
  footer: string
  id?: string
}) {
  if (!open) {
    return (
      <div
        data-demo-target={id}
        className="border-ink-200 text-ink-500 flex w-[34px] shrink-0 flex-col items-center justify-center gap-2 rounded-2xl border bg-white py-3"
      >
        <span className="bg-gold-400 h-2 w-2 rounded-full" aria-hidden="true" />
        <span
          className="text-[14px] font-bold uppercase tracking-[0.1em]"
          style={{ writingMode: "vertical-rl" }}
        >
          What is left
        </span>
      </div>
    )
  }
  return (
    <aside
      data-demo-target={id}
      className="border-ink-200 live-pop flex w-[300px] shrink-0 flex-col rounded-2xl border bg-white px-3 py-2.5"
    >
      <div className="flex items-center gap-2">
        <h2 className="text-ink-900 text-[15px] font-extrabold uppercase tracking-[0.06em]">
          What is left
        </h2>
        <span
          className={cn(
            "ml-auto rounded-full border px-2 py-0.5 text-[14px] font-bold",
            count === "all clear"
              ? "border-court-200 bg-court-50 text-court-800"
              : "border-gold-400 bg-gold-50 text-gold-600"
          )}
        >
          {count}
        </span>
      </div>
      <p className="text-ink-500 mt-1 text-[14px] font-medium">Ideas for {about}</p>

      {problem && (
        <div className="border-gold-400 bg-gold-50 mt-2 rounded-xl border px-2.5 py-2">
          <div className="flex items-center gap-2">
            <span className="text-ink-900 text-[15px] font-bold">{problem.label}</span>
            <span className="border-gold-400 text-gold-600 ml-auto rounded-full border bg-white px-2 py-0.5 text-[14px] font-bold tabular-nums">
              {problem.fraction}
            </span>
          </div>
          <p className="text-ink-700 mt-1 text-[14px] font-medium leading-snug">{problem.text}</p>
        </div>
      )}

      <div className="mt-2 space-y-2">
        {ideas?.map((i) => (
          <div
            key={i.headline}
            data-demo-target={i.id}
            className={cn(
              "rounded-xl border px-2.5 py-2 transition-colors duration-300 motion-reduce:transition-none",
              i.applied ? "border-court-300 bg-court-50" : "border-ink-200 bg-white"
            )}
          >
            <div className="flex items-center gap-2">
              <span className="text-ink-900 text-[15px] font-bold leading-tight">{i.headline}</span>
              <span className="border-court-200 bg-court-50 text-court-800 ml-auto shrink-0 rounded-full border px-2 py-0.5 text-[14px] font-bold">
                {i.tag}
              </span>
            </div>
            <p className="text-ink-600 mt-1 text-[14px] font-medium leading-snug">{i.detail}</p>
            <span
              className={cn(
                "mt-1.5 inline-flex rounded-lg border px-2.5 py-1 text-[14px] font-bold",
                i.applied
                  ? "border-court-300 bg-white text-court-800"
                  : "border-play-300 text-play-700 bg-white"
              )}
            >
              {i.applied ? "Done" : "Move"}
            </span>
          </div>
        ))}
      </div>

      <p className="text-ink-500 border-ink-100 mt-auto border-t pt-2 text-[14px] font-medium">
        {footer}
      </p>
    </aside>
  )
}

/* ── Divisions (Schedule tab) ────────────────────────────────────────────── */

/**
 * The real division board (`manage/components/division-setup.tsx`): an
 * Unassigned pool and one column per division, every team a chip a league can
 * drag anywhere, in either direction.
 */
export function DivisionsBoard({
  columns,
  id,
}: {
  columns: { name: string; dot?: string; teams: string[]; pool?: boolean; id?: string }[]
  id?: string
}) {
  return (
    <div data-demo-target={id} className="grid grid-cols-5 gap-2">
      {columns.map((c) => (
        <div
          key={c.name}
          data-demo-target={c.id}
          className={cn(
            "min-w-0 rounded-xl border px-2 py-2 transition-colors duration-300 motion-reduce:transition-none",
            c.pool ? "border-ink-300 border-dashed bg-white" : "border-ink-200 bg-ink-50/70"
          )}
        >
          <div className="flex items-center gap-1.5">
            {c.dot && (
              <span
                aria-hidden="true"
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: c.dot }}
              />
            )}
            <span className="text-ink-900 truncate text-[14px] font-bold">{c.name}</span>
            <span className="text-ink-400 ml-auto text-[14px] font-semibold tabular-nums">
              {c.teams.length}
            </span>
          </div>
          <div className="mt-1.5 space-y-1">
            {c.teams.map((t) => (
              <span
                key={t}
                className="border-ink-200 text-ink-800 flex items-center gap-1 truncate rounded-lg border bg-white px-1.5 py-1 text-[14px] font-semibold"
              >
                <span className="text-ink-300">
                  <Grip className="h-3 w-1.5" />
                </span>
                <span className="truncate">{t}</span>
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

/** The cross-play question, both options in the product's own words. */
export function CrossPlay({ chosen, id }: { chosen?: "no" | "yes"; id?: string }) {
  const options = [
    {
      key: "no" as const,
      label: "No, they keep to themselves",
      hint: "Each division gets its own schedule.",
    },
    {
      key: "yes" as const,
      label: "Yes, they can mix",
      hint: "Same-division games lean first; crossing fills the rest (how NPH runs it).",
    },
  ]
  return (
    <div data-demo-target={id} className="border-ink-200 rounded-2xl border bg-white px-4 py-2.5">
      <p className="text-ink-900 text-[15px] font-bold">
        In the regular season, do divisions play each other?
      </p>
      <div className="mt-1.5 grid grid-cols-2 gap-2">
        {options.map((o) => (
          <span
            key={o.key}
            className={cn(
              "rounded-xl border px-3 py-2 transition-colors duration-300 motion-reduce:transition-none",
              chosen === o.key
                ? "border-court-400 bg-court-50"
                : "border-ink-200 bg-white"
            )}
          >
            <span
              className={cn(
                "block text-[15px] font-bold",
                chosen === o.key ? "text-court-800" : "text-ink-800"
              )}
            >
              {o.label}
            </span>
            <span className="text-ink-500 block text-[14px] font-medium leading-snug">{o.hint}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

/* ── Fridays (plan step 2) ───────────────────────────────────────────────── */

/** `gyms-weekends-step.tsx` `friday-declaration`, question and answer verbatim. */
export function FridayChoice({ value, id }: { value: "No" | "Yes"; id?: string }) {
  return (
    <div
      data-demo-target={id}
      className="border-ink-200 flex items-center gap-3 rounded-2xl border bg-white px-4 py-2.5"
    >
      <span className="min-w-0">
        <span className="text-ink-900 block text-[15px] font-bold">Can games run on Fridays?</span>
        <span className="text-ink-500 block text-[14px] font-medium leading-snug">
          Saturday and Sunday fill first either way. This tells the draw whether Friday evenings may
          hold games at all.
        </span>
      </span>
      <span className="border-ink-200 ml-auto flex shrink-0 overflow-hidden rounded-lg border bg-white text-[14px] font-bold">
        {(["No", "Yes"] as const).map((v) => (
          <span
            key={v}
            className={cn("px-3 py-1", v === value ? "bg-play-600 text-white" : "text-ink-500")}
          >
            {v}
          </span>
        ))}
      </span>
    </div>
  )
}

/* ── Fairness (Schedule tab) ─────────────────────────────────────────────── */

/**
 * `manage/components/summary-panel.tsx` `FairnessSummaryTable`, worst first.
 *
 * Owner ruling: a fairness claim is only worth showing if the screen PROVES
 * it, and the proof is maximums, never averages. So the rows here are the
 * worst four teams in the league by burden, and the zeros are the point.
 */
export function FairnessTable({
  rows,
  id,
}: {
  rows: { team: string; burden: string; games: string; short: string; b2b: string; waits: string; twoGyms: string }[]
  id?: string
}) {
  const cols = ["Team", "Burden", "Games", "Games short", "Back-to-backs", "5hr+ waits", "Same day, 2 gyms"]
  return (
    <div data-demo-target={id} className="border-ink-200 overflow-hidden rounded-2xl border bg-white">
      <div className="border-ink-100 flex items-baseline gap-2 border-b px-4 py-2">
        <span className="text-ink-900 text-[15px] font-extrabold uppercase tracking-[0.06em]">
          Fairness by team
        </span>
        <span className="text-ink-500 text-[14px] font-medium">
          Worst first by burden. Click a team to check its full schedule.
        </span>
      </div>
      <table className="w-full">
        <thead>
          <tr className="bg-ink-50/70">
            {cols.map((c, i) => (
              <th
                key={c}
                className={cn(
                  "text-ink-500 px-3 py-1.5 text-[14px] font-bold",
                  i === 0 ? "text-left" : "text-right"
                )}
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.team} className="border-ink-100 border-t">
              <td className="text-ink-900 px-3 py-1.5 text-left text-[15px] font-bold">{r.team}</td>
              {[r.burden, r.games, r.short, r.b2b, r.waits, r.twoGyms].map((v, i) => (
                <td
                  key={i}
                  className={cn(
                    "px-3 py-1.5 text-right text-[15px] font-semibold tabular-nums",
                    v === "0" ? "text-court-700" : "text-ink-700"
                  )}
                >
                  {v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
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
