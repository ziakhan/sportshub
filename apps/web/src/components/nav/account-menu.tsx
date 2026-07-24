"use client"

import React from "react"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { signOut } from "next-auth/react"
import { coachTeamHref, operatorMenuLabel, type NavShape } from "@/lib/queries/nav-shape"
import { NotificationsBell } from "./notifications-bell"

/**
 * The badge menu v2 — the canonical switchboard (site-ia-plan §5.6.5):
 * EVERYTHING reachable, role-aware, 44px rows. Header icons and bottom tabs
 * are shortcuts to rows in here; nothing exists only as an icon. Shared by
 * the public and platform layouts.
 */

interface Props {
  userName: string
  userEmail: string
  userInitials: string
  /** Profile photo — falls back to the initials badge when null/unset. */
  avatarUrl?: string | null
  shape: NavShape
}

function Row({
  href,
  onClick,
  children,
  icon,
}: {
  href: string
  onClick: () => void
  children: React.ReactNode
  icon: React.ReactNode
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="text-ink-700 hover:bg-ink-50 flex min-h-[44px] items-center gap-3 px-4 text-sm transition"
    >
      <span className="text-ink-400">{icon}</span>
      {children}
    </Link>
  )
}

const ic = (d: string) => (
  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d={d} />
  </svg>
)

const ICONS = {
  home: ic("M3 10 12 3l9 7M5 10v10h14V10"),
  feed: ic("M4 11a9 9 0 0 1 9 9M4 4a16 16 0 0 1 16 16M6 19a1 1 0 1 0 0-2 1 1 0 0 0 0 2"),
  dashboard: ic("M4 4h6v8H4zM14 4h6v5h-6zM14 13h6v7h-6zM4 16h6v4H4z"),
  team: ic("M17 20a5 5 0 0 0-10 0M12 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8"),
  calendar: ic("M16 2v4M8 2v4M3 10h18M5 6h14a2 2 0 0 1 2 2v12H3V8a2 2 0 0 1 2-2z"),
  chat: ic("M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"),
  account: ic("M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8M4 21a8 8 0 0 1 16 0"),
  whistle: ic("M15 13a6 6 0 1 1-6-6h6zM15 7l6-3-2 6"),
  plus: ic("M12 5v14M5 12h14"),
}

export function AccountMenu({ userName, userEmail, userInitials, avatarUrl, shape }: Props) {
  // One panel at a time: the bell dropdown and the badge menu share this
  // state so opening one always closes the other.
  const [panel, setPanel] = useState<"account" | "bell" | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const close = () => setPanel(null)
  const open = panel === "account"

  useEffect(() => {
    if (!panel) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setPanel(null)
    }
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPanel(null)
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [panel])

  return (
    <div className="relative flex items-center gap-1.5" ref={ref}>
      {/* Bell beside the badge on EVERY platform (owner 2026-07-16):
          notifications are one tap; the unread dot lives on the bell.
          Since 2026-07-21 it opens a dropdown inbox, not the page. */}
      <NotificationsBell
        open={panel === "bell"}
        onToggle={() => setPanel((p) => (p === "bell" ? null : "bell"))}
        onClose={close}
      />
      <button
        onClick={() => setPanel((p) => (p === "account" ? null : "account"))}
        aria-label="Open account menu"
        aria-expanded={open}
        className="bg-play-600 hover:bg-play-700 relative flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold text-white transition"
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="h-9 w-9 rounded-full object-cover" />
        ) : (
          userInitials
        )}
      </button>

      {open && (
        <div className="border-ink-100 absolute right-0 top-11 z-50 w-72 overflow-hidden rounded-2xl border bg-white shadow-xl">
          <div className="border-ink-100 border-b px-4 py-3">
            <p className="text-ink-950 truncate text-sm font-medium">{userName}</p>
            <p className="text-ink-500 truncate text-xs">{userEmail}</p>
          </div>

          <div className="py-1">
            <Row href="/" onClick={close} icon={ICONS.home}>
              Home
            </Row>
            <Row href="/feed" onClick={close} icon={ICONS.feed}>
              My Feed
            </Row>
            {shape.isOperator && (
              <Row href="/dashboard" onClick={close} icon={ICONS.dashboard}>
                {operatorMenuLabel(shape)}
              </Row>
            )}
            {shape.coachTeams.slice(0, 3).map((t) => (
              <Row key={t.teamId} href={coachTeamHref(t)} onClick={close} icon={ICONS.team}>
                <span className="truncate">{t.name}</span>
              </Row>
            ))}
            {shape.coachTeams.length > 3 && (
              <Row href="/teams" onClick={close} icon={ICONS.team}>
                All my teams
              </Row>
            )}
            {shape.isRefereeing && (
              <Row href="/referee" onClick={close} icon={ICONS.whistle}>
                My games
              </Row>
            )}
          </div>

          <div className="border-ink-100 border-t py-1">
            {shape.hasCalendar && (
              <Row href="/calendar" onClick={close} icon={ICONS.calendar}>
                Calendar
              </Row>
            )}
            <Row href="/messages" onClick={close} icon={ICONS.chat}>
              Chat
            </Row>
            {/* No Notifications row: the bell beside the badge IS the inbox
                (owner 2026-07-21 — having both was redundant). */}
            <Row href="/account" onClick={close} icon={ICONS.account}>
              Account &amp; settings
            </Row>
          </div>

          {/* The old top-bar plus button, foldered away (owner 2026-07-15) */}
          <div className="border-ink-100 border-t py-1">
            <Row href="/players/add" onClick={close} icon={ICONS.plus}>
              Add a player
            </Row>
            <Row href="/clubs/create" onClick={close} icon={ICONS.plus}>
              Create a club
            </Row>
            <Row href="/manage/leagues/create" onClick={close} icon={ICONS.plus}>
              Create a league
            </Row>
            {!shape.isRefereeing && (
              <Row href="/referee/profile" onClick={close} icon={ICONS.whistle}>
                Become a referee
              </Row>
            )}
          </div>

          <div className="border-ink-100 border-t py-1">
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="flex min-h-[44px] w-full items-center gap-3 px-4 text-sm text-red-600 transition hover:bg-red-50"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
              </svg>
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
