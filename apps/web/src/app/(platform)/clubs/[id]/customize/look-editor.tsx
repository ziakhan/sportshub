"use client"

/**
 * Look editor — the Club Page Studio, wired (owner 2026-08-18).
 *
 * Design approved at /dev/club-studio. The rule it enforces: a club picks a LOOK,
 * never a layout language. Every control is a curated choice whose contrast we
 * have already checked, so a volunteer coach cannot produce an unreadable page.
 *
 * The preview is the point. The owner's brief was "a preview, not drag-and-drop
 * without looking", so nothing here is changed blind: every control repaints the
 * sample page beside it, and the device toggle makes the phone layout visible
 * instead of theoretical.
 */

import { useMemo, useState } from "react"
import {
  THEMES,
  ACCENTS,
  HEADER_STYLES,
  INTENSITIES,
  SHAPES,
  DENSITIES,
  accentFor,
  type Theme,
} from "@/lib/club-page/theme"

export interface LookValue {
  theme: string | null
  accentKey: string | null
  /** Set when the club picked its exact colour instead of one of the ten. */
  primaryColor?: string | null
  headerStyle: string | null
  intensity: string | null
  shape: string | null
  density: string | null
  bannerFocalX: number | null
  bannerFocalY: number | null
}

const Icon = {
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
  target: (p: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={p.className} aria-hidden="true">
      <circle cx="12" cy="12" r="7.5" /><circle cx="12" cy="12" r="2.2" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" strokeLinecap="round" />
    </svg>
  ),
}

