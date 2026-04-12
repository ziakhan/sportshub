import React from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import PlatformLayout from "@/app/(platform)/layout"
import { getCurrentUser, isImpersonating } from "@/lib/auth-helpers"
import { redirect } from "next/navigation"

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}))

vi.mock("@/lib/auth-helpers", () => ({
  getCurrentUser: vi.fn(),
  isImpersonating: vi.fn(),
}))

vi.mock("@/app/(platform)/dashboard/sidebar", () => ({
  Sidebar: () => <div>Sidebar</div>,
}))

vi.mock("@/app/(platform)/dashboard/mobile-nav", () => ({
  MobileNav: () => <div>MobileNav</div>,
}))

vi.mock("@/app/(platform)/dashboard/notification-bell", () => ({
  NotificationBell: () => <div>NotificationBell</div>,
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
    expect(html).not.toContain("NotificationBell")
    expect(html).not.toContain("Youth Basketball Hub")
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

    const element = await PlatformLayout({ children: <div>DashboardContent</div> })
    const html = renderToStaticMarkup(element)

    expect(html).toContain("Youth Basketball Hub")
    expect(html).toContain("NotificationBell")
    expect(html).toContain("UserMenu:Taylor Jordan")
    expect(html).toContain("DashboardContent")
  })
})
