"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"

export interface NavDropdownEntry {
  id: string
  name: string
  href: string
}

interface NavDropdownProps {
  label: string
  /** Personalized section shown first (e.g. "My leagues"). */
  myLabel: string
  myEntries: NavDropdownEntry[]
  /** General section (e.g. "Active leagues"). */
  allLabel: string
  allEntries: NavDropdownEntry[]
  browseHref: string
  browseLabel: string
}

/**
 * Public-header dropdown (site-ia-plan §5.3): my stuff first, then the
 * active list, then browse-all. Personalization reorders, never hides.
 * Falls back to a plain link when there's nothing to drop down.
 */
export function NavDropdown({
  label,
  myLabel,
  myEntries,
  allLabel,
  allEntries,
  browseHref,
  browseLabel,
}: NavDropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const pathname = usePathname()

  useEffect(() => setOpen(false), [pathname])
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onClick)
    document.addEventListener("keydown", onEscape)
    return () => {
      document.removeEventListener("mousedown", onClick)
      document.removeEventListener("keydown", onEscape)
    }
  }, [])

  if (myEntries.length === 0 && allEntries.length === 0) {
    return (
      <Link
        href={browseHref}
        className="text-ink-600 hover:bg-ink-50 hover:text-ink-950 rounded-lg px-3.5 py-1.5 text-[13px] font-medium transition-colors"
      >
        {label}
      </Link>
    )
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={`text-ink-600 hover:bg-ink-50 hover:text-ink-950 inline-flex items-center gap-1 rounded-lg px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
          open ? "bg-ink-50 text-ink-950" : ""
        }`}
      >
        {label}
        <svg
          className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="border-ink-100 absolute left-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-2xl border bg-white shadow-xl"
        >
          {myEntries.length > 0 && (
            <div className="border-ink-50 border-b py-2">
              <div className="text-hoop-600 px-4 pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-[0.16em]">
                {myLabel}
              </div>
              {myEntries.map((e) => (
                <Link
                  key={e.id}
                  href={e.href}
                  className="text-ink-950 hover:bg-ink-50 block truncate px-4 py-2 text-sm font-semibold transition-colors"
                >
                  {e.name}
                </Link>
              ))}
            </div>
          )}
          {allEntries.length > 0 && (
            <div className="py-2">
              <div className="text-ink-400 px-4 pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-[0.16em]">
                {allLabel}
              </div>
              {allEntries.map((e) => (
                <Link
                  key={e.id}
                  href={e.href}
                  className="text-ink-700 hover:bg-ink-50 hover:text-ink-950 block truncate px-4 py-2 text-sm font-medium transition-colors"
                >
                  {e.name}
                </Link>
              ))}
            </div>
          )}
          <Link
            href={browseHref}
            className="border-ink-50 text-play-600 hover:bg-play-50 block border-t px-4 py-3 text-sm font-semibold transition-colors"
          >
            {browseLabel} &rarr;
          </Link>
        </div>
      )}
    </div>
  )
}
