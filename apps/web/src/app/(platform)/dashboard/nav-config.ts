// Single source of truth for the role-based navigation structure shared by
// the desktop sidebar (sidebar.tsx) and the mobile drawer (mobile-nav.tsx).
// This module owns the DATA (sections, links, order, badges); each component
// owns its own presentation (classes, icons, collapse behavior, highlighting).

export type IconKey =
  | "dashboard"
  | "users"
  | "club"
  | "clipboard"
  | "flag"
  | "calendar"
  | "star"
  | "play"
  | "addUser"
  | "search"
  | "bell"
  | "settings"
  | "plus"
  | "card"

export interface NavBadge {
  count: number
  toneClass: string
}

export interface NavItem {
  label: string
  href: string
  icon: IconKey
  badge?: NavBadge
}

/** A per-tenant workspace card (Club workspace / Staff workspace). */
export interface NavWorkspace {
  key: string
  kindLabel: string
  root: NavItem
  subItems: NavItem[]
}

export type NavSectionKey =
  | "home"
  | "admin"
  | "parent"
  | "club"
  | "staff"
  | "browse"
  | "referee"
  | "player"
  | "league"
  | "footer"

export interface NavSection {
  key: NavSectionKey
  /** Section header label. Absent for the home link and the footer block. */
  label?: string
  items: NavItem[]
  /** Tenant workspace groups (club/staff sections only). When non-empty,
   *  `items` holds nothing; when empty, `items` holds the fallback links. */
  workspaces?: NavWorkspace[]
}

export interface NavTenant {
  id: string
  name: string
  slug: string
  role?: string
  counts?: { teams: number; tryouts: number; offers: number }
}

export interface BuildNavSectionsInput {
  roles: string[]
  tenants?: NavTenant[]
  /** Label for the top-level dashboard link ("Dashboard" on desktop, "Home" on mobile). */
  homeLabel?: string
}

function badge(count: number | undefined, toneClass: string): NavBadge | undefined {
  return typeof count === "number" && count > 0 ? { count, toneClass } : undefined
}

function clubWorkspace(tenant: NavTenant): NavWorkspace {
  return {
    key: tenant.id,
    kindLabel: "Club workspace",
    root: { label: tenant.name, href: `/clubs/${tenant.id}`, icon: "dashboard" },
    subItems: [
      {
        label: "Teams",
        href: `/clubs/${tenant.id}/teams`,
        icon: "users",
        badge: badge(tenant.counts?.teams, "bg-court-50 text-court-600"),
      },
      {
        label: "Tryouts",
        href: `/clubs/${tenant.id}/tryouts`,
        icon: "clipboard",
        badge: badge(tenant.counts?.tryouts, "bg-hoop-50 text-hoop-600"),
      },
      {
        label: "Offers",
        href: `/clubs/${tenant.id}/offers`,
        icon: "flag",
        badge: badge(tenant.counts?.offers, "bg-violet-50 text-violet-600"),
      },
      { label: "Templates", href: `/clubs/${tenant.id}/offer-templates`, icon: "clipboard" },
      { label: "House League", href: `/clubs/${tenant.id}/house-leagues`, icon: "star" },
      { label: "Camps", href: `/clubs/${tenant.id}/camps`, icon: "calendar" },
      { label: "Tournaments", href: `/clubs/${tenant.id}/tournaments`, icon: "play" },
      { label: "Payments", href: `/clubs/${tenant.id}/payments`, icon: "card" },
      { label: "Staff", href: `/clubs/${tenant.id}/staff`, icon: "addUser" },
      { label: "Settings", href: `/clubs/${tenant.id}/settings`, icon: "settings" },
    ],
  }
}

function staffWorkspace(tenant: NavTenant): NavWorkspace {
  return {
    key: tenant.id,
    kindLabel: "Staff workspace",
    root: { label: tenant.name, href: `/clubs/${tenant.id}`, icon: "dashboard" },
    subItems: [
      { label: "Teams", href: `/clubs/${tenant.id}/teams`, icon: "users" },
      { label: "Tryouts", href: `/clubs/${tenant.id}/tryouts`, icon: "clipboard" },
    ],
  }
}

