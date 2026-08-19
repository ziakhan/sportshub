"use client"

/**
 * Live page editor (owner 2026-08-18).
 *
 * The owner's correction, twice: "I want the drag-and-drop type of configuration"
 * and then "I want the actual editable module to look like a real website."
 *
 * So this is NOT controls beside a thumbnail. It renders the REAL public page,
 * full width, using the same `ClubBlock` components the public route uses and the
 * same theme variables, and you drag the actual sections around on the actual
 * page. What you are looking at IS the site.
 *
 * That is possible because ClubBlock is pure presentational: no "use client", no
 * prisma, no async. The server component fetches once and hands the data down.
 *
 * The toolbar floats and collapses so it never becomes the thing you are editing
 * around. Drag has a keyboard equivalent on every handle, since pointer-only
 * reordering is unusable for anyone who cannot use a mouse.
 */

import { useMemo, useState } from "react"
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  useSortable,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { ClubBlock, type ClubPageData } from "@/app/(public)/club/[slug]/club-blocks"
import { BLOCK_DEFS, BLOCK_LABELS, type BlockConfig, type Zone } from "@/lib/club-page/blocks"
import {
  THEMES,
  ACCENTS,
  HEADER_STYLES,
  INTENSITIES,
  SHAPES,
  DENSITIES,
  accentFor,
  resolveTheme,
  themeStyle,
} from "@/lib/club-page/theme"
import type { LookValue } from "../look-editor"