function Choices({
  value,
  onChange,
  options,
  accent,
  label,
}: {
  value: string
  onChange: (v: string) => void
  options: ReadonlyArray<{ key: string; label: string; blurb?: string }>
  accent: string
  label: string
}) {
  return (
    <div>
      <div className="text-ink-500 mb-1.5 text-[11px] font-medium">{label}</div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={label}>
        {options.map((o) => {
          const on = o.key === value
          return (
            <button
              key={o.key}
              type="button"
              onClick={() => onChange(o.key)}
              aria-pressed={on}
              title={o.blurb}
              className={`min-h-[38px] cursor-pointer rounded-lg px-3 text-[12.5px] font-medium transition-colors duration-200 ${
                on ? "text-white" : "bg-ink-50 text-ink-600 hover:bg-ink-100"
              }`}
              style={on ? { background: accent } : undefined}
            >
              {o.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** A miniature of the public page. Repaints on every control change. */
function Preview({
  theme,
  accent,
  radius,
  gap,
  header,
  intensity,
  focal,
  compact,
  clubName,
  hasBanner,
}: {
  theme: Theme
  accent: string
  radius: number
  gap: number
  header: string
  intensity: string
  focal: string
  compact: boolean
  clubName: string
  hasBanner: boolean
}) {
  const initials = clubName.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "CL"
  const filled = intensity === "bold"
  const tinted = intensity !== "subtle"
  const showPhoto = hasBanner && ["banner", "split", "immersive"].includes(header)

  const headingStyle = {
    fontFamily: theme.headingFont,
    textTransform: theme.headingCase === "upper" ? ("uppercase" as const) : ("none" as const),
    letterSpacing: theme.headingTracking,
    color: theme.ink,
  }
  const photo = (h: number) => (
    <div className="w-full" style={{ height: h, background: `linear-gradient(135deg, ${accent}, ${accent}22 60%, #0b1729)`, backgroundPosition: focal, backgroundSize: "cover" }} />
  )
  const crest = (size: number) => (
    <div className="grid shrink-0 place-items-center font-black text-white" style={{ background: accent, width: size, height: size, borderRadius: radius + 6, border: `3px solid ${theme.panel}`, fontSize: size * 0.3 }}>
      {initials}
    </div>
  )

  let head: React.ReactNode
  if (header === "immersive") {
    head = (
      <div className="relative">
        {showPhoto ? photo(compact ? 130 : 150) : <div style={{ height: compact ? 110 : 130, background: `linear-gradient(135deg, ${accent}, ${accent}66)` }} />}
        <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.7), transparent 60%)" }} />
        <div className="absolute bottom-0 flex items-end gap-2 p-3">
          {crest(compact ? 34 : 40)}
          <div className="truncate pb-0.5 text-[14px] font-bold text-white" style={{ fontFamily: theme.headingFont }}>{clubName}</div>
        </div>
      </div>
    )
  } else if (header === "split") {
    head = (
      <div className={compact ? "" : "flex"}>
        <div className={compact ? "" : "w-[45%] shrink-0"}>{showPhoto ? photo(compact ? 90 : 110) : <div style={{ height: compact ? 70 : 110, background: `linear-gradient(135deg, ${accent}, ${accent}55)` }} />}</div>
        <div className="flex flex-1 flex-col justify-center gap-1.5 p-3">
          <div className="flex items-center gap-2">{crest(compact ? 30 : 36)}<div className="truncate text-[13px] font-bold" style={headingStyle}>{clubName}</div></div>
          <div className="w-fit px-2.5 py-1 text-[10px] font-bold text-white" style={{ background: accent, borderRadius: radius }}>Register</div>
        </div>
      </div>
    )
  } else if (header === "crest") {
    head = (
      <div className="flex flex-col items-center gap-1.5 px-3 py-5 text-center" style={{ background: `linear-gradient(160deg, ${accent}1f, transparent)` }}>
        {crest(compact ? 46 : 54)}
        <div className="truncate text-[14px] font-bold" style={headingStyle}>{clubName}</div>
      </div>
    )
  } else if (header === "plain") {
    head = (
      <div className="flex items-center gap-2 px-3 py-3" style={{ borderBottom: `3px solid ${accent}` }}>
        {crest(compact ? 30 : 34)}
        <div className="truncate text-[13px] font-bold" style={headingStyle}>{clubName}</div>
      </div>
    )
  } else {
    head = (
      <>
        {showPhoto ? photo(compact ? 66 : 80) : <div style={{ height: compact ? 54 : 66, background: `linear-gradient(120deg, ${accent}, ${accent}55)` }} />}
        <div className="-mt-5 flex items-end gap-2 px-3 pb-2">
          {crest(compact ? 38 : 44)}
          <div className="truncate pb-0.5 text-[13px] font-bold" style={headingStyle}>{clubName}</div>
        </div>
      </>
    )
  }

  const card = (title: string, children: React.ReactNode) => (
    <div style={{ background: filled ? `linear-gradient(160deg, ${accent}14, ${theme.panel} 55%)` : theme.panel, border: `1px solid ${theme.border}`, borderRadius: radius, padding: 10 }}>
      <div className="mb-1.5 text-[11.5px] font-semibold" style={{ ...headingStyle, color: tinted ? accent : theme.ink }}>{title}</div>
      {children}
    </div>
  )
  const bar = (w: string) => <div className="h-1.5 rounded-full" style={{ width: w, background: theme.inkMuted, opacity: 0.3 }} />

  return (
    <div className="overflow-hidden shadow-lg" style={{ background: theme.bg, borderRadius: Math.max(radius, 8), border: `1px solid ${theme.border}`, fontFamily: theme.bodyFont }}>
      {head}
      <div className={compact ? "flex flex-col" : "flex"} style={{ gap, padding: gap }}>
        <div className="min-w-0 flex-1" style={{ display: "flex", flexDirection: "column", gap }}>
          {card("About", <div className="space-y-1">{bar("100%")}{bar("86%")}{bar("60%")}</div>)}
          {card("Teams by age", (
            <div className="space-y-1">
              {[["Grade 9", "Tryouts open", true], ["Grade 10", "Season underway", false]].map(([b, s, hot]) => (
                <div key={b as string} className="flex items-center gap-1.5" style={{ background: theme.bg, border: `1px solid ${theme.border}`, borderRadius: Math.max(radius - 4, 2), padding: "5px 7px" }}>
                  <span className="text-[10px] font-semibold" style={{ color: theme.ink }}>{b}</span>
                  <span className="ml-auto px-1.5 py-px text-[8.5px] font-bold" style={{ borderRadius: 999, background: hot ? accent : `${accent}22`, color: hot ? "#fff" : accent }}>{s}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className={compact ? "" : "w-[38%] shrink-0"} style={{ display: "flex", flexDirection: "column", gap }}>
          {card("Next game", <div className="text-[10px]" style={{ color: theme.inkMuted }}>Sat 2:00pm vs Kings</div>)}
          {card("Contact", <div className="space-y-1">{bar("80%")}{bar("55%")}</div>)}
        </div>
      </div>
    </div>
  )
}

export function LookEditor({
  clubId,
  clubName,
  hasBanner,
  initial,
}: {
  clubId: string
  clubName: string
  hasBanner: boolean
  initial: LookValue
}) {
  const [v, setV] = useState<LookValue>(initial)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [device, setDevice] = useState<"desktop" | "phone">("desktop")

  const theme = THEMES.find((t) => t.key === v.theme) ?? THEMES[0]
  const accentDef = ACCENTS.find((a) => a.key === v.accentKey) ?? ACCENTS[0]
  const accent = accentFor(theme, accentDef)
  const radius = (SHAPES.find((s) => s.key === v.shape) ?? SHAPES[1]).radius
  const gap = (DENSITIES.find((d) => d.key === v.density) ?? DENSITIES[1]).gap
  const header = v.headerStyle ?? "banner"
  const intensity = v.intensity ?? "balanced"
  const focal = `${v.bannerFocalX ?? 50}% ${v.bannerFocalY ?? 50}%`
  const dirty = useMemo(() => JSON.stringify(v) !== JSON.stringify(initial), [v, initial])

  function set<K extends keyof LookValue>(k: K, val: LookValue[K]) {
    setV((s) => ({ ...s, [k]: val }))
    setSaved(false)
    setError(null)
  }

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/clubs/${clubId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(v),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j?.error || `Could not save (${res.status})`)
      }
      setSaved(true)
    } catch (e: any) {
      setError(e?.message || "Could not save. Try again.")
    } finally {
      setSaving(false)
    }
  }

  function setFocal(e: React.MouseEvent<HTMLButtonElement>) {
    const r = e.currentTarget.getBoundingClientRect()
    setV((s) => ({
      ...s,
      bannerFocalX: Math.round(((e.clientX - r.left) / r.width) * 100),
      bannerFocalY: Math.round(((e.clientY - r.top) / r.height) * 100),
    }))
    setSaved(false)
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
      {/* ------------------------------------------------------------ controls */}
      <div className="space-y-6">
        <div>
          <h3 className="text-ink-900 text-sm font-semibold">Theme</h3>
          <p className="text-ink-500 mt-0.5 text-[12.5px]">Pick a look. Colours, type and contrast are handled for you.</p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {THEMES.map((t) => {
              const on = t.key === (v.theme ?? THEMES[0].key)
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => set("theme", t.key)}
                  aria-pressed={on}
                  className={`cursor-pointer overflow-hidden rounded-xl border text-left transition-colors duration-200 ${on ? "border-ink-900" : "border-ink-200 hover:border-ink-400"}`}
                >
                  <div className="flex h-10 items-end gap-1 p-1.5" style={{ background: t.bg }}>
                    <span className="h-5 flex-1 rounded" style={{ background: t.panel }} />
                    <span className="h-3.5 w-3.5 rounded-full" style={{ background: accentFor(t, accentDef) }} />
                  </div>
                  <div className="px-2 py-1.5">
                    <div className="text-ink-900 text-[12px] font-semibold">{t.label}</div>
                    <div className="text-ink-500 text-[10.5px] leading-snug">{t.blurb}</div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <h3 className="text-ink-900 text-sm font-semibold">Your club colour</h3>
          <p className="text-ink-500 mt-0.5 text-[12.5px]">One colour, yours. Every option stays readable on every theme.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {ACCENTS.map((a) => {
              const on = a.key === (v.accentKey ?? ACCENTS[0].key)
              return (
                <button
                  key={a.key}
                  type="button"
                  onClick={() => set("accentKey", a.key)}
                  aria-label={a.label}
                  aria-pressed={on}
                  title={a.label}
                  className="flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center rounded-lg transition-colors duration-200 hover:bg-ink-50"
                >
                  <span
                    className="block h-6 w-6 rounded-full"
                    style={{ background: accentFor(theme, a), boxShadow: on ? `0 0 0 2px #fff, 0 0 0 4px ${accentFor(theme, a)}` : "inset 0 0 0 1px rgba(0,0,0,0.1)" }}
                  />
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <h3 className="text-ink-900 text-sm font-semibold">Header</h3>
          <p className="text-ink-500 mt-0.5 text-[12.5px]">Two of these need no photo at all.</p>
          <div className="mt-3">
            <Choices label="" value={header} onChange={(x) => set("headerStyle", x)} options={HEADER_STYLES} accent={accent} />
          </div>
        </div>

        {hasBanner && ["banner", "split", "immersive"].includes(header) ? (
          <div>
            <h3 className="text-ink-900 text-sm font-semibold">What matters in your photo</h3>
            <p className="text-ink-500 mt-0.5 text-[12.5px]">Click the important part. Nothing gets stretched, and the crop follows that point on every screen.</p>
            <button
              type="button"
              onClick={setFocal}
              aria-label="Set the important part of your photo"
              className="border-ink-200 relative mt-3 block w-full max-w-sm cursor-crosshair overflow-hidden rounded-xl border"
              style={{ aspectRatio: "16 / 9" }}
            >
              <span className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${accent}, ${accent}22 60%, #0b1729)` }} />
              <span className="absolute inset-0 grid place-items-center text-[11px] font-medium text-white/60">your banner</span>
              <span
                className="pointer-events-none absolute h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white"
                style={{ left: `${v.bannerFocalX ?? 50}%`, top: `${v.bannerFocalY ?? 50}%`, boxShadow: `0 0 0 3px ${accent}` }}
              />
            </button>
            <p className="text-ink-400 mt-2 flex items-start gap-1.5 text-[11.5px]">
              <Icon.target className="mt-0.5 h-3 w-3 shrink-0" />
              Any photo, any shape. We never ask for a size.
            </p>
          </div>
        ) : null}

        <div>
          <h3 className="text-ink-900 text-sm font-semibold">Feel</h3>
          <p className="text-ink-500 mt-0.5 text-[12.5px]">Same theme, different club.</p>
          <div className="mt-3 space-y-3">
            <Choices label="Colour" value={intensity} onChange={(x) => set("intensity", x)} options={INTENSITIES} accent={accent} />
            <Choices label="Corners" value={v.shape ?? "soft"} onChange={(x) => set("shape", x)} options={SHAPES} accent={accent} />
            <Choices label="Spacing" value={v.density ?? "normal"} onChange={(x) => set("density", x)} options={DENSITIES} accent={accent} />
          </div>
        </div>

        <div className="border-ink-100 flex flex-wrap items-center gap-3 border-t pt-4">
          <button
            type="button"
            onClick={save}
            disabled={!dirty || saving}
            className="min-h-[44px] cursor-pointer rounded-xl px-5 text-sm font-bold text-white transition-opacity duration-200 disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: accent }}
          >
            {saving ? "Saving..." : dirty ? "Save look" : "Saved"}
          </button>
          {saved && !dirty ? <span className="text-[12.5px] font-medium text-emerald-700">Saved. Your page is live.</span> : null}
          {error ? <span className="text-[12.5px] font-medium text-red-700">{error}</span> : null}
          <button
            type="button"
            onClick={() => { setV(initial); setSaved(false); setError(null) }}
            disabled={!dirty || saving}
            className="text-ink-500 hover:text-ink-800 min-h-[44px] cursor-pointer text-[12.5px] font-medium underline disabled:cursor-not-allowed disabled:opacity-40"
          >
            Undo changes
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- preview */}
      <div className="lg:sticky lg:top-6 lg:self-start">
        <div className="mb-2 flex items-center gap-2">
          <span className="text-ink-500 text-[11.5px] font-medium">This is what families see</span>
          <div className="border-ink-200 ml-auto flex overflow-hidden rounded-lg border" role="group" aria-label="Preview size">
            {([["desktop", Icon.desktop, "Desktop"], ["phone", Icon.phone, "Phone"]] as const).map(([k, I, lbl]) => (
              <button
                key={k}
                type="button"
                onClick={() => setDevice(k)}
                aria-pressed={device === k}
                aria-label={lbl}
                className={`flex min-h-[38px] cursor-pointer items-center px-2.5 transition-colors duration-200 ${device === k ? "bg-ink-900 text-white" : "text-ink-500 hover:bg-ink-50"}`}
              >
                <I className="h-4 w-4" />
              </button>
            ))}
          </div>
        </div>
        <div className={device === "phone" ? "mx-auto max-w-[300px]" : ""}>
          <Preview
            theme={theme}
            accent={accent}
            radius={radius}
            gap={gap}
            header={header}
            intensity={intensity}
            focal={focal}
            compact={device === "phone"}
            clubName={clubName}
            hasBanner={hasBanner}
          />
        </div>
      </div>
    </div>
  )
}