export function buildNavSections({
  roles,
  tenants = [],
  homeLabel = "Dashboard",
}: BuildNavSectionsInput): NavSection[] {
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

  const sections: NavSection[] = []

  sections.push({
    key: "home",
    items: [{ label: homeLabel, href: "/dashboard", icon: "dashboard" }],
  })

  if (hasRole("PlatformAdmin")) {
    sections.push({
      key: "admin",
      label: "Admin",
      items: [
        { label: "Users", href: "/dashboard/admin/users", icon: "users" },
        { label: "Clubs", href: "/dashboard/admin/clubs", icon: "club" },
        { label: "Leagues", href: "/manage/leagues", icon: "star" },
        { label: "Claims", href: "/dashboard/admin/claims", icon: "clipboard" },
        { label: "Payments", href: "/dashboard/admin/payments", icon: "card" },
        { label: "Settings", href: "/dashboard/admin/settings", icon: "settings" },
      ],
    })
  }

  if (hasRole("Parent")) {
    sections.push({
      key: "parent",
      label: "Parent",
      items: [
        { label: "My Players", href: "/players", icon: "users" },
        { label: "Offers Received", href: "/offers", icon: "flag" },
        { label: "Browse Programs", href: "/events", icon: "search" },
        { label: "My Payments", href: "/payments", icon: "card" },
      ],
    })
  }

  if (isAdmin) {
    sections.push({
      key: "club",
      label: "Club",
      workspaces: adminTenants.map(clubWorkspace),
      items:
        adminTenants.length > 0
          ? []
          : [
              { label: "Create Club", href: "/clubs/create", icon: "plus" },
              { label: "Find & Claim Club", href: "/clubs/find", icon: "search" },
            ],
    })
  }

  if (isStaff) {
    sections.push({
      key: "staff",
      label: "Staff",
      workspaces: staffOnlyTenants.map(staffWorkspace),
      items:
        staffOnlyTenants.length > 0 ? [] : [{ label: "My Teams", href: "/teams", icon: "users" }],
    })
  }

  if (isAdmin || isStaff) {
    sections.push({
      key: "browse",
      label: "Browse",
      items: [
        // Registration flow (submit teams into leagues) — the public
        // spectator directory lives at /leagues on the public site
        { label: "League registration", href: "/browse-leagues", icon: "search" },
        { label: "Tournaments", href: "/browse-tournaments", icon: "star" },
        { label: "Score games", href: "/score", icon: "play" },
      ],
    })
  }

  if (hasRole("Referee") || hasRole("Scorekeeper")) {
    sections.push({
      key: "referee",
      label: "Officiating",
      items: [
        // Game-day hub: live + upcoming games to score / officiate
        { label: "Score games", href: "/score", icon: "play" },
        ...(hasRole("Referee")
          ? [{ label: "My Profile", href: "/referee/profile", icon: "users" as IconKey }]
          : []),
      ],
    })
  }

  if (hasRole("Player")) {
    sections.push({
      key: "player",
      label: "Player",
      items: [
        { label: "My Teams", href: "/teams", icon: "users" },
        { label: "My Schedule", href: "/scores", icon: "calendar" },
        { label: "My Stats", href: "/players", icon: "dashboard" },
      ],
    })
  }

  if (hasRole("LeagueOwner") || hasRole("LeagueManager")) {
    sections.push({
      key: "league",
      label: "League",
      items: [
        { label: "My Leagues", href: "/manage/leagues", icon: "star" },
        { label: "Score games", href: "/score", icon: "play" },
      ],
    })
  }

  sections.push({
    key: "footer",
    items: [
      // The door back to the PUBLIC world (site-ia-plan §7)
      { label: "Public site", href: "/", icon: "play" },
      { label: "Notifications", href: "/notifications", icon: "bell" },
      { label: "Profile", href: "/settings/profile", icon: "users" },
    ],
  })

  return sections
}
