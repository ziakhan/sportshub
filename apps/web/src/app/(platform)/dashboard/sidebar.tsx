import Link from "next/link"

interface SidebarProps {
  roles: string[]
  tenants?: Array<{ id: string; name: string; slug: string }>
}

export function Sidebar({ roles, tenants = [] }: SidebarProps) {
  const hasRole = (role: string) => roles.includes(role)

  return (
    <aside className="hidden w-64 flex-shrink-0 border-r bg-white md:block">
      <nav className="sticky top-0 space-y-1 p-4">
        {/* Always visible */}
        <div className="mb-4">
          <SidebarLink href="/dashboard" label="Home" />
        </div>

        {/* Parent */}
        {hasRole("Parent") && (
          <div className="mb-4">
            <SidebarHeader label="Parent" />
            <SidebarLink href="/players" label="My Players" />
            <SidebarLink href="/marketplace" label="Browse Tryouts" />
            <SidebarLink href="/payments" label="Payments" />
          </div>
        )}

        {/* Club Owner / Manager */}
        {(hasRole("ClubOwner") || hasRole("ClubManager")) && (
          <div className="mb-4">
            <SidebarHeader label="Club" />
            {tenants.length > 0 ? (
              tenants.map((t) => (
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
          </div>
        )}

        {/* Staff */}
        {hasRole("Staff") && (
          <div className="mb-4">
            <SidebarHeader label="Staff" />
            <SidebarLink href="/teams" label="My Teams" />
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
        <div className="border-t pt-4">
          <SidebarLink href="/settings" label="Settings" />
        </div>
      </nav>
    </aside>
  )
}

function SidebarHeader({ label }: { label: string }) {
  return (
    <div className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
      {label}
    </div>
  )
}

function SidebarLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="block rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900"
    >
      {label}
    </Link>
  )
}

function SidebarSubLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="block rounded-md px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50 hover:text-gray-700"
    >
      {label}
    </Link>
  )
}