const Icon = {
  grip: (p: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={p.className} aria-hidden="true">
      <circle cx="9" cy="6" r="1.6" /><circle cx="15" cy="6" r="1.6" />
      <circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="12" r="1.6" />
      <circle cx="9" cy="18" r="1.6" /><circle cx="15" cy="18" r="1.6" />
    </svg>
  ),
  eye: (p: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className={p.className} aria-hidden="true">
      <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z" strokeLinecap="round" />
      <circle cx="12" cy="12" r="2.6" />
    </svg>
  ),
  eyeOff: (p: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className={p.className} aria-hidden="true">
      <path d="M4 4l16 16" strokeLinecap="round" />
      <path d="M9.9 5.8A9.9 9.9 0 0 1 12 5.5c6.4 0 10 6.5 10 6.5a17 17 0 0 1-3.3 4M6.6 7.9A16.6 16.6 0 0 0 2 12s3.6 6.5 10 6.5a10 10 0 0 0 3.6-.65" strokeLinecap="round" />
    </svg>
  ),
  swap: (p: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className={p.className} aria-hidden="true">
      <path d="M4 8h13l-3-3M20 16H7l3 3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  brush: (p: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={p.className} aria-hidden="true">
      <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z" strokeLinejoin="round" />
    </svg>
  ),
  chevron: (p: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={p.className} aria-hidden="true">
      <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
}

/** A real block, wrapped in exactly enough chrome to grab and move it. */
function EditableBlock({
  cfg,
  data,
  zone,
  onToggle,
  onMoveZone,
  canSwapZone,
}: {
  cfg: BlockConfig
  data: ClubPageData
  zone: Zone
  onToggle: () => void
  onMoveZone: () => void
  canSwapZone: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: cfg.key })
  const label = BLOCK_LABELS[cfg.key] ?? cfg.key

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`group relative ${isDragging ? "z-50 opacity-60" : ""}`}
    >
      {/* Hover rail. Sits outside the block on desktop so it never covers content. */}
      <div className="pointer-events-none absolute -left-1 -right-1 -top-2 bottom-0 rounded-2xl opacity-0 ring-2 ring-sky-400/70 transition-opacity duration-200 group-hover:opacity-100" />

      <div className="absolute -top-3 left-2 z-20 flex items-center gap-1 opacity-0 transition-opacity duration-200 focus-within:opacity-100 group-hover:opacity-100">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Drag ${label} to reorder. Or press space, then arrow keys.`}
          className="flex h-8 cursor-grab items-center gap-1 rounded-lg bg-sky-600 px-2 text-[11px] font-bold text-white shadow-lg active:cursor-grabbing"
        >
          <Icon.grip className="h-3.5 w-3.5" />
          {label}
        </button>
        {canSwapZone && (
          <button
            type="button"
            onClick={onMoveZone}
            aria-label={`Move ${label} to the ${zone === "main" ? "side" : "main"} column`}
            title={`Move to the ${zone === "main" ? "side" : "main"} column`}
            className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg bg-white text-slate-700 shadow-lg transition-colors duration-200 hover:bg-slate-100"
          >
            <Icon.swap className="h-4 w-4" />
          </button>
        )}
        <button
          type="button"
          onClick={onToggle}
          aria-label={`Hide ${label} from the public page`}
          title="Hide this section"
          className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg bg-white text-slate-700 shadow-lg transition-colors duration-200 hover:bg-slate-100"
        >
          <Icon.eye className="h-4 w-4" />
        </button>
      </div>

      <ClubBlock blockKey={cfg.key} variant={zone === "rail" ? "rail" : "main"} data={data} />
    </div>
  )
}

export function LiveEditor({
  clubId,
  slug,
  clubName,
  data,
  initialLayout,
  initialLook,
}: {
  clubId: string
  slug: string
  clubName: string
  data: ClubPageData
  initialLayout: BlockConfig[]
  initialLook: LookValue
}) {
  const [cfg, setCfg] = useState<BlockConfig[]>(initialLayout)
  const [look, setLook] = useState<LookValue>(initialLook)
  const [openPanel, setOpenPanel] = useState(false)
  const [dragging, setDragging] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const resolved = useMemo(() => resolveTheme(look as any), [look])
  const custom = !look.accentKey && !!look.primaryColor
  const accent = resolved.accentHex
  const theme = resolved.theme

  const zoneOf = (z: Zone) => cfg.filter((b) => b.zone === z && b.visible).sort((a, b) => a.order - b.order)
  const hidden = cfg.filter((b) => !b.visible)

  const dirty = useMemo(
    () => JSON.stringify(cfg) !== JSON.stringify(initialLayout) || JSON.stringify(look) !== JSON.stringify(initialLook),
    [cfg, look, initialLayout, initialLook]
  )

  function onDragEnd(e: DragEndEvent) {
    setDragging(null)
    const { active, over } = e
    if (!over || active.id === over.id) return
    setCfg((list) => {
      const a = list.find((x) => x.key === active.id)
      const b = list.find((x) => x.key === over.id)
      if (!a || !b || a.zone !== b.zone) return list
      const peers = list.filter((x) => x.zone === a.zone && x.visible).sort((x, y) => x.order - y.order)
      const without = peers.filter((x) => x.key !== a.key)
      const at = without.findIndex((x) => x.key === b.key)
      without.splice(at < 0 ? without.length : at, 0, a)
      const orders = new Map(without.map((x, i) => [x.key, i + 1]))
      return list.map((x) => (orders.has(x.key) ? { ...x, order: orders.get(x.key)! } : x))
    })
  }

  function toggle(key: string) {
    setCfg((l) => l.map((x) => (x.key === key ? { ...x, visible: !x.visible } : x)))
    setSaved(false)
  }

  function swapZone(key: string) {
    setCfg((l) => {
      const me = l.find((x) => x.key === key)
      if (!me) return l
      const def = BLOCK_DEFS.find((d) => d.key === key)
      const target: Zone = me.zone === "main" ? "rail" : "main"
      if (def && !def.zones.includes(target)) return l
      const last = Math.max(0, ...l.filter((x) => x.zone === target).map((x) => x.order))
      return l.map((x) => (x.key === key ? { ...x, zone: target, order: last + 1 } : x))
    })
    setSaved(false)
  }

  function setLookField<K extends keyof LookValue>(k: K, v: LookValue[K]) {
    setLook((s) => ({ ...s, [k]: v }))
    setSaved(false)
  }

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/clubs/${clubId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...look, pageLayout: cfg }),
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

  const chip = (on: boolean) =>
    `min-h-[34px] cursor-pointer rounded-lg px-2.5 text-[12px] font-medium transition-colors duration-200 ${
      on ? "text-white" : "bg-white/[0.14] text-white hover:bg-white/25"
    }`

  return (
    <div className="min-h-screen" style={{ background: theme.bg }}>
      {/* ------------------------------------------------------------ toolbar */}
      <div className="sticky top-0 z-40 border-b border-white/10 bg-slate-900/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-2 px-4 py-2.5">
          <span className="text-[13px] font-semibold text-white">{clubName}</span>
          <span className="hidden text-[11.5px] text-white/45 sm:inline">
            Hover a section to drag it. This is your real page.
          </span>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setOpenPanel((o) => !o)}
              aria-expanded={openPanel}
              className="flex min-h-[38px] cursor-pointer items-center gap-1.5 rounded-lg bg-white/10 px-3 text-[12.5px] font-semibold text-white transition-colors duration-200 hover:bg-white/20"
            >
              <Icon.brush className="h-4 w-4" />
              Look
              <Icon.chevron className={`h-3.5 w-3.5 transition-transform duration-200 ${openPanel ? "rotate-180" : ""}`} />
            </button>
            <a
              href={`/club/${slug}`}
              target="_blank"
              rel="noreferrer"
              className="hidden min-h-[38px] cursor-pointer items-center rounded-lg px-3 text-[12.5px] font-medium text-white/70 transition-colors duration-200 hover:bg-white/10 sm:flex"
            >
              View live
            </a>
            <button
              type="button"
              onClick={save}
              disabled={!dirty || saving}
              className="min-h-[38px] cursor-pointer rounded-lg px-4 text-[12.5px] font-bold text-white transition-opacity duration-200 disabled:cursor-not-allowed disabled:opacity-40"
              style={{ background: dirty ? accent : "rgba(255,255,255,0.15)" }}
            >
              {saving ? "Saving..." : dirty ? "Save" : saved ? "Saved" : "Saved"}
            </button>
          </div>

          {error ? <span className="w-full text-[12px] font-medium text-red-300">{error}</span> : null}
        </div>

        {/* Look drawer. Collapsed by default so the page stays the subject. */}
        {openPanel && (
          <div className="border-t border-white/10 bg-slate-900/95">
            <div className="mx-auto flex max-w-[1400px] flex-col gap-3 px-4 py-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="w-16 text-[11px] font-semibold uppercase tracking-wider text-white/40">Theme</span>
                {THEMES.map((t) => {
                  const on = (look.theme ?? THEMES[0].key) === t.key
                  return (
                    <button key={t.key} type="button" onClick={() => setLookField("theme", t.key)}
                      aria-pressed={on} title={t.blurb}
                      className={`flex items-center gap-1.5 ${chip(on)}`}
                      style={on ? { background: accent } : undefined}>
                      {/* the ground itself, so the name is not doing all the work */}
                      <span className="h-3.5 w-3.5 rounded-full ring-1 ring-white/30" style={{ background: t.bg }} />
                      {t.label}
                    </button>
                  )
                })}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="w-16 text-[11px] font-semibold uppercase tracking-wider text-white/40">Colour</span>
                {ACCENTS.map((a) => {
                  const on = !custom && (look.accentKey ?? ACCENTS[0].key) === a.key
                  return (
                    <button key={a.key} type="button"
                      onClick={() => { setLookField("accentKey", a.key); setLookField("primaryColor", null) }}
                      aria-label={a.label} aria-pressed={on} title={a.label}
                      className="grid h-9 w-9 cursor-pointer place-items-center rounded-lg transition-colors duration-200 hover:bg-white/10">
                      <span className="block h-5 w-5 rounded-full"
                        style={{ background: accentFor(theme, a), boxShadow: on ? `0 0 0 2px #0f172a, 0 0 0 4px ${accentFor(theme, a)}` : "none" }} />
                    </button>
                  )
                })}
                {/* Bring your own. Any hex is safe: brand.ts darkens the derived
                    ink until it clears 4.5:1 and flips text on a fill between
                    white and near-black, so no custom colour can be unreadable. */}
                <label
                  className={`ml-1 flex min-h-[36px] cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-[12px] font-medium transition-colors duration-200 ${
                    custom ? "text-white" : "bg-white/[0.14] text-white hover:bg-white/25"
                  }`}
                  style={custom ? { background: accent } : undefined}
                  title="Use your club's exact colour"
                >
                  <span className="h-3.5 w-3.5 rounded-full ring-1 ring-white/40"
                    style={{ background: look.primaryColor || "#888" }} />
                  Exact colour
                  <input
                    type="color"
                    value={look.primaryColor || accent}
                    onChange={(e) => { setLookField("primaryColor", e.target.value); setLookField("accentKey", null) }}
                    className="h-0 w-0 opacity-0"
                    aria-label="Pick your club's exact colour"
                  />
                </label>
                {custom && (
                  <button type="button"
                    onClick={() => { setLookField("primaryColor", null); setLookField("accentKey", ACCENTS[0].key) }}
                    className="min-h-[36px] cursor-pointer px-2 text-[11.5px] font-medium text-white/60 underline transition-colors duration-200 hover:text-white">
                    Back to the set
                  </button>
                )}
              </div>
              {[
                { label: "Header", key: "headerStyle" as const, opts: HEADER_STYLES, dflt: "banner" },
                { label: "Colour use", key: "intensity" as const, opts: INTENSITIES, dflt: "balanced" },
                { label: "Corners", key: "shape" as const, opts: SHAPES, dflt: "soft" },
                { label: "Spacing", key: "density" as const, opts: DENSITIES, dflt: "normal" },
              ].map((row) => (
                <div key={row.label} className="flex flex-wrap items-center gap-1.5">
                  <span className="w-16 text-[11px] font-semibold uppercase tracking-wider text-white/40">{row.label}</span>
                  {row.opts.map((o: any) => {
                    const on = (look[row.key] ?? row.dflt) === o.key
                    return (
                      <button key={o.key} type="button" onClick={() => setLookField(row.key, o.key)}
                        aria-pressed={on} className={chip(on)} style={on ? { background: accent } : undefined}>
                        {o.label}
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* -------------------------------------------------------- the real page */}
      <div style={themeStyle(resolved)}>
        <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={(e: DragStartEvent) => setDragging(String(e.active.id))}
            onDragEnd={onDragEnd}
            onDragCancel={() => setDragging(null)}
          >
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-3 lg:gap-10">
              <div className="lg:col-span-2">
                <SortableContext items={zoneOf("main").map((b) => b.key)} strategy={verticalListSortingStrategy}>
                  <div className="flex flex-col gap-10">
                    {zoneOf("main").map((b) => (
                      <EditableBlock
                        key={b.key} cfg={b} data={data} zone="main"
                        onToggle={() => toggle(b.key)} onMoveZone={() => swapZone(b.key)}
                        canSwapZone={!!BLOCK_DEFS.find((d) => d.key === b.key)?.zones.includes("rail")}
                      />
                    ))}
                  </div>
                </SortableContext>
              </div>
              <div>
                <SortableContext items={zoneOf("rail").map((b) => b.key)} strategy={verticalListSortingStrategy}>
                  <div className="flex flex-col gap-6">
                    {zoneOf("rail").map((b) => (
                      <EditableBlock
                        key={b.key} cfg={b} data={data} zone="rail"
                        onToggle={() => toggle(b.key)} onMoveZone={() => swapZone(b.key)}
                        canSwapZone={!!BLOCK_DEFS.find((d) => d.key === b.key)?.zones.includes("main")}
                      />
                    ))}
                  </div>
                </SortableContext>
              </div>
            </div>
            <DragOverlay>
              {dragging ? (
                <div className="rounded-lg bg-sky-600 px-3 py-2 text-[12px] font-bold text-white shadow-2xl">
                  {BLOCK_LABELS[dragging] ?? dragging}
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
      </div>

      {/* ----------------------------------------------------- hidden sections */}
      {hidden.length > 0 && (
        <div className="border-t border-white/10 bg-slate-900/95">
          <div className="mx-auto max-w-[1400px] px-4 py-4 sm:px-6">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/40">
              Hidden from your page
            </div>
            <div className="flex flex-wrap gap-2">
              {hidden.map((b) => (
                <button
                  key={b.key}
                  type="button"
                  onClick={() => toggle(b.key)}
                  className="flex min-h-[38px] cursor-pointer items-center gap-1.5 rounded-lg bg-white/10 px-3 text-[12.5px] font-medium text-white/75 transition-colors duration-200 hover:bg-white/20"
                >
                  <Icon.eyeOff className="h-4 w-4" />
                  {BLOCK_LABELS[b.key] ?? b.key}
                  <span className="text-white/40">Add</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
