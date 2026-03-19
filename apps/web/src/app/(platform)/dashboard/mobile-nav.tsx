"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"

interface MobileNavProps {
  roles: string[]
  tenants: Array<{ id: string; name: string; slug: string; role?: string }>
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

  const hasRole = (role: string) => roles.includes(role)
  const isAdmin = hasRole("ClubOwner") || hasRole("ClubManager")
  const isStaff = hasRole("Staff") || hasRole("TeamManager")

  const uniqueTenants = Array.from(
    new Map(tenants.map((t) => [t.id, t])).values()
  )
  const adminTenantIds = new Set(
    tenants
      .filter((t) => t.role === "ClubOwner" || t.role === "ClubManager")
      .map((t) => t.id)
  )
  const staffOnlyTenants = uniqueTenants.filter((t) => !adminTenantIds.has(t.id))
  const adminTenants = uniqueTenants.filter((t) => adminTenantIds.has(t.id))

  return (
    <>
      {/* Hamburger button */}
      <button
        onClick={() => setOpen(true)}
        className="rounded-md p-2 text-gray-600 hover:bg-gray-100 md:hidden"
        aria-label="Open menu"
      >
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Overlay */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setOpen(false)}
          />

          {/* Slide-out panel */}
          <nav className="absolute left-0 top-0 h-full w-72 overflow-y-auto bg-white shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b px-4 py-3">
              <span className="text-lg font-bold text-blue-600">Menu</span>
              <button
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-1 p-4">
              <NavLink href="/dashboard" label="Home" />

              {hasRole("PlatformAdmin") && (
                <div className="mb-4">
                  <NavHeader label="Admin" />
                  <NavLink href="/dashboard/admin/users" label="Users" />
                  <NavLink href="/dashboard/admin/clubs" label="Clubs" />
                  <NavLink href="/dashboard/admin/claims" label="Claims" />
                  <NavLink href="/dashboard/admin/settings" label="Settings" />
                </div>
              )}

              {hasRole("Parent") && (
                <div className="mb-4">
                  <NavHeader label="Parent" />
                  <NavLink href="/players" label="My Players" />
                  <NavLink href="/offers" label="Offers" />
                  <NavLink href="/marketplace" label="Browse Tryouts" />
                  <NavLink href="/payments" label="Payments" />
                </div>
              )}

              {isAdmin && (
                <div className="mb-4">
                  <NavHeader label="Club" />
                  {adminTenants.length > 0 ? (
                    adminTenants.map((t) => (
                      <div key={t.id} className="mb-2">
                        <NavLink href={`/clubs/${t.id}`} label={t.name} />
                        <div className="ml-4 space-y-0.5">
                          <NavSubLink href={`/clubs/${t.id}/teams`} label="Teams" />
                          <NavSubLink href={`/clubs/${t.id}/tryouts`} label="Tryouts" />
                          <NavSubLink href={`/clubs/${t.id}/offers`} label="Offers" />
                          <NavSubLink href={`/clubs/${t.id}/staff`} label="Staff" />
                          <NavSubLink href={`/clubs/${t.id}/settings`} label="Settings" />
                        </div>
                      </div>
                    ))
                  ) : (
                    <NavLink href="/clubs/create" label="Create Club" />
                  )}
                  <div className="mt-2">
                    <NavLink href="/browse-leagues" label="Browse Leagues" />
                  </div>
                </div>
              )}

              {isStaff && (
                <div className="mb-4">
                  <NavHeader label="Staff" />
                  {staffOnlyTenants.length > 0 ? (
                    staffOnlyTenants.map((t) => (
                      <div key={t.id} className="mb-2">
                        <NavLink href={`/clubs/${t.id}`} label={t.name} />
                        <div className="ml-4 space-y-0.5">
                          <NavSubLink href={`/clubs/${t.id}/teams`} label="Teams" />
                          <NavSubLink href={`/clubs/${t.id}/tryouts`} label="Tryouts" />
                        </div>
                      </div>
                    ))
                  ) : (
                    <NavLink href="/teams" label="My Teams" />
                  )}
                </div>
              )}

              {hasRole("Referee") && (
                <div className="mb-4">
                  <NavHeader label="Referee" />
                  <NavLink href="/referee/games" label="Available Games" />
                  <NavLink href="/referee/profile" label="My Profile" />
                </div>
              )}

              {hasRole("Player") && (
                <div className="mb-4">
                  <NavHeader label="Player" />
                  <NavLink href="/player/teams" label="My Teams" />
                  <NavLink href="/player/schedule" label="Schedule" />
                  <NavLink href="/player/stats" label="My Stats" />
                </div>
              )}

              {(hasRole("LeagueOwner") || hasRole("LeagueManager")) && (
                <div className="mb-4">
                  <NavHeader label="League" />
                  <NavLink href="/leagues" label="My Leagues" />
                </div>
              )}

              <div className="border-t pt-4">
                <NavLink href="/settings/profile" label="Profile" />
              </div>
            </div>
          </nav>
        </div>
      )}
    </>
  )
}

function NavHeader({ label }: { label: string }) {
  return (
    <div className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
      {label}
    </div>
  )
}

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="block rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900"
    >
      {label}
    </Link>
  )
}

function NavSubLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="block rounded-md px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50 hover:text-gray-700"
    >
      {label}
    </Link>
  )
}
