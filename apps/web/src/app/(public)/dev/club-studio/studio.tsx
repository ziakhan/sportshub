"use client"

/**
 * Club Page Studio — static preview for owner approval (2026-08-18).
 *
 * Nothing here is wired. It exists so the look and the interaction model can be
 * judged before anything touches TenantBranding or the public club page.
 *
 * The interaction the owner asked for: "a preview, not drag-and-drop without
 * looking." So the preview is the primary surface and it is CLICKABLE. Point at a
 * section in the page and the control panel opens on that section. You never edit
 * something you cannot see.
 */

import { useMemo, useRef, useState } from "react"
import {
  THEMES,
  ACCENTS,
  SECTIONS,
  DEFAULT_SECTIONS,
  SECTION_BY_KEY,
  HEADER_STYLES,
  INTENSITIES,
  SHAPES,
  DENSITIES,
  accentFor,
  type Theme,
  type Accent,
  type SectionState,
  type Zone,
  type Intensity,
  type ShapeKey,
  type DensityKey,
  type ImageState,
} from "./themes"

/* ---------------------------------------------------------------- icons (SVG) */
/* Hand-authored, currentColor, 24x24 viewBox. Never emoji (design law). */

const Icon = {
  eye: (p: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={p.className} aria-hidden="true">
      <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="2.6" />
    </svg>
  ),
  eyeOff: (p: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={p.className} aria-hidden="true">
      <path d="M4 4l16 16" strokeLinecap="round" />
      <path d="M9.9 5.8A9.9 9.9 0 0 1 12 5.5c6.4 0 10 6.5 10 6.5a17 17 0 0 1-3.3 4M6.6 7.9A16.6 16.6 0 0 0 2 12s3.6 6.5 10 6.5a10 10 0 0 0 3.6-.65" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  up: (p: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={p.className} aria-hidden="true">
      <path d="M12 19V6M6 11l6-6 6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  down: (p: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={p.className} aria-hidden="true">
      <path d="M12 5v13M18 13l-6 6-6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  bolt: (p: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={p.className} aria-hidden="true">
      <path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H12L13 2Z" strokeLinejoin="round" />
    </svg>
  ),
  pen: (p: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={p.className} aria-hidden="true">
      <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z" strokeLinejoin="round" />
    </svg>
  ),
  lock: (p: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={p.className} aria-hidden="true">
      <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
      <path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7" strokeLinecap="round" />
    </svg>
  ),
  desktop: (p: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={p.className} aria-hidden="true">
      <rect x="2.5" y="4" width="19" height="12.5" rx="2" />
      <path d="M9 20.5h6M12 16.5v4" strokeLinecap="round" />
    </svg>
  ),
  phone: (p: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={p.className} aria-hidden="true">
      <rect x="7" y="2.5" width="10" height="19" rx="2.4" />
      <path d="M11 18.6h2" strokeLinecap="round" />
    </svg>
  ),
  grip: (p: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={p.className} aria-hidden="true">
      <circle cx="9" cy="6" r="1.5" /><circle cx="15" cy="6" r="1.5" />
      <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
      <circle cx="9" cy="18" r="1.5" /><circle cx="15" cy="18" r="1.5" />
    </svg>
  ),
  image: (p: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={p.className} aria-hidden="true">
      <rect x="3" y="4.5" width="18" height="15" rx="2" />
      <circle cx="8.5" cy="9.5" r="1.6" />
      <path d="m4 17 4.8-4.4a1.8 1.8 0 0 1 2.4 0L20 20" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  target: (p: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={p.className} aria-hidden="true">
      <circle cx="12" cy="12" r="7.5" /><circle cx="12" cy="12" r="2.2" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" strokeLinecap="round" />
    </svg>
  ),
}

/** One row of curated choices. Used for every "look" axis. */
function Choices<T extends string>({
  value,
  onChange,
  options,
  accent,
}: {
  value: T
  onChange: (v: T) => void
  options: ReadonlyArray<{ key: T; label: string; blurb?: string }>
  accent: string
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = o.key === value
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => onChange(o.key)}
            aria-pressed={on}
            title={o.blurb}
            className={`min-h-[36px] cursor-pointer rounded-lg px-3 text-[12px] font-medium transition-colors duration-200 ${
              on ? "text-white" : "bg-white/[0.07] text-white/65 hover:bg-white/15"
            }`}
            style={on ? { background: accent } : undefined}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------- helpers */

function Swatch({ theme, accent, on }: { theme: Theme; accent: Accent; on: boolean }) {
  return (
    <span
      className="block h-6 w-6 rounded-full ring-1 ring-black/10"
      style={{ background: accentFor(theme, accent), boxShadow: on ? "0 0 0 2px #fff, 0 0 0 4px currentColor" : undefined }}
    />
  )
}

/** A labelled group in the control rail. Never a naked fieldset (design law). */
function Group({ title, caption, children }: { title: string; caption?: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-white/10 px-5 py-5 last:border-b-0">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">{title}</h3>
      {caption ? <p className="mt-1 text-[12.5px] leading-relaxed text-white/60">{caption}</p> : null}
      <div className="mt-3.5">{children}</div>
    </section>
  )
}

/* ------------------------------------------------------- the previewed page */

function FakeSection({
  k,
  theme,
  accent,
  active,
  onPick,
  compact,
  radius,
  pad,
  intensity,
}: {
  k: string
  theme: Theme
  accent: string
  active: boolean
  onPick: () => void
  compact: boolean
  radius: number
  pad: number
  intensity: Intensity
}) {
  const def = SECTION_BY_KEY[k]
  /* Intensity decides how far the club's colour reaches: accents only, headings
     too, or the section ground itself. */
  const headTinted = intensity !== "subtle"
  const filled = intensity === "bold"
  const head = (t: string) => (
    <h4
      className="mb-2.5 text-[15px] font-semibold"
      style={{
        color: headTinted ? accent : theme.ink,
        fontFamily: theme.headingFont,
        textTransform: theme.headingCase === "upper" ? "uppercase" : "none",
        letterSpacing: theme.headingCase === "upper" ? theme.headingTracking : undefined,
      }}
    >
      {t}
    </h4>
  )
  const bar = (w: string, dim = false) => (
    <div className="h-2 rounded-full" style={{ width: w, background: dim ? theme.inkMuted : theme.ink, opacity: dim ? 0.28 : 0.16 }} />
  )
  const tile = (label: string) => (
    <div className="rounded-lg p-2.5" style={{ background: theme.bg, border: `1px solid ${theme.border}` }}>
      <div className="mb-1.5 h-1.5 w-8 rounded-full" style={{ background: accent }} />
      <div className="text-[10.5px] font-medium" style={{ color: theme.inkMuted }}>{label}</div>
    </div>
  )

  let body: React.ReactNode = null
  if (k === "about") body = <div className="space-y-1.5">{bar("100%", true)}{bar("94%", true)}{bar("62%", true)}</div>
  else if (k === "cta")
    body = (
      <div className="flex items-center justify-between gap-3 rounded-xl p-3" style={{ background: accent }}>
        <div className="text-[12px] font-semibold text-white">Tryouts are open for the 2026 season</div>
        <div className="rounded-lg bg-white/95 px-3 py-1.5 text-[11px] font-bold" style={{ color: accent }}>Register</div>
      </div>
    )
  else if (k === "programs")
    body = <div className={`grid gap-2 ${compact ? "grid-cols-2" : "grid-cols-3"}`}>{["Spring Camp", "House League", "Skills", "March Break"].slice(0, compact ? 4 : 4).map(tile)}</div>
  else if (k === "teams")
    /* Grouped by age band, not a flat list of team records. The unit is the thing
       a parent actually has: a kid of a certain age. Status is what they came for,
       and absence ("not running") is information a list cannot express. */
    body = (
      <div className="space-y-1">
        {(
          [
            ["Grade 8", 2, "open"],
            ["Grade 9", 3, "on"],
            ["Grade 10", 2, "full"],
            ["Grade 11", 0, "none"],
          ] as Array<[string, number, "open" | "on" | "full" | "none"]>
        ).map(([band, n, state]) => {
          const chip =
            state === "open"
              ? { label: "Tryouts open", bg: accent, fg: "#fff" }
              : state === "on"
                ? { label: "Season underway", bg: `${accent}22`, fg: accent }
                : state === "full"
                  ? { label: "Roster full", bg: "transparent", fg: theme.inkMuted }
                  : { label: "Not running", bg: "transparent", fg: theme.inkMuted }
          return (
            <div
              key={band}
              className="flex items-center gap-2 px-2.5 py-2"
              style={{
                background: state === "none" ? "transparent" : theme.bg,
                border: `1px solid ${state === "none" ? "transparent" : theme.border}`,
                borderRadius: Math.max(radius - 4, 2),
                opacity: state === "none" ? 0.55 : 1,
              }}
            >
              <span className="text-[11.5px] font-semibold" style={{ color: state === "none" ? theme.inkMuted : theme.ink }}>
                {band}
              </span>
              <span className="text-[10.5px]" style={{ color: theme.inkMuted }}>
                {n > 0 ? `${n} ${n === 1 ? "team" : "teams"}` : "—"}
              </span>
              <span
                className="ml-auto whitespace-nowrap px-2 py-0.5 text-[9.5px] font-bold"
                style={{ background: chip.bg, color: chip.fg, borderRadius: 999 }}
              >
                {chip.label}
              </span>
            </div>
          )
        })}
      </div>
    )
  else if (k === "schedule")
    body = (
      <div className="space-y-1.5">
        {[["Sat 12 Sep", "Storm", "72", "Kings", "68"], ["Sun 13 Sep", "Storm", "55", "Elite", "61"]].map((r) => (
          <div key={r[0]} className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-[10.5px]" style={{ background: theme.bg, border: `1px solid ${theme.border}` }}>
            <span style={{ color: theme.inkMuted }}>{r[0]}</span>
            <span className="ml-auto font-semibold" style={{ color: theme.ink }}>{r[1]} {r[2]}</span>
            <span style={{ color: theme.inkMuted }}>vs</span>
            <span className="font-semibold" style={{ color: theme.ink }}>{r[3]} {r[4]}</span>
          </div>
        ))}
      </div>
    )
  else if (k === "staff")
    body = (
      <div className="flex gap-2.5">
        {["HC", "AC", "AC", "TM"].map((i, n) => (
          <div key={n} className="flex flex-col items-center gap-1">
            <div className="grid h-10 w-10 place-items-center rounded-full text-[10px] font-bold text-white" style={{ background: accent, opacity: 1 - n * 0.14 }}>{i}</div>
            <div className="h-1.5 w-8 rounded-full" style={{ background: theme.inkMuted, opacity: 0.3 }} />
          </div>
        ))}
      </div>
    )
  else if (k === "news")
    body = <div className={`grid gap-2 ${compact ? "grid-cols-1" : "grid-cols-2"}`}>{["Storm hold on late", "Six players in double figures"].map((t) => (
      <div key={t} className="overflow-hidden rounded-lg" style={{ border: `1px solid ${theme.border}` }}>
        <div className="h-10" style={{ background: accent, opacity: 0.22 }} />
        <div className="p-2 text-[10.5px] font-medium" style={{ color: theme.ink }}>{t}</div>
      </div>
    ))}</div>
  else if (k === "honours")
    body = <div className="flex gap-2">{["2025 Champions", "2024 Finalists"].map((t) => (
      <div key={t} className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-semibold" style={{ background: accent, color: "#fff" }}>
        <Icon.bolt className="h-3 w-3" />{t}
      </div>
    ))}</div>
  else if (k === "venues")
    body = (
      <div className="overflow-hidden rounded-lg" style={{ border: `1px solid ${theme.border}` }}>
        <div className="h-14" style={{ background: `linear-gradient(135deg, ${accent}33, ${accent}0d)` }} />
        <div className="p-2 text-[10.5px]" style={{ color: theme.inkMuted }}>Erindale Secondary School, Mississauga</div>
      </div>
    )
  else if (k === "faq")
    body = <div className="space-y-1.5">{["What does a season cost?", "What age groups do you run?"].map((q) => (
      <div key={q} className="rounded-lg px-2.5 py-2 text-[10.5px] font-medium" style={{ background: theme.bg, border: `1px solid ${theme.border}`, color: theme.ink }}>{q}</div>
    ))}</div>
  else if (k === "nextgame")
    body = (
      <div className="rounded-lg p-2.5 text-center" style={{ background: accent }}>
        <div className="text-[9.5px] font-semibold uppercase tracking-widest text-white/80">Next game</div>
        <div className="mt-0.5 text-[12px] font-bold text-white">Sat 12 Sep, 2:00pm</div>
        <div className="text-[10px] text-white/85">vs Brampton Kings</div>
      </div>
    )
  else if (k === "stats")
    body = <div className="grid grid-cols-3 gap-1.5">{[["12", "Teams"], ["4", "Programs"], ["9", "Staff"]].map(([n, l]) => (
      <div key={l} className="rounded-lg py-1.5 text-center" style={{ background: theme.bg, border: `1px solid ${theme.border}` }}>
        <div className="text-[13px] font-bold" style={{ color: accent }}>{n}</div>
        <div className="text-[9px]" style={{ color: theme.inkMuted }}>{l}</div>
      </div>
    ))}</div>
  else if (k === "contact") body = <div className="space-y-1.5">{bar("80%", true)}{bar("58%", true)}</div>
  else if (k === "socials")
    body = <div className="flex gap-1.5">{[0, 1, 2].map((i) => <div key={i} className="h-7 w-7 rounded-lg" style={{ background: accent, opacity: 0.85 - i * 0.15 }} />)}</div>
  else if (k === "sponsors")
    body = <div className="grid grid-cols-3 gap-1.5">{[0, 1, 2].map((i) => <div key={i} className="h-8 rounded" style={{ background: theme.inkMuted, opacity: 0.16 }} />)}</div>
  else body = <div className="space-y-1.5">{bar("90%", true)}{bar("70%", true)}</div>

  return (
    <button
      type="button"
      onClick={onPick}
      aria-label={`Edit ${def?.label ?? k}`}
      className="group relative w-full cursor-pointer text-left transition-colors duration-200"
      style={{
        background: filled ? `linear-gradient(160deg, ${accent}14, ${theme.panel} 55%)` : theme.panel,
        border: `1px solid ${active ? accent : theme.border}`,
        borderRadius: radius,
        padding: pad,
        boxShadow: active ? `0 0 0 2px ${accent}44` : undefined,
      }}
    >
      <span
        className="pointer-events-none absolute right-2 top-2 flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100"
        style={{ background: accent, color: "#fff" }}
      >
        <Icon.pen className="h-2.5 w-2.5" />Edit
      </span>
      {head(def?.label ?? k)}
      {body}
    </button>
  )
}

/* ----------------------------------------------------------- the club header */

/**
 * Five header styles, one rule: the photo is never required and never stretched.
 * It is always `object-fit: cover` anchored at the club's focal point, so a square
 * phone snap and a wide banner both crop correctly at every breakpoint.
 */
function ClubHeader({
  style,
  theme,
  accent,
  compact,
  showPhoto,
  focal,
  radius,
}: {
  style: string
  theme: Theme
  accent: string
  compact: boolean
  showPhoto: boolean
  focal: string
  radius: number
}) {
  const name = (size: string, onColour = false) => (
    <div
      className={`truncate font-bold ${size}`}
      style={{
        color: onColour ? "#fff" : theme.ink,
        fontFamily: theme.headingFont,
        textTransform: theme.headingCase === "upper" ? "uppercase" : "none",
        letterSpacing: theme.headingTracking,
      }}
    >
      Mississauga Storm
    </div>
  )
  const sub = (onColour = false) => (
    <div className="truncate text-[11.5px]" style={{ color: onColour ? "rgba(255,255,255,0.85)" : theme.inkMuted }}>
      Youth basketball since 2009
    </div>
  )
  const crest = (size: number) => (
    <div
      className="grid shrink-0 place-items-center font-black text-white shadow-lg"
      style={{
        background: accent,
        width: size,
        height: size,
        borderRadius: radius + 6,
        border: `3px solid ${theme.panel}`,
        fontSize: size * 0.26,
      }}
    >
      MS
    </div>
  )
  /* The stand-in photo. object-position carries the focal point. */
  const photo = (h: string | number) => (
    <div className="relative w-full overflow-hidden" style={{ height: h }}>
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(135deg, ${accent}, ${accent}22 60%, #0b1729)`,
          backgroundPosition: focal,
          backgroundSize: "cover",
        }}
      />
      <span className="absolute bottom-1 right-2 text-[9px] text-white/40">focal {focal}</span>
    </div>
  )

  if (style === "immersive") {
    return (
      <div className="relative">
        {showPhoto ? photo(compact ? 190 : 260) : <div style={{ height: compact ? 150 : 210, background: `linear-gradient(135deg, ${accent}, ${accent}66)` }} />}
        <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.72), rgba(0,0,0,0.06) 60%)" }} />
        <div className="absolute bottom-0 left-0 right-0 flex items-end gap-3 p-4">
          {crest(compact ? 46 : 58)}
          <div className="min-w-0 pb-0.5">{name(compact ? "text-[17px]" : "text-[23px]", true)}{sub(true)}</div>
        </div>
      </div>
    )
  }

  if (style === "split") {
    return (
      <div className={compact ? "" : "flex"}>
        <div className={compact ? "" : "w-[46%] shrink-0"}>
          {showPhoto ? photo(compact ? 130 : 180) : <div style={{ height: compact ? 90 : 180, background: `linear-gradient(135deg, ${accent}, ${accent}55)` }} />}
        </div>
        <div className="flex flex-1 flex-col justify-center gap-2 p-4">
          <div className="flex items-center gap-2.5">{crest(compact ? 40 : 48)}<div className="min-w-0">{name(compact ? "text-[16px]" : "text-[20px]")}{sub()}</div></div>
          <div className="inline-flex w-fit px-3 py-1.5 text-[11px] font-bold text-white" style={{ background: accent, borderRadius: radius }}>
            Register for tryouts
          </div>
        </div>
      </div>
    )
  }

  if (style === "crest") {
    return (
      <div className="flex flex-col items-center gap-2 px-4 py-6 text-center" style={{ background: `linear-gradient(160deg, ${accent}1f, transparent)` }}>
        {crest(compact ? 62 : 78)}
        <div className="min-w-0">{name(compact ? "text-[18px]" : "text-[24px]")}{sub()}</div>
      </div>
    )
  }

  if (style === "plain") {
    return (
      <div className="flex items-center gap-3 px-4 py-4" style={{ borderBottom: `3px solid ${accent}` }}>
        {crest(compact ? 40 : 46)}
        <div className="min-w-0">{name(compact ? "text-[16px]" : "text-[20px]")}{sub()}</div>
      </div>
    )
  }

  /* banner (default) */
  return (
    <>
      {showPhoto ? photo(compact ? 96 : 128) : <div style={{ height: compact ? 72 : 96, background: `linear-gradient(120deg, ${accent}, ${accent}55)` }} />}
      <div className={`flex items-end gap-3 px-4 pb-3 ${compact ? "-mt-7" : "-mt-9"}`}>
        {crest(compact ? 56 : 68)}
        <div className="min-w-0 pb-1">{name(compact ? "text-[16px]" : "text-[21px]")}{sub()}</div>
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ the page */

export function ClubStudio() {
  const [themeKey, setThemeKey] = useState(THEMES[0].key)
  const [accentKey, setAccentKey] = useState(ACCENTS[0].key)
  const [sections, setSections] = useState<SectionState[]>(DEFAULT_SECTIONS)
  const [device, setDevice] = useState<"desktop" | "phone">("desktop")
  const [active, setActive] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)

  // "Look" axes — two clubs on the same theme should not look alike.
  const [header, setHeader] = useState(HEADER_STYLES[0].key)
  const [intensity, setIntensity] = useState<Intensity>("balanced")
  const [shape, setShape] = useState<ShapeKey>("soft")
  const [density, setDensity] = useState<DensityKey>("normal")

  // Whatever image they happen to have. 2.6 is a wide banner, 0.8 a phone photo.
  const [image, setImage] = useState<ImageState>({ present: true, focalX: 50, focalY: 38, naturalAspect: 1.5 })

  // Drag reorder. The arrow buttons stay as the keyboard path — drag alone is
  // not operable without a pointer, which fails accessibility outright.
  const [dragKey, setDragKey] = useState<string | null>(null)
  const [overKey, setOverKey] = useState<string | null>(null)
  const focalRef = useRef<HTMLButtonElement | null>(null)

  const theme = THEMES.find((t) => t.key === themeKey)!
  const accentDef = ACCENTS.find((a) => a.key === accentKey)!
  const accent = accentFor(theme, accentDef)
  const compact = device === "phone"
  const radius = SHAPES.find((s) => s.key === shape)!.radius
  const dens = DENSITIES.find((d) => d.key === density)!
  const headerDef = HEADER_STYLES.find((h) => h.key === header)!
  const showPhoto = headerDef.usesPhoto && image.present

  function reorder(from: string, to: string) {
    setSections((s) => {
      const a = s.find((x) => x.key === from)
      const b = s.find((x) => x.key === to)
      if (!a || !b || a.zone !== b.zone) return s
      const peers = s.filter((x) => x.zone === a.zone).sort((x, y) => x.order - y.order)
      const without = peers.filter((x) => x.key !== from)
      const at = without.findIndex((x) => x.key === to)
      without.splice(at < 0 ? without.length : at, 0, a)
      const orders = new Map(without.map((x, i) => [x.key, i + 1]))
      return s.map((x) => (orders.has(x.key) ? { ...x, order: orders.get(x.key)! } : x))
    })
    setDirty(true)
  }

  function setFocal(e: React.MouseEvent<HTMLButtonElement>) {
    const r = e.currentTarget.getBoundingClientRect()
    setImage((i) => ({
      ...i,
      focalX: Math.round(((e.clientX - r.left) / r.width) * 100),
      focalY: Math.round(((e.clientY - r.top) / r.height) * 100),
    }))
    setDirty(true)
  }

  const visible = useMemo(
    () => (z: Zone) => sections.filter((s) => s.zone === z && s.visible).sort((a, b) => a.order - b.order),
    [sections]
  )

  function toggle(key: string) {
    setSections((s) => s.map((x) => (x.key === key ? { ...x, visible: !x.visible } : x)))
    setDirty(true)
  }
  function move(key: string, dir: -1 | 1) {
    setSections((s) => {
      const me = s.find((x) => x.key === key)
      if (!me) return s
      const peers = s.filter((x) => x.zone === me.zone).sort((a, b) => a.order - b.order)
      const i = peers.findIndex((x) => x.key === key)
      const j = i + dir
      if (j < 0 || j >= peers.length) return s
      const swap = peers[j]
      return s.map((x) =>
        x.key === me.key ? { ...x, order: swap.order } : x.key === swap.key ? { ...x, order: me.order } : x
      )
    })
    setDirty(true)
  }

  return (
    <div className="min-h-screen bg-[#070d18] text-white">
      {/* ---------------------------------------------------------- top bar */}
      <header className="sticky top-0 z-30 flex flex-wrap items-center gap-3 border-b border-white/10 bg-[#0a1120]/95 px-4 py-3 backdrop-blur-xl sm:px-6">
        <div>
          <h1 className="text-[15px] font-semibold leading-tight">Your club page</h1>
          <p className="text-[12px] text-white/55">Mississauga Storm Basketball</p>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <div className="flex overflow-hidden rounded-lg border border-white/15" role="group" aria-label="Preview size">
            {([["desktop", Icon.desktop, "Desktop"], ["phone", Icon.phone, "Phone"]] as const).map(([k, I, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setDevice(k)}
                aria-pressed={device === k}
                className={`flex min-h-[44px] cursor-pointer items-center gap-1.5 px-3 text-[12px] font-medium transition-colors duration-200 ${
                  device === k ? "bg-white text-[#0a1120]" : "text-white/70 hover:bg-white/10"
                }`}
              >
                <I className="h-4 w-4" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={!dirty}
            className="min-h-[44px] cursor-pointer rounded-lg px-4 text-[13px] font-semibold text-white transition-opacity duration-200 disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: dirty ? accent : "rgba(255,255,255,0.14)" }}
          >
            {dirty ? "Save changes" : "Saved"}
          </button>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1600px] flex-col lg:flex-row">
        {/* ------------------------------------------------------ control rail */}
        <aside className="w-full shrink-0 border-b border-white/10 lg:w-[356px] lg:border-b-0 lg:border-r">
          <Group title="Theme" caption="Pick a look. Colours, type and contrast are handled for you.">
            <div className="grid grid-cols-2 gap-2">
              {THEMES.map((t) => {
                const on = t.key === themeKey
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => { setThemeKey(t.key); setDirty(true) }}
                    aria-pressed={on}
                    className={`cursor-pointer overflow-hidden rounded-xl border text-left transition-colors duration-200 ${
                      on ? "border-white/70" : "border-white/12 hover:border-white/35"
                    }`}
                  >
                    <div className="flex h-11 items-end gap-1 p-1.5" style={{ background: t.bg }}>
                      <span className="h-5 flex-1 rounded" style={{ background: t.panel }} />
                      <span className="h-3.5 w-3.5 rounded-full" style={{ background: accentFor(t, accentDef) }} />
                    </div>
                    <div className="px-2 py-1.5">
                      <div className="text-[12px] font-semibold">{t.label}</div>
                      <div className="text-[10.5px] leading-snug text-white/50">{t.blurb}</div>
                    </div>
                  </button>
                )
              })}
            </div>
          </Group>

          <Group title="Your club colour" caption="One colour, yours. Every option stays readable on every theme.">
            <div className="flex flex-wrap gap-2.5">
              {ACCENTS.map((a) => {
                const on = a.key === accentKey
                return (
                  <button
                    key={a.key}
                    type="button"
                    onClick={() => { setAccentKey(a.key); setDirty(true) }}
                    aria-label={a.label}
                    aria-pressed={on}
                    title={a.label}
                    className="flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center rounded-lg transition-colors duration-200 hover:bg-white/10"
                    style={{ color: accentFor(theme, a) }}
                  >
                    <Swatch theme={theme} accent={a} on={on} />
                  </button>
                )
              })}
            </div>
          </Group>

          <Group title="Header" caption="How the top of your page looks. Two of these need no photo at all.">
            <div className="grid grid-cols-1 gap-1.5">
              {HEADER_STYLES.map((h) => {
                const on = h.key === header
                return (
                  <button
                    key={h.key}
                    type="button"
                    onClick={() => { setHeader(h.key); setDirty(true) }}
                    aria-pressed={on}
                    className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-colors duration-200 ${
                      on ? "border-white/60 bg-white/10" : "border-white/12 hover:border-white/30"
                    }`}
                  >
                    <span className="grid h-8 w-11 shrink-0 place-items-center overflow-hidden rounded" style={{ background: theme.bg, border: `1px solid ${theme.border}` }}>
                      {h.key === "banner" && <span className="h-3 w-full" style={{ background: accent }} />}
                      {h.key === "split" && <span className="flex h-full w-full"><span className="w-1/2" style={{ background: accent }} /></span>}
                      {h.key === "immersive" && <span className="h-full w-full" style={{ background: accent }} />}
                      {h.key === "crest" && <span className="h-4 w-4 rounded-md" style={{ background: accent }} />}
                      {h.key === "plain" && <span className="h-1.5 w-7 rounded-full" style={{ background: accent }} />}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[12px] font-semibold">{h.label}</span>
                      <span className="block text-[10.5px] leading-snug text-white/50">{h.blurb}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </Group>

          <Group title="Your photo" caption="Any photo, any shape. We never ask for a size. Mark what matters and we keep it in frame everywhere.">
            <label className="mb-2.5 flex cursor-pointer items-center gap-2 text-[12px] text-white/70">
              <input
                type="checkbox"
                checked={image.present}
                onChange={(e) => { setImage((i) => ({ ...i, present: e.target.checked })); setDirty(true) }}
                className="h-4 w-4 cursor-pointer accent-current"
                style={{ accentColor: accent }}
              />
              I have a photo to use
            </label>

            {image.present ? (
              <>
                <button
                  ref={focalRef}
                  type="button"
                  onClick={setFocal}
                  aria-label="Set the important part of your photo"
                  className="relative block w-full cursor-crosshair overflow-hidden rounded-lg border border-white/15"
                  style={{ aspectRatio: String(image.naturalAspect) }}
                >
                  {/* stand-in for their upload; the point is the framing, not the art */}
                  <span className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${accent}, ${accent}22 60%, #0b1729)` }} />
                  <span className="absolute inset-0 grid place-items-center text-[10.5px] font-medium text-white/50">their photo</span>
                  <span
                    className="pointer-events-none absolute h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-lg"
                    style={{ left: `${image.focalX}%`, top: `${image.focalY}%`, boxShadow: `0 0 0 3px ${accent}` }}
                  />
                </button>
                <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed text-white/45">
                  <Icon.target className="mt-0.5 h-3 w-3 shrink-0" />
                  Click the part that matters. Nothing gets stretched, and the crop follows that point on every screen.
                </p>
                <div className="mt-2.5">
                  <div className="mb-1.5 text-[10.5px] text-white/45">Try a different shape of photo</div>
                  <Choices
                    value={String(image.naturalAspect) as string}
                    onChange={(v) => { setImage((i) => ({ ...i, naturalAspect: Number(v) })); setDirty(true) }}
                    options={[
                      { key: "2.6", label: "Wide" },
                      { key: "1.5", label: "Standard" },
                      { key: "1", label: "Square" },
                      { key: "0.8", label: "Phone" },
                    ]}
                    accent={accent}
                  />
                </div>
              </>
            ) : (
              <p className="rounded-lg bg-white/[0.06] p-2.5 text-[11.5px] leading-relaxed text-white/55">
                No photo is a fine answer. Crest first and Name only are built to look finished without one.
              </p>
            )}
          </Group>

          <Group title="Feel" caption="Same theme, different club. These four make the biggest difference.">
            <div className="space-y-3">
              {[
                { label: "Colour", value: intensity, set: (v: string) => { setIntensity(v as Intensity); setDirty(true) }, options: INTENSITIES },
                { label: "Corners", value: shape, set: (v: string) => { setShape(v as ShapeKey); setDirty(true) }, options: SHAPES },
                { label: "Spacing", value: density, set: (v: string) => { setDensity(v as DensityKey); setDirty(true) }, options: DENSITIES },
              ].map((row) => (
                <div key={row.label}>
                  <div className="mb-1.5 text-[10.5px] font-medium text-white/45">{row.label}</div>
                  <Choices value={row.value as string} onChange={row.set} options={row.options as any} accent={accent} />
                </div>
              ))}
            </div>
          </Group>

          <Group title="Sections" caption="Drag to reorder, or use the arrows. The eye hides a section without removing it.">
            <ul className="space-y-1">
              {(["main", "rail"] as Zone[]).map((zone) => (
                <li key={zone}>
                  <div className="px-1 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">
                    {zone === "main" ? "Main column" : "Side column"}
                  </div>
                  <ul className="space-y-1">
                    {sections
                      .filter((s) => s.zone === zone)
                      .sort((a, b) => a.order - b.order)
                      .map((s) => {
                        const def = SECTION_BY_KEY[s.key]
                        if (!def) return null
                        const on = active === s.key
                        return (
                          <li
                            key={s.key}
                            draggable
                            onDragStart={(e) => { setDragKey(s.key); e.dataTransfer.effectAllowed = "move" }}
                            onDragEnd={() => { setDragKey(null); setOverKey(null) }}
                            onDragOver={(e) => {
                              if (!dragKey || dragKey === s.key) return
                              const src = sections.find((x) => x.key === dragKey)
                              if (src?.zone !== s.zone) return // reordering is within a column
                              e.preventDefault()
                              e.dataTransfer.dropEffect = "move"
                              setOverKey(s.key)
                            }}
                            onDragLeave={() => setOverKey((k) => (k === s.key ? null : k))}
                            onDrop={(e) => {
                              e.preventDefault()
                              if (dragKey && dragKey !== s.key) reorder(dragKey, s.key)
                              setDragKey(null); setOverKey(null)
                            }}
                            className={`flex items-center gap-1 rounded-lg px-1 py-1.5 transition-colors duration-200 ${
                              on ? "bg-white/12" : "hover:bg-white/[0.06]"
                            } ${dragKey === s.key ? "opacity-40" : ""}`}
                            style={overKey === s.key ? { boxShadow: `inset 0 2px 0 ${accent}` } : undefined}
                          >
                            <span
                              aria-hidden="true"
                              className="flex h-9 w-5 shrink-0 cursor-grab items-center justify-center text-white/25 transition-colors duration-200 hover:text-white/60 active:cursor-grabbing"
                            >
                              <Icon.grip className="h-3.5 w-3.5" />
                            </span>
                            <button
                              type="button"
                              onClick={() => toggle(s.key)}
                              aria-label={s.visible ? `Hide ${def.label}` : `Show ${def.label}`}
                              aria-pressed={s.visible}
                              className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors duration-200 hover:bg-white/10"
                              style={{ color: s.visible ? accent : "rgba(255,255,255,0.35)" }}
                            >
                              {s.visible ? <Icon.eye className="h-4 w-4" /> : <Icon.eyeOff className="h-4 w-4" />}
                            </button>
                            <button
                              type="button"
                              onClick={() => setActive(s.key)}
                              className="min-w-0 flex-1 cursor-pointer text-left"
                            >
                              <div className="flex items-center gap-1.5">
                                <span className={`truncate text-[12.5px] font-medium ${s.visible ? "text-white" : "text-white/40"}`}>
                                  {def.label}
                                </span>
                                {def.isNew ? (
                                  <span className="rounded px-1 py-px text-[8.5px] font-bold uppercase tracking-wider" style={{ background: accent, color: "#fff" }}>New</span>
                                ) : null}
                                {def.needsStorage ? <Icon.lock className="h-3 w-3 shrink-0 text-white/30" /> : null}
                              </div>
                              <div className="truncate text-[10.5px] text-white/45">
                                {def.source === "auto" ? "Fills itself" : def.source === "upload" ? "You upload" : "You write"}
                                {" · "}{def.hint}
                              </div>
                            </button>
                            <div className="flex shrink-0">
                              {([[-1, Icon.up, "up"], [1, Icon.down, "down"]] as const).map(([d, I, name]) => (
                                <button
                                  key={name}
                                  type="button"
                                  onClick={() => move(s.key, d)}
                                  aria-label={`Move ${def.label} ${name}`}
                                  className="flex h-9 w-7 cursor-pointer items-center justify-center rounded-md text-white/45 transition-colors duration-200 hover:bg-white/10 hover:text-white"
                                >
                                  <I className="h-3.5 w-3.5" />
                                </button>
                              ))}
                            </div>
                          </li>
                        )
                      })}
                  </ul>
                </li>
              ))}
            </ul>
            <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-white/40">
              <Icon.lock className="mt-0.5 h-3 w-3 shrink-0" />
              Sponsors and Photos need image hosting, which is not built yet.
            </p>
          </Group>
        </aside>

        {/* ---------------------------------------------------------- preview */}
        <main className="min-w-0 flex-1 p-4 sm:p-8">
          <div className="mb-3 flex items-center gap-2 text-[11.5px] text-white/45">
            <Icon.eye className="h-3.5 w-3.5" />
            This is exactly what families see. Click any section to edit it.
          </div>

          <div
            className={`mx-auto overflow-hidden rounded-2xl shadow-2xl transition-all duration-300 ${compact ? "max-w-[400px]" : "max-w-[1000px]"}`}
            style={{ background: theme.bg, border: `1px solid ${theme.border}` }}
          >
            {/* club header — replaces SportsHub chrome with theirs.
                The photo is object-fit cover positioned at the focal point, so any
                aspect ratio works and nothing is ever stretched. */}
            <div className="relative">
              <ClubHeader
                style={header}
                theme={theme}
                accent={accent}
                compact={compact}
                showPhoto={showPhoto}
                focal={`${image.focalX}% ${image.focalY}%`}
                radius={radius}
              />
              {/* their nav, built from visible sections */}
              <div className="flex gap-4 overflow-x-auto border-t px-4 py-2 text-[11.5px]" style={{ borderColor: theme.border }}>
                {visible("main").slice(0, 6).map((s, i) => (
                  <span key={s.key} className="whitespace-nowrap font-medium" style={{ color: i === 0 ? accent : theme.inkMuted }}>
                    {SECTION_BY_KEY[s.key]?.label}
                  </span>
                ))}
              </div>
            </div>

            {/* body */}
            <div className={compact ? "flex flex-col" : "flex"} style={{ fontFamily: theme.bodyFont, gap: dens.gap, padding: dens.gap }}>
              <div className="min-w-0 flex-1" style={{ display: "flex", flexDirection: "column", gap: dens.gap }}>
                {visible("main").map((s) => (
                  <FakeSection key={s.key} k={s.key} theme={theme} accent={accent} compact={compact} radius={radius} pad={dens.pad} intensity={intensity} active={active === s.key} onPick={() => setActive(s.key)} />
                ))}
              </div>
              <div className={compact ? "" : "w-[240px] shrink-0"} style={{ display: "flex", flexDirection: "column", gap: dens.gap }}>
                {visible("rail").map((s) => (
                  <FakeSection key={s.key} k={s.key} theme={theme} accent={accent} compact={compact} radius={radius} pad={dens.pad} intensity={intensity} active={active === s.key} onPick={() => setActive(s.key)} />
                ))}
              </div>
            </div>

            <div className="border-t px-4 py-3 text-center text-[10.5px]" style={{ borderColor: theme.border, color: theme.inkMuted }}>
              Mississauga Storm Basketball · Powered by SportsHub
            </div>
          </div>

          {active ? (
            <div className="mx-auto mt-4 max-w-[1000px] rounded-xl border border-white/12 bg-white/[0.04] p-4">
              <div className="flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-lg" style={{ background: accent }}>
                  <Icon.pen className="h-3.5 w-3.5 text-white" />
                </span>
                <h3 className="text-[13.5px] font-semibold">{SECTION_BY_KEY[active]?.label}</h3>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium text-white/60">
                  {SECTION_BY_KEY[active]?.source === "auto" ? "Fills itself from your data" : SECTION_BY_KEY[active]?.source === "upload" ? "You upload" : "You write this"}
                </span>
              </div>
              <p className="mt-2 text-[12.5px] leading-relaxed text-white/60">
                {SECTION_BY_KEY[active]?.source === "auto"
                  ? "Nothing to write. This section stays current on its own as you run your season. Hide it if you would rather not show it."
                  : "The editing fields for this section land here, in place, without leaving the page."}
              </p>
            </div>
          ) : null}
        </main>
      </div>
    </div>
  )
}
