"use client"
import { BrandWordmark } from "@/components/brand/wordmark"

import { useState, useEffect } from "react"
import { createPortal } from "react-dom"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  buildNavSections,
  isWorkspacePath,
  type IconKey,
  type NavItem,
  type NavSection,
  type NavTenant,
} from "./nav-config"

interface MobileNavProps {
  roles: string[]
  tenants: Array<Pick<NavTenant, "id" | "name" | "slug" | "role">>
}

export function MobileNav({ roles, tenants = [] }: MobileNavProps) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  // Close on route change
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  // Prevent body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [open])

  // Workspace-only chrome (owner 2026-07-15): the hamburger exists only
  // inside the management area — personal pages stay two-nav clean.
  if (!isWorkspacePath(pathname)) return null

  const sections = buildNavSections({ roles, tenants, homeLabel: "Overview" })

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="border-ink-200 text-ink-600 hover:bg-ink-50 hover:text-ink-950 rounded-2xl border bg-white p-2 transition sm:hidden"
        aria-label="Open menu"
      >
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6h16M4 12h16M4 18h16"
          />
        </svg>
      </button>

      {/* Overlay — PORTALED to <body>: the top bar's backdrop-blur makes it
          the containing block for fixed descendants, which trapped this
          "full-screen" drawer inside the 64px bar (owner bug 2026-07-12) */}
      {open &&
        typeof document !== "undefined" &&
        createPortal(
        <div className="fixed inset-0 z-50 sm:hidden">
          <div
            className="bg-ink-950/45 absolute inset-0 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          <nav className="border-ink-100 shadow-panel absolute left-0 top-0 h-full w-80 overflow-y-auto border-r bg-white">
            <div className="border-ink-100 flex items-center justify-between border-b px-4 py-4">
              <div>
                <div className="text-ink-400 text-[11px] font-semibold uppercase tracking-[0.2em]">
                  Navigation
                </div>
                <BrandWordmark size="sm" />
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-ink-500 hover:bg-ink-50 hover:text-ink-950 rounded-xl p-2 transition"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="space-y-1 p-4">
              {sections.map((section) => (
                <MobileSection key={section.key} section={section} pathname={pathname} />
              ))}
            </div>
          </nav>
        </div>,
        document.body
      )}
    </>
  )
}

function MobileSection({ section, pathname }: { section: NavSection; pathname: string | null }) {
  if (section.key === "home") {
    return (
      <>
        {section.items.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} />
        ))}
      </>
    )
  }

  if (section.key === "footer") {
    return (
      <div className="border-ink-100 border-t pt-4">
        {section.items.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} />
        ))}
      </div>
    )
  }

  return (
    <div className="mb-4">
      {section.label && <NavHeader label={section.label} />}
      {section.workspaces?.map((workspace) => (
        <div key={workspace.key} className="mb-2">
          <NavLink item={workspace.root} pathname={pathname} />
          {workspace.subItems.length > 0 && (
            <div className="ml-4 space-y-1">
              {workspace.subItems.map((item) => (
                <NavSubLink key={item.href} item={item} pathname={pathname} />
              ))}
            </div>
          )}
        </div>
      ))}
      {section.items.map((item) => (
        <NavLink key={item.href} item={item} pathname={pathname} />
      ))}
    </div>
  )
}

function NavHeader({ label }: { label: string }) {
  return (
    <div className="text-ink-400 mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.2em]">
      {label}
    </div>
  )
}

function NavLink({ item, pathname }: { item: NavItem; pathname: string | null }) {
  const { href, label } = item
  const active = pathname === href || (pathname?.startsWith(`${href}/`) ?? false)

  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition ${
        active ? "bg-play-50 text-play-700" : "text-ink-700 hover:bg-ink-50 hover:text-ink-950"
      }`}
    >
      <span
        className={`flex h-8 w-8 items-center justify-center rounded-xl ${active ? "text-play-600 bg-white" : "bg-ink-50 text-ink-500"}`}
      >
        <NavIcon icon={item.icon} />
      </span>
      <span>{label}</span>
    </Link>
  )
}

function NavSubLink({ item, pathname }: { item: NavItem; pathname: string | null }) {
  const { href, label } = item
  const active = pathname === href || (pathname?.startsWith(`${href}/`) ?? false)

  return (
    <Link
      href={href}
      className={`flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-medium transition ${
        active ? "bg-play-50 text-play-700" : "text-ink-500 hover:bg-ink-50 hover:text-ink-950"
      }`}
    >
      <span
        className={`flex h-5 w-5 items-center justify-center rounded-lg ${active ? "text-play-600 bg-white" : "bg-ink-50 text-ink-400"}`}
      >
        <NavIcon icon={item.icon} />
      </span>
      <span>{label}</span>
    </Link>
  )
}

function NavIcon({ icon }: { icon: IconKey }) {
  const Icon = ICONS[icon]
  return <Icon />
}

function IconDashboard() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
    </svg>
  )
}

function IconUsers() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

function IconClub() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 21h18" />
      <path d="M5 21V8l7-5 7 5v13" />
      <path d="M9 12h6" />
    </svg>
  )
}

function IconClipboard() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" />
    </svg>
  )
}

function IconFlag() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" y1="22" x2="4" y2="15" />
    </svg>
  )
}

function IconCalendar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
    </svg>
  )
}

function IconStar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  )
}

function IconPlay() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <polygon points="10 8 16 12 10 16 10 8" />
    </svg>
  )
}

function IconAddUser() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="8.5" cy="7" r="4" />
      <line x1="20" y1="8" x2="20" y2="14" />
      <line x1="23" y1="11" x2="17" y2="11" />
    </svg>
  )
}

function IconSearch() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  )
}

function IconBell() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  )
}

function IconSettings() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-2.82.33v.16a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15v-.16a2 2 0 0 1 4 0v.09c.08.63.5 1.16 1.08 1.41" />
    </svg>
  )
}

function IconPlus() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

function IconCard() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <line x1="2" y1="10" x2="22" y2="10" />
    </svg>
  )
}

const ICONS: Record<IconKey, () => JSX.Element> = {
  dashboard: IconDashboard,
  users: IconUsers,
  club: IconClub,
  clipboard: IconClipboard,
  flag: IconFlag,
  calendar: IconCalendar,
  star: IconStar,
  play: IconPlay,
  addUser: IconAddUser,
  search: IconSearch,
  bell: IconBell,
  settings: IconSettings,
  plus: IconPlus,
  card: IconCard,
}
