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
  /** Label for the top-level workspace-overview link. */
  homeLabel?: string
}

/**
 * The operator workspace's territory. The sidebar/drawer renders ONLY here
 * (owner 2026-07-15): on personal pages (/calendar, /messages, /account,
 * /players…) even operators get the clean two-nav chrome. Crossing into the
 * workspace is what makes the third nav appear.
 */
const WORKSPACE_PREFIXES = [
  "/dashboard",
  "/manage",
  "/clubs",
  "/browse-leagues",
  "/browse-tournaments",
  "/score",
  "/teams",
] as const

export function isWorkspacePath(pathname: string | null): boolean {
  if (!pathname) return false
  return WORKSPACE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

function badge(count: number | undefined, toneClass: string): NavBadge | undefined {
  return typeof count === "number" && count > 0 ? { count, toneClass } : undefined
}

// One owner per navigation level (owner rule 2026-07-11): the sidebar
// SWITCHES workspaces; the club page's tab bar navigates WITHIN one. The
// old sidebar sub-item lists duplicated the tabs word-for-word — gone.
// The offers-pending badge survives on the workspace root so the signal
// isn't lost with the sub-items.
function clubWorkspace(tenant: NavTenant): NavWorkspace {
  return {
    key: tenant.id,
    kindLabel: "Club workspace",
    root: {
      label: tenant.name,
      href: `/clubs/${tenant.id}`,
      icon: "dashboard",
      badge: badge(tenant.counts?.offers, "bg-violet-50 text-violet-600"),
    },
    subItems: [],
  }
}

function staffWorkspace(tenant: NavTenant): NavWorkspace {
  return {
    key: tenant.id,
    kindLabel: "Staff workspace",
    root: { label: tenant.name, href: `/clubs/${tenant.id}`, icon: "dashboard" },
    subItems: [],
  }
}

// WORKSPACE SECTIONS ONLY (owner 2026-07-15): the drawer/sidebar never
// duplicates the bottom tabs or badge menu. Personal-layer entries (My
// Calendar, Parent, Player, Officiating, Notifications, Profile) are gone —
// they live in the two global navs every user already has.
export function buildNavSections({
  roles,
  tenants = [],
  homeLabel = "Overview",
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
        { label: "Audit Trail", href: "/dashboard/admin/audit", icon: "clipboard" },
        { label: "Settings", href: "/dashboard/admin/settings", icon: "settings" },
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
      // The door back to the PUBLIC world (site-ia-plan §7) — the one
      // non-workspace row, because the desktop sidebar has no bottom tabs.
      { label: "Public site", href: "/", icon: "play" },
    ],
  })

  return sections
}
