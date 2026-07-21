import React from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import PlatformLayout from "@/app/(platform)/layout"
import { getCurrentUser, isImpersonating } from "@/lib/auth-helpers"
import { redirect } from "next/navigation"

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
  usePathname: () => "/dashboard",
}))

vi.mock("@/lib/auth-helpers", () => ({
  getCurrentUser: vi.fn(),
  isImpersonating: vi.fn(),
}))

const EMPTY_SHAPE = {
  coachTeams: [],
  hasKids: false,
  isRefereeing: false,
  isClubStaff: false,
  isLeagueOwner: false,
  isPlatformAdmin: false,
  isOperator: false,
  isParticipant: false,
  hasCalendar: false,
}

vi.mock("@/lib/queries/nav-shape", () => ({
  getNavShape: vi.fn(async () => EMPTY_SHAPE),
  coachTeamHref: (t: { teamId: string; tenantId: string }) =>
    `/clubs/${t.tenantId}/teams/${t.teamId}/dashboard`,
  operatorTabLabel: () => "My Club",
  operatorMenuLabel: () => "Manage my club",
  EMPTY_NAV_SHAPE: {
    coachTeams: [],
    hasKids: false,
    isRefereeing: false,
    isClubStaff: false,
    isLeagueOwner: false,
    isPlatformAdmin: false,
    isOperator: false,
    isParticipant: false,
    hasCalendar: false,
  },
}))

vi.mock("@/app/(platform)/dashboard/sidebar", () => ({
  Sidebar: () => <div>Sidebar</div>,
}))

vi.mock("@/app/(platform)/dashboard/mobile-nav", () => ({
  MobileNav: () => <div>MobileNav</div>,
}))

vi.mock("@/components/brand/wordmark", () => ({
  BrandWordmark: () => <div>SportsHub ONE</div>,
  BrandIcon: () => <div>BrandIcon</div>,
}))
vi.mock("@/components/chat-dock", () => ({
  ChatDock: () => <div>ChatDock</div>,
}))

vi.mock("@/app/(platform)/dashboard/create-menu", () => ({
  CreateMenu: () => <div>CreateMenu</div>,
}))

vi.mock("@/app/(platform)/dashboard/completion-pill", () => ({
  CompletionPill: () => <div>CompletionPill</div>,
}))

vi.mock("@/app/(platform)/dashboard/user-menu", () => ({
  UserMenu: ({ userName }: { userName: string }) => <div>UserMenu:{userName}</div>,
}))

vi.mock("@/app/(platform)/dashboard/impersonation-banner", () => ({
  ImpersonationBanner: ({ userName }: { userName: string }) => <div>Impersonating:{userName}</div>,
}))

describe("PlatformLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(isImpersonating).mockReturnValue(false)
    vi.mocked(redirect).mockImplementation(() => {
      throw new Error("NEXT_REDIRECT")
    })
  })

  it("redirects unauthenticated users to sign-in", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null)

    await expect(PlatformLayout({ children: <div>Child</div> })).rejects.toThrow("NEXT_REDIRECT")
    expect(redirect).toHaveBeenCalledWith("/sign-in")
  })

  it("renders children without dashboard chrome before onboarding completes", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: "user-1",
      onboardedAt: null,
      roles: [],
    } as any)

    const element = await PlatformLayout({ children: <div>OnboardingContent</div> })
    const html = renderToStaticMarkup(element)

    expect(html).toContain("OnboardingContent")
    // No dashboard chrome during onboarding (no header logo / account menu).
    expect(html).not.toContain('aria-label="Open account menu"')
    expect(html).not.toContain("ONE")
  })

  it("renders dashboard chrome after onboarding completes", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: "user-1",
      firstName: "Taylor",
      lastName: "Jordan",
      email: "taylor@example.com",
      onboardedAt: new Date().toISOString(),
      roles: [
        {
          role: "ClubOwner",
          tenant: {
            id: "tenant-1",
            name: "Warriors Club",
            slug: "warriors",
          },
        },
      ],
    } as any)
    const { getNavShape } = await import("@/lib/queries/nav-shape")
    vi.mocked(getNavShape).mockResolvedValueOnce({
      ...EMPTY_SHAPE,
      isClubStaff: true,
      isOperator: true,
      hasCalendar: true,
    } as any)

    const element = await PlatformLayout({ children: <div>DashboardContent</div> })
    const html = renderToStaticMarkup(element)

    expect(html).toContain("ONE") // BrandWordmark logo
    // Single notification bell now lives in the account-menu cluster.
    expect(html).toContain('aria-label="Notifications')
    // N3-v2 chrome: badge switchboard (initials button) + bottom tab bar
    expect(html).toContain('aria-label="Open account menu"')
    expect(html).toContain(">TJ<")
    expect(html).toContain('aria-label="Primary"')
    expect(html).toContain("DashboardContent")
    // Operators DO get the workspace chrome
    expect(html).toContain("Sidebar")
    expect(html).toContain("MobileNav")
  })

  it("hides the operator chrome (sidebar + hamburger + breadcrumb) from non-operators", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: "user-2",
      firstName: "Priya",
      lastName: "Patel",
      email: "priya@example.com",
      onboardedAt: new Date().toISOString(),
      roles: [{ role: "Parent", tenant: null }],
    } as any)
    const { getNavShape } = await import("@/lib/queries/nav-shape")
    vi.mocked(getNavShape).mockResolvedValueOnce({
      ...EMPTY_SHAPE,
      hasKids: true,
      isParticipant: true,
      hasCalendar: true,
    } as any)

    const element = await PlatformLayout({ children: <div>CalendarContent</div> })
    const html = renderToStaticMarkup(element)

    // Parents on /calendar, /messages etc. never see the dashboard nav
    // they've never met (§5.6.8 — owner bug 2026-07-15)
    expect(html).not.toContain("Sidebar")
    expect(html).not.toContain("MobileNav")
    expect(html).not.toContain(">Dashboard<")
    // …but keep the chrome they know: logo, bell, badge menu, bottom tabs
    expect(html).toContain("ONE") // BrandWordmark logo
    expect(html).toContain('aria-label="Notifications')
    expect(html).toContain('aria-label="Open account menu"')
    expect(html).toContain('aria-label="Primary"')
    expect(html).toContain("CalendarContent")
  })
})
