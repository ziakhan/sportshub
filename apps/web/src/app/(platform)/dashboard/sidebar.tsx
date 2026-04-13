"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

interface SidebarProps {
  roles: string[]
  tenants?: Array<{ id: string; name: string; slug: string; role?: string }>
  userName: string
  userInitials: string
  primaryRole: string
}

export function Sidebar({ roles, tenants = [], userName, userInitials, primaryRole }: SidebarProps) {
  const pathname = usePathname()
  const hasRole = (role: string) => roles.includes(role)

  const isAdmin = hasRole("ClubOwner") || hasRole("ClubManager")
  const isStaff = hasRole("Staff") || hasRole("TeamManager")

  const uniqueTenants = Array.from(new Map(tenants.map((tenant) => [tenant.id, tenant])).values())
  const adminTenantIds = new Set(
    tenants
      .filter((tenant) => tenant.role === "ClubOwner" || tenant.role === "ClubManager")
      .map((tenant) => tenant.id)
  )
  const staffOnlyTenants = uniqueTenants.filter((tenant) => !adminTenantIds.has(tenant.id))
  const adminTenants = uniqueTenants.filter((tenant) => adminTenantIds.has(tenant.id))

  return (
    <aside className="hidden w-[268px] flex-shrink-0 border-r border-ink-100 bg-[#fcfcfc] lg:flex lg:flex-col">
      <div className="flex h-[64px] items-center gap-2.5 border-b border-ink-100 px-5">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-play-600 text-white">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 2c0 5.5 2 8.5 10 10M12 22c0-5.5-2-8.5-10-10" />
          </svg>
        </span>
        <span className="font-display text-[15px] font-bold text-ink-950">sportshub</span>
      </div>

      <nav className="sidebar-scroll flex-1 overflow-y-auto px-3 py-4">
        <div className="mb-5">
          <SidebarLink href="/dashboard" label="Dashboard" pathname={pathname} icon={<IconDashboard />} />
        </div>

        {hasRole("PlatformAdmin") && (
          <div className="mb-5">
            <SidebarHeader label="Admin" />
            <SidebarLink href="/dashboard/admin/users" label="Users" pathname={pathname} icon={<IconUsers />} />
            <SidebarLink href="/dashboard/admin/clubs" label="Clubs" pathname={pathname} icon={<IconClub />} />
            <SidebarLink href="/leagues" label="Leagues" pathname={pathname} icon={<IconStar />} />
            <SidebarLink href="/dashboard/admin/claims" label="Claims" pathname={pathname} icon={<IconClipboard />} />
            <SidebarLink href="/dashboard/admin/settings" label="Settings" pathname={pathname} icon={<IconSettings />} />
          </div>
        )}

        {hasRole("Parent") && (
          <div className="mb-5">
            <SidebarHeader label="Parent" />
            <SidebarLink href="/players" label="My Players" pathname={pathname} icon={<IconUsers />} />
            <SidebarLink href="/offers" label="Offers Received" pathname={pathname} icon={<IconFlag />} />
            <SidebarLink href="/events" label="Browse Programs" pathname={pathname} icon={<IconSearch />} />
            <SidebarLink href="/notifications" label="Payments & Alerts" pathname={pathname} icon={<IconCard />} />
          </div>
        )}

        {isAdmin && (
          <div className="mb-5">
            <SidebarHeader label="Club" />
            {adminTenants.length > 0 ? (
              adminTenants.map((tenant) => (
                <div key={tenant.id} className="mb-3 rounded-2xl border border-ink-100 bg-white p-2.5 shadow-soft">
                  <div className="mb-1 px-2 text-[10px] font-bold uppercase tracking-[0.16em] text-ink-400">Club workspace</div>
                  <SidebarLink href={`/clubs/${tenant.id}`} label={tenant.name} pathname={pathname} icon={<IconDashboard />} />
                  <div className="ml-4 mt-1 space-y-1 border-l border-ink-100 pl-3">
                    <SidebarSubLink href={`/clubs/${tenant.id}/teams`} label="Teams" pathname={pathname} icon={<IconUsers />} />
                    <SidebarSubLink href={`/clubs/${tenant.id}/tryouts`} label="Tryouts" pathname={pathname} icon={<IconClipboard />} />
                    <SidebarSubLink href={`/clubs/${tenant.id}/offers`} label="Offers" pathname={pathname} icon={<IconFlag />} />
                    <SidebarSubLink href={`/clubs/${tenant.id}/offer-templates`} label="Templates" pathname={pathname} icon={<IconClipboard />} />
                    <SidebarSubLink href={`/clubs/${tenant.id}/house-leagues`} label="House League" pathname={pathname} icon={<IconStar />} />
                    <SidebarSubLink href={`/clubs/${tenant.id}/camps`} label="Camps" pathname={pathname} icon={<IconCalendar />} />
                    <SidebarSubLink href={`/clubs/${tenant.id}/tournaments`} label="Tournaments" pathname={pathname} icon={<IconPlay />} />
                    <SidebarSubLink href={`/clubs/${tenant.id}/staff`} label="Staff" pathname={pathname} icon={<IconAddUser />} />
                    <SidebarSubLink href={`/clubs/${tenant.id}/settings`} label="Settings" pathname={pathname} icon={<IconSettings />} />
                  </div>
                </div>
              ))
            ) : (
              <>
                <SidebarLink href="/clubs/create" label="Create Club" pathname={pathname} icon={<IconPlus />} />
                <SidebarLink href="/clubs/find" label="Find & Claim Club" pathname={pathname} icon={<IconSearch />} />
              </>
            )}
          </div>
        )}

        {isStaff && (
          <div className="mb-5">
            <SidebarHeader label="Staff" />
            {staffOnlyTenants.length > 0 ? (
              staffOnlyTenants.map((tenant) => (
                <div key={tenant.id} className="mb-3 rounded-2xl border border-ink-100 bg-white p-2.5 shadow-soft">
                  <div className="mb-1 px-2 text-[10px] font-bold uppercase tracking-[0.16em] text-ink-400">Staff workspace</div>
                  <SidebarLink href={`/clubs/${tenant.id}`} label={tenant.name} pathname={pathname} icon={<IconDashboard />} />
                  <div className="ml-4 mt-1 space-y-1 border-l border-ink-100 pl-3">
                    <SidebarSubLink href={`/clubs/${tenant.id}/teams`} label="Teams" pathname={pathname} icon={<IconUsers />} />
                    <SidebarSubLink href={`/clubs/${tenant.id}/tryouts`} label="Tryouts" pathname={pathname} icon={<IconClipboard />} />
                  </div>
                </div>
              ))
            ) : (
              <SidebarLink href="/teams" label="My Teams" pathname={pathname} icon={<IconUsers />} />
            )}
          </div>
        )}

        {(isAdmin || isStaff) && (
          <div className="mb-5">
            <SidebarHeader label="Browse" />
            <SidebarLink href="/browse-leagues" label="Leagues" pathname={pathname} icon={<IconSearch />} />
            <SidebarLink href="/browse-tournaments" label="Tournaments" pathname={pathname} icon={<IconStar />} />
          </div>
        )}

        {hasRole("Referee") && (
          <div className="mb-5">
            <SidebarHeader label="Referee" />
            <SidebarLink href="/browse-leagues" label="Available Games" pathname={pathname} icon={<IconCalendar />} />
            <SidebarLink href="/referee/profile" label="My Profile" pathname={pathname} icon={<IconUsers />} />
          </div>
        )}

        {hasRole("Player") && (
          <div className="mb-5">
            <SidebarHeader label="Player" />
            <SidebarLink href="/teams" label="My Teams" pathname={pathname} icon={<IconUsers />} />
            <SidebarLink href="/browse-tournaments" label="Schedule" pathname={pathname} icon={<IconCalendar />} />
            <SidebarLink href="/dashboard" label="My Stats" pathname={pathname} icon={<IconDashboard />} />
          </div>
        )}

        {(hasRole("LeagueOwner") || hasRole("LeagueManager")) && (
          <div className="mb-5">
            <SidebarHeader label="League" />
            <SidebarLink href="/leagues" label="My Leagues" pathname={pathname} icon={<IconStar />} />
          </div>
        )}

        <div className="mt-5 border-t border-ink-100 pt-4">
          <SidebarLink href="/notifications" label="Notifications" pathname={pathname} icon={<IconBell />} />
          <SidebarLink href="/settings/profile" label="Profile" pathname={pathname} icon={<IconUsers />} />
        </div>
      </nav>

      <div className="border-t border-ink-100 px-3 py-3">
        <div className="flex items-center gap-3 rounded-xl px-3 py-2 transition hover:bg-ink-50">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-play-400 to-play-600 text-[11px] font-bold text-white shadow-sm">
            {userInitials}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-ink-950">{userName}</div>
            <div className="truncate text-[11px] text-ink-400">{primaryRole}</div>
          </div>
        </div>
      </div>
    </aside>
  )
}

