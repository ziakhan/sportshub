"use client"

import React from "react"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useUnreadChats, UnreadDot } from "./unread-chats"
import { coachTeamHref, operatorTabLabel, type NavShape } from "@/lib/queries/nav-shape"

/**
 * Mobile bottom tab bar (site-ia-plan §5.6.6) — the signed-in global layer
 * on phones/tablets (< lg). Home · Chat · Calendar · [context slot] ·
 * Account. Plain links (no history tricks); 44px+ targets; safe-area
 * padding; present on BOTH the public and platform layouts so it doubles as
 * the always-home escape hatch.
 */

const icon = {
  home: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 10 12 3l9 7" />
      <path d="M5 10v10h14V10" />
    </svg>
  ),
  scores: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 12h4l3-8 4 16 3-8h4" />
    </svg>
  ),
  chat: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  calendar: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  ),
  dashboard: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </svg>
  ),
  team: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="9" cy="7" r="3" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M3 20a6 6 0 0 1 12 0M14 20a5 5 0 0 1 7-4.6" />
    </svg>
  ),
  whistle: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="9" cy="14" r="6" />
      <path d="M14.5 10.5 21 6l-2 6h-4" />
    </svg>
  ),
  account: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  ),
}

function contextTab(shape: NavShape): { href: string; label: string; icon: React.ReactNode } | null {
  // Priority per site-ia-plan §5.6 gap 4: operator > coach > parent > referee
  if (shape.isOperator)
    return { href: "/dashboard", label: operatorTabLabel(shape), icon: icon.dashboard }
  if (shape.coachTeams.length === 1)
    return { href: coachTeamHref(shape.coachTeams[0]), label: "My Team", icon: icon.team }
  if (shape.coachTeams.length > 1) return { href: "/teams", label: "My Teams", icon: icon.team }
  if (shape.hasKids) return { href: "/players", label: "My Kids", icon: icon.team }
  if (shape.isRefereeing) return { href: "/referee", label: "My Games", icon: icon.whistle }
  return null
}

export function BottomTabs({ shape }: { shape: NavShape }) {
  const pathname = usePathname() ?? "/"
  const unread = useUnreadChats()
  const ctx = contextTab(shape)

  const tabs = [
    { href: "/", label: "Home", icon: icon.home, exact: true },
    { href: "/messages", label: "Chat", icon: icon.chat, badge: unread },
    ...(shape.hasCalendar ? [{ href: "/calendar", label: "Calendar", icon: icon.calendar }] : []),
    ...(ctx ? [ctx] : []),
    { href: "/account", label: "Account", icon: icon.account },
  ] as Array<{ href: string; label: string; icon: React.ReactNode; exact?: boolean; badge?: number }>

  const isActive = (t: { href: string; exact?: boolean }) =>
    t.exact ? pathname === t.href : pathname === t.href || pathname.startsWith(`${t.href}/`)

  return (
    <nav
      aria-label="Primary"
      className="border-ink-100 fixed inset-x-0 bottom-0 z-40 border-t bg-white/95 backdrop-blur-lg lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex h-16 max-w-lg items-stretch justify-around">
        {tabs.map((t) => {
          const active = isActive(t)
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className="relative flex min-w-[56px] flex-col items-center justify-center px-1 py-2"
            >
              {/* Energy Pass (owner-refined): the whole active tab — icon AND
                  label — sits in one filled energy capsule; follows the admin
                  palette automatically. */}
              <span
                className={`flex flex-col items-center justify-center gap-0.5 rounded-2xl px-3.5 py-1 text-[11.5px] font-bold transition-colors ${
                  active
                    ? "bg-energy text-energy-on"
                    : "text-ink-600 hover:text-ink-900"
                }`}
              >
                <span className="relative">
                  {t.icon}
                  {t.badge ? <UnreadDot count={t.badge} /> : null}
                </span>
                {t.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}


/**
 * Anonymous bottom bar (owner 2026-07-18, phone=phone): signed-out mobile
 * web gets navigation too — Home · Scores (consumer-first) · Sign in.
 * Same capsule language as the signed-in bar.
 */
export function AnonymousBottomTabs() {
  const pathname = usePathname() ?? "/"
  const tabs = [
    { href: "/", label: "Home", icon: icon.home, exact: true },
    { href: "/scores", label: "Scores", icon: icon.scores, exact: false },
    { href: "/sign-in", label: "Sign in", icon: icon.account, exact: false },
  ]
  return (
    <nav
      aria-label="Primary"
      className="border-ink-100 fixed inset-x-0 bottom-0 z-40 border-t bg-white/95 backdrop-blur-lg lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex h-16 max-w-lg items-stretch justify-around">
        {tabs.map((t) => {
          const active = t.exact ? pathname === t.href : pathname.startsWith(t.href)
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className="relative flex min-w-[56px] flex-col items-center justify-center px-1 py-2"
            >
              <span
                className={`flex flex-col items-center justify-center gap-0.5 rounded-2xl px-3.5 py-1 text-[11.5px] font-bold transition-colors ${
                  active ? "bg-energy text-energy-on" : "text-ink-600 hover:text-ink-900"
                }`}
              >
                {t.icon}
                {t.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
