import React from "react"
import { redirect } from "next/navigation"
import Link from "next/link"
import { getCurrentUser, isImpersonating } from "@/lib/auth-helpers"
import { Sidebar } from "./dashboard/sidebar"
import { MobileNav } from "./dashboard/mobile-nav"
import { NotificationBell } from "./dashboard/notification-bell"
import { UserMenu } from "./dashboard/user-menu"
import { ImpersonationBanner } from "./dashboard/impersonation-banner"

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const dbUser = await getCurrentUser()

  if (!dbUser) {
    redirect("/sign-in")
  }

  const roles = dbUser.roles.map((r: any) => r.role as string)
  const isPlatformAdmin = roles.includes("PlatformAdmin")

  // If user hasn't onboarded, show content without nav chrome
  // (onboarding page handles its own flow). Platform admins are exempt.
  if (!dbUser.onboardedAt && !isPlatformAdmin) {
    return <>{children}</>
  }

  const tenants =
    dbUser?.roles
      .filter((r: any) => r.tenant)
      .map((r: any) => ({
        id: r.tenant!.id,
        name: r.tenant!.name,
        slug: r.tenant!.slug,
        role: r.role,
      })) || []

  const impersonating = isImpersonating()
  const userName = [dbUser.firstName, dbUser.lastName].filter(Boolean).join(" ") || "User"
  const userEmail = dbUser.email
  const userInitials =
    [dbUser.firstName?.[0], dbUser.lastName?.[0]].filter(Boolean).join("").toUpperCase() || "U"
  const primaryTenantName = tenants[0]?.name || "Platform"
  const primaryRole = roles[0] || "Member"

  return (
    <div className="bg-ink-50 text-ink-950 flex min-h-screen flex-col">
      {impersonating && <ImpersonationBanner userName={userName} />}

      <nav className="border-ink-100 border-b bg-white/95 backdrop-blur">
        <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <MobileNav roles={roles} tenants={tenants} />
            <Link href="/dashboard" className="hidden items-center gap-2 sm:inline-flex lg:hidden">
              <span className="bg-play-600 shadow-play-200 flex h-8 w-8 items-center justify-center rounded-xl text-white shadow-sm">
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 2c0 5.5 2 8.5 10 10M12 22c0-5.5-2-8.5-10-10" />
                </svg>
              </span>
              <span className="font-display text-ink-950 text-sm font-bold">sportshub</span>
            </Link>
            <div className="hidden items-center gap-2 text-sm sm:flex">
              <span className="text-ink-400">Dashboard</span>
              <svg
                viewBox="0 0 24 24"
                className="text-ink-300 h-3 w-3"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="m9 18 6-6-6-6" />
              </svg>
              <span className="text-ink-700 font-medium">{primaryTenantName}</span>
            </div>
          </div>

          <div className="hidden min-w-0 flex-1 items-center justify-center lg:flex">
            <button className="border-ink-200 bg-ink-50 text-ink-400 hover:border-ink-300 flex min-w-[300px] items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm transition hover:bg-white">
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <span>Search...</span>
              <kbd className="border-ink-200 text-ink-400 ml-auto rounded border bg-white px-1.5 py-0.5 font-mono text-[10px]">
                /
              </kbd>
            </button>
          </div>

          <div className="flex items-center gap-2 md:gap-3">
            <Link
              href="/"
              className="border-ink-200 text-ink-500 hover:bg-ink-50 hover:text-ink-950 hidden rounded-2xl border bg-white p-2 transition md:inline-flex"
            >
              <svg
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-2.82.33v.16a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15v-.16a2 2 0 0 1 4 0v.09c.08.63.5 1.16 1.08 1.41" />
              </svg>
            </Link>
            <NotificationBell />
            <UserMenu userName={userName} userEmail={userEmail} userInitials={userInitials} />
          </div>
        </div>
      </nav>

      <div className="flex flex-1">
        <Sidebar
          roles={roles}
          tenants={tenants}
          userName={userName}
          userInitials={userInitials}
          primaryRole={primaryRole}
        />
        <main className="bg-ink-50 min-w-0 flex-1 overflow-x-hidden">{children}</main>
      </div>
    </div>
  )
}
