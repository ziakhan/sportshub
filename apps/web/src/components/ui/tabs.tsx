"use client"

import { useState, type ReactNode } from "react"
import { cn } from "./cn"

export interface TabItem {
  key: string
  label: string
  /** Optional count chip, e.g. roster size. */
  count?: number
  content: ReactNode
}

interface TabsProps {
  items: TabItem[]
  initialKey?: string
  className?: string
}

/**
 * Accessible, sticky tab bar for the hub pages (Overview / Schedule / Roster /
 * Standings / Media). Server-rendered content can be passed straight into the
 * `content` field — this client wrapper only owns the active-tab state.
 */
export function Tabs({ items, initialKey, className }: TabsProps) {
  const [active, setActive] = useState(initialKey ?? items[0]?.key)
  const activeItem = items.find((i) => i.key === active) ?? items[0]

  return (
    <div className={className}>
      <div
        role="tablist"
        aria-label="Sections"
        className="border-ink-100 sticky top-[60px] z-20 -mx-1 flex gap-1 overflow-x-auto border-b bg-white/90 px-1 backdrop-blur"
      >
        {items.map((item) => {
          const selected = item.key === active
          return (
            <button
              key={item.key}
              role="tab"
              aria-selected={selected}
              onClick={() => setActive(item.key)}
              className={cn(
                "relative whitespace-nowrap px-4 py-3 text-sm font-semibold transition-colors",
                selected ? "text-play-600" : "text-ink-500 hover:text-ink-800"
              )}
            >
              {item.label}
              {typeof item.count === "number" && (
                <span
                  className={cn(
                    "ml-1.5 rounded-full px-1.5 py-0.5 text-[11px] font-bold",
                    selected ? "bg-play-50 text-play-600" : "bg-ink-100 text-ink-500"
                  )}
                >
                  {item.count}
                </span>
              )}
              {selected && (
                <span className="bg-play-600 absolute inset-x-3 -bottom-px h-0.5 rounded-full" />
              )}
            </button>
          )
        })}
      </div>
      <div role="tabpanel" className="pt-6">
        {activeItem?.content}
      </div>
    </div>
  )
}
