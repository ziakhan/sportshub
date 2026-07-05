"use client"

import { useState, useRef, useEffect } from "react"
import Link from "next/link"

// The four self-serve actions, available to ANY authenticated user at any time
// — regardless of how they joined (signup or invitation) or what roles they
// already hold. Each action grants its role as a side-effect on completion;
// users never pick a role from a list.
const CREATE_ACTIONS = [
  {
    href: "/players/add",
    title: "Add a child",
    description: "Register a player you manage",
  },
  {
    href: "/clubs/create",
    title: "Create a club",
    description: "Run teams, tryouts, and offers",
  },
  {
    href: "/manage/leagues/create",
    title: "Create a league",
    description: "Organize divisions and schedules",
  },
  {
    href: "/referee/profile",
    title: "Become a referee",
    description: "Set availability and officiate games",
  },
]

export function CreateMenu() {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("keydown", handleEscape)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("keydown", handleEscape)
    }
  }, [])

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className="bg-play-600 hover:bg-play-700 flex items-center gap-1.5 rounded-2xl px-3 py-2 text-sm font-semibold text-white transition"
        aria-label="Create new"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
        </svg>
        <span className="hidden sm:inline">New</span>
      </button>

      {open && (
        <div className="border-ink-100 shadow-panel absolute right-0 z-50 mt-3 w-72 overflow-hidden rounded-3xl border bg-white py-1">
          <div className="border-ink-100 border-b px-4 py-3">
            <p className="text-ink-950 text-sm font-medium">Do more on the platform</p>
            <p className="text-ink-500 text-xs">Start anything — no setup required first.</p>
          </div>

          <div className="py-1">
            {CREATE_ACTIONS.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                onClick={() => setOpen(false)}
                className="hover:bg-ink-50 flex flex-col px-4 py-2.5 transition"
              >
                <span className="text-ink-800 text-sm font-medium">{action.title}</span>
                <span className="text-ink-500 text-xs">{action.description}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
