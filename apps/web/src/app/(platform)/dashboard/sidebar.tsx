import Link from "next/link"

interface SidebarProps {
  roles: string[]
  tenants?: Array<{ id: string; name: string; slug: string; role?: string }>
}

export function Sidebar({ roles, tenants = [] }: SidebarProps) {
  const hasRole = (role: string) => roles.includes(role)

  const isAdmin = hasRole("ClubOwner") || hasRole("ClubManager")
  const isStaff = hasRole("Staff") || hasRole("TeamManager")

  // Deduplicate tenants (a user may have multiple roles at the same club)
  const uniqueTenants = Array.from(
    new Map(tenants.map((t) => [t.id, t])).values()
  )

  // Admin tenants: clubs where user is Owner or Manager
  const adminTenantIds = new Set(
    tenants
      .filter((t) => t.role === "ClubOwner" || t.role === "ClubManager")
      .map((t) => t.id)
  )

  // Staff-only tenants: clubs where user is Staff/TeamManager but NOT admin
  const staffOnlyTenants = uniqueTenants.filter(
    (t) => !adminTenantIds.has(t.id)
  )
  const adminTenants = uniqueTenants.filter((t) => adminTenantIds.has(t.id))

  return (
    <aside className="hidden w-64 flex-shrink-0 border-r border-navy-700 bg-navy-900 md:block">
      <nav className="sticky top-0 space-y-1 p-4">
        {/* Always visible */}
        <div className="mb-4">
          <SidebarLink href="/dashboard" label="Home" />
        </div>

        {/* Platform Admin */}
        {hasRole("PlatformAdmin") && (
          <div className="mb-4">
            <SidebarHeader label="Admin" />
            <SidebarLink href="/dashboard/admin/users" label="Users" />
            <SidebarLink href="/dashboard/admin/clubs" label="Clubs" />
            <SidebarLink href="/leagues" label="Leagues" />
            <SidebarLink href="/dashboard/admin/claims" label="Claims" />
            <SidebarLink href="/dashboard/admin/settings" label="Settings" />
          </div>
        )}

        {/* Parent */}
        {hasRole("Parent") && (
          <div className="mb-4">
            <SidebarHeader label="Parent" />
            <SidebarLink href="/players" label="My Players" />
            <SidebarLink href="/offers" label="Offers" />
            <SidebarLink href="/marketplace" label="Browse Tryouts" />
            <SidebarLink href="/payments" label="Payments" />
          </div>
        )}

        {/* Club Owner / Manager */}
        {isAdmin && (
          <div className="mb-4">
            <SidebarHeader label="Club" />
            {adminTenants.length > 0 ? (
              adminTenants.map((t) => (
                <div key={t.id}>
                  <SidebarLink href={`/clubs/${t.id}`} label={t.name} />
                  <div className="ml-4 space-y-0.5">
                    <SidebarSubLink
                      href={`/clubs/${t.id}/teams`}
                      label="Teams"
                    />
                    <SidebarSubLink
                      href={`/clubs/${t.id}/tryouts`}
                      label="Tryouts"
                    />
                    <SidebarSubLink
                      href={`/clubs/${t.id}/offers`}
                      label="Offers"
                    />
                    <SidebarSubLink
                      href={`/clubs/${t.id}/staff`}
                      label="Staff"
                    />
                    <SidebarSubLink
                      href={`/clubs/${t.id}/settings`}
                      label="Settings"
                    />
                  </div>
                </div>
              ))
            ) : (
              <SidebarLink href="/clubs/create" label="Create Club" />
            )}
            <div className="mt-2">
              <SidebarLink href="/browse-leagues" label="Browse Leagues" />
            </div>
          </div>
        )}

        {/* Staff — show clubs they're staff at (but not admin of) */}
        {isStaff && (
          <div className="mb-4">
            <SidebarHeader label="Staff" />
            {staffOnlyTenants.length > 0 ? (
              staffOnlyTenants.map((t) => (
                <div key={t.id}>
                  <SidebarLink href={`/clubs/${t.id}`} label={t.name} />
                  <div className="ml-4 space-y-0.5">
                    <SidebarSubLink
                      href={`/clubs/${t.id}/teams`}
                      label="Teams"
                    />
                    <SidebarSubLink
                      href={`/clubs/${t.id}/tryouts`}
                      label="Tryouts"
                    />
                  </div>
                </div>
              ))
            ) : (
              <SidebarLink href="/teams" label="My Teams" />
            )}
          </div>
        )}

        {/* Referee */}
        {hasRole("Referee") && (
          <div className="mb-4">
            <SidebarHeader label="Referee" />
            <SidebarLink href="/referee/games" label="Available Games" />
            <SidebarLink href="/referee/profile" label="My Profile" />
          </div>
        )}

        {/* Player */}
        {hasRole("Player") && (
          <div className="mb-4">
            <SidebarHeader label="Player" />
            <SidebarLink href="/player/teams" label="My Teams" />
            <SidebarLink href="/player/schedule" label="Schedule" />
            <SidebarLink href="/player/stats" label="My Stats" />
          </div>
        )}

        {/* League */}
        {(hasRole("LeagueOwner") || hasRole("LeagueManager")) && (
          <div className="mb-4">
            <SidebarHeader label="League" />
            <SidebarLink href="/leagues" label="My Leagues" />
          </div>
        )}

        {/* Always visible */}
        <div className="border-t border-navy-700 pt-4">
          <SidebarLink href="/settings/profile" label="Profile" />
        </div>
      </nav>
    </aside>
  )
}

function SidebarHeader({ label }: { label: string }) {
  return (
    <div className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-navy-400">
      {label}
    </div>
  )
}

function SidebarLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="block rounded-md px-3 py-2 text-sm text-gray-300 hover:bg-navy-800 hover:text-white"
    >
      {label}
    </Link>
  )
}

function SidebarSubLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="block rounded-md px-3 py-1.5 text-xs text-navy-300 hover:bg-navy-800 hover:text-white"
    >
      {label}
    </Link>
  )
}