function SidebarHeader({ label }: { label: string }) {
  return <div className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-400">{label}</div>
}

function SidebarLink({ href, label, pathname, icon }: { href: string; label: string; pathname: string | null; icon: React.ReactNode }) {
  const active = pathname === href || (pathname?.startsWith(`${href}/`) ?? false)
  const shouldPrefetch = process.env.NODE_ENV === "production"

  return (
    <Link
      href={href}
      prefetch={shouldPrefetch}
      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
        active ? "bg-play-50 text-play-700 shadow-soft" : "text-ink-600 hover:bg-white hover:text-ink-950"
      }`}
    >
      <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl ${active ? "bg-white text-play-600" : "bg-ink-50 text-ink-500"}`}>{icon}</span>
      <span>{label}</span>
    </Link>
  )
}

function SidebarSubLink({ href, label, pathname, icon }: { href: string; label: string; pathname: string | null; icon: React.ReactNode }) {
  const active = pathname === href || (pathname?.startsWith(`${href}/`) ?? false)
  const shouldPrefetch = process.env.NODE_ENV === "production"

  return (
    <Link
      href={href}
      prefetch={shouldPrefetch}
      className={`flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-medium transition ${
        active ? "bg-play-50 text-play-700" : "text-ink-500 hover:bg-ink-50 hover:text-ink-950"
      }`}
    >
      <span className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-lg ${active ? "bg-white text-play-600" : "bg-ink-50 text-ink-400"}`}>{icon}</span>
      <span>{label}</span>
    </Link>
  )
}

function IconDashboard() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /></svg>
}

function IconUsers() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
}

function IconClub() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 21h18" /><path d="M5 21V8l7-5 7 5v13" /><path d="M9 12h6" /></svg>
}

function IconClipboard() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" /></svg>
}

function IconFlag() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" y1="22" x2="4" y2="15" /></svg>
}

function IconCalendar() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /></svg>
}

function IconStar() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
}

function IconPlay() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polygon points="10 8 16 12 10 16 10 8" /></svg>
}

function IconAddUser() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" /></svg>
}

function IconSearch() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
}

function IconBell() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
}

function IconSettings() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-2.82.33v.16a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15v-.16a2 2 0 0 1 4 0v.09c.08.63.5 1.16 1.08 1.41" /></svg>
}

function IconPlus() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
}

function IconCard() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></svg>
}
