"use client"

import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  useSortable,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { BLOCK_DEFS, type BlockConfig, type Zone } from "@/lib/club-page/blocks"

const DEF = Object.fromEntries(BLOCK_DEFS.map((b) => [b.key, b]))

/**
 * Two-zone block editor: drag to reorder within a zone; use the arrow to move a
 * block between Main and Rail; toggle visibility + pin-to-top-on-mobile. Emits a
 * normalized BlockConfig[] (orders renumbered per zone).
 */
export function LayoutEditor({
  value,
  onChange,
}: {
  value: BlockConfig[]
  onChange: (next: BlockConfig[]) => void
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const zoneKeys = (zone: Zone) =>
    value
      .filter((b) => b.zone === zone)
      .sort((a, b) => a.order - b.order)
      .map((b) => b.key)

  function normalize(blocks: BlockConfig[]): BlockConfig[] {
    const out: BlockConfig[] = []
    for (const zone of ["main", "rail"] as Zone[]) {
      blocks
        .filter((b) => b.zone === zone)
        .sort((a, b) => a.order - b.order)
        .forEach((b, i) => out.push({ ...b, order: i + 1 }))
    }
    return out
  }

  function handleDragEnd(zone: Zone, e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const keys = zoneKeys(zone)
    const from = keys.indexOf(String(active.id))
    const to = keys.indexOf(String(over.id))
    if (from === -1 || to === -1) return
    const reordered = arrayMove(keys, from, to)
    const next = value.map((b) =>
      b.zone === zone ? { ...b, order: reordered.indexOf(b.key) + 1 } : b
    )
    onChange(normalize(next))
  }

  function moveZone(key: string) {
    const next = value.map((b) => {
      if (b.key !== key) return b
      const target: Zone = b.zone === "main" ? "rail" : "main"
      const maxOrder = Math.max(0, ...value.filter((x) => x.zone === target).map((x) => x.order))
      return { ...b, zone: target, order: maxOrder + 1 }
    })
    onChange(normalize(next))
  }

  // Touch-friendly reorder for phones (drag fights scrolling there); the
  // ▲▼ buttons are hidden on sm+ where the drag handle takes over
  function moveWithinZone(zone: Zone, key: string, dir: -1 | 1) {
    const keys = zoneKeys(zone)
    const from = keys.indexOf(key)
    const to = from + dir
    if (from === -1 || to < 0 || to >= keys.length) return
    const reordered = arrayMove(keys, from, to)
    const next = value.map((b) =>
      b.zone === zone ? { ...b, order: reordered.indexOf(b.key) + 1 } : b
    )
    onChange(normalize(next))
  }

  function patch(key: string, fields: Partial<BlockConfig>) {
    onChange(value.map((b) => (b.key === key ? { ...b, ...fields } : b)))
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {(["main", "rail"] as Zone[]).map((zone) => {
        const keys = zoneKeys(zone)
        return (
          <div key={zone} className="border-ink-100 bg-ink-50/50 rounded-2xl border p-3">
            <div className="text-ink-500 mb-2 px-1 text-xs font-semibold uppercase tracking-wide">
              {zone === "main" ? "Main column (wide)" : "Right rail (compact)"}
            </div>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={(e) => handleDragEnd(zone, e)}
            >
              <SortableContext items={keys} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {keys.map((key, index) => {
                    const block = value.find((b) => b.key === key)!
                    return (
                      <BlockRow
                        key={key}
                        block={block}
                        zone={zone}
                        isFirst={index === 0}
                        isLast={index === keys.length - 1}
                        onMoveUp={() => moveWithinZone(zone, key, -1)}
                        onMoveDown={() => moveWithinZone(zone, key, 1)}
                        onMoveZone={() => moveZone(key)}
                        onToggleVisible={() => patch(key, { visible: !block.visible })}
                        onTogglePin={() => patch(key, { pinMobile: !block.pinMobile })}
                      />
                    )
                  })}
                </div>
              </SortableContext>
            </DndContext>
          </div>
        )
      })}
    </div>
  )
}

function BlockRow({
  block,
  zone,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onMoveZone,
  onToggleVisible,
  onTogglePin,
}: {
  block: BlockConfig
  zone: Zone
  isFirst: boolean
  isLast: boolean
  onMoveUp: () => void
  onMoveDown: () => void
  onMoveZone: () => void
  onToggleVisible: () => void
  onTogglePin: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.key,
  })
  const def = DEF[block.key]
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`border-ink-100 rounded-xl border bg-white p-2.5 ${isDragging ? "opacity-60 shadow-lg" : ""} ${
        block.visible ? "" : "opacity-60"
      }`}
    >
      <div className="flex items-center gap-2">
        {/* Drag is a desktop affordance — on phones it fights scrolling, so
            the ▲▼ buttons below take over (Shape 3, phone-sized 20%) */}
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder"
          className="text-ink-400 hover:text-ink-700 hidden flex-shrink-0 cursor-grab px-1 active:cursor-grabbing sm:block"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="9" cy="6" r="1.5" /><circle cx="15" cy="6" r="1.5" />
            <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
            <circle cx="9" cy="18" r="1.5" /><circle cx="15" cy="18" r="1.5" />
          </svg>
        </button>
        <div className="flex flex-shrink-0 flex-col gap-0.5 sm:hidden">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={isFirst}
            aria-label="Move up"
            className="border-ink-200 text-ink-500 rounded-md border px-1.5 py-0.5 text-xs leading-none disabled:opacity-30"
          >
            ▲
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={isLast}
            aria-label="Move down"
            className="border-ink-200 text-ink-500 rounded-md border px-1.5 py-0.5 text-xs leading-none disabled:opacity-30"
          >
            ▼
          </button>
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-ink-900 text-sm font-medium">{def?.label ?? block.key}</div>
          {def?.hint && <div className="text-ink-400 truncate text-xs">{def.hint}</div>}
        </div>
        <button
          type="button"
          onClick={onMoveZone}
          title={`Move to ${zone === "main" ? "rail" : "main"}`}
          className="border-ink-200 text-ink-500 hover:bg-ink-50 flex-shrink-0 cursor-pointer rounded-lg border px-2 py-1 text-xs font-medium transition"
        >
          {zone === "main" ? "→ Rail" : "→ Main"}
        </button>
      </div>
      <div className="text-ink-500 mt-2 flex flex-wrap items-center gap-3 pl-6 text-xs">
        <label className="flex cursor-pointer items-center gap-1.5">
          <input type="checkbox" checked={block.visible} onChange={onToggleVisible} className="cursor-pointer" />
          Visible
        </label>
        {zone === "rail" && (
          <label className="flex cursor-pointer items-center gap-1.5">
            <input type="checkbox" checked={block.pinMobile} onChange={onTogglePin} className="cursor-pointer" />
            Pin to top on mobile
          </label>
        )}
      </div>
    </div>
  )
}
