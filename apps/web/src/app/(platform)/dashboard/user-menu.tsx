"use client"

import { useState, useRef, useEffect } from "react"
import { signOut } from "next-auth/react"
import Link from "next/link"

interface UserMenuProps {
  userName: string
  userEmail: string
  userInitials: string
}

export function UserMenu({ userName, userEmail, userInitials }: UserMenuProps) {
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
        className="border-ink-200 hover:bg-ink-50 flex items-center gap-2 rounded-2xl border bg-white py-1 pl-1 pr-3 text-sm transition"
        aria-label="Open user menu"
      >
        <div className="bg-hoop-500 flex h-8 w-8 items-center justify-center rounded-xl text-xs font-semibold text-white">
          {userInitials}
        </div>
        <span className="text-ink-800 hidden font-medium md:inline">{userName}</span>
        <svg
          className={`text-ink-400 h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="border-ink-100 shadow-panel absolute right-0 z-50 mt-3 w-64 overflow-hidden rounded-3xl border bg-white py-1">
          <div className="border-ink-100 border-b px-4 py-4">
            <p className="text-ink-950 text-sm font-medium">{userName}</p>
            <p className="text-ink-500 text-xs">{userEmail}</p>
          </div>

          <div className="py-1">
            <Link
              href="/settings/profile"
              onClick={() => setOpen(false)}
              className="text-ink-700 hover:bg-ink-50 flex items-center gap-2 px-4 py-2.5 text-sm transition"
            >
              <svg
                className="text-ink-400 h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
              Profile Settings
            </Link>
          </div>

          <div className="border-ink-100 border-t py-1">
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-red-600 transition hover:bg-red-50"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
