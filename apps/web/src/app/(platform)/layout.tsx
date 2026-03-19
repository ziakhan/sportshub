import { redirect } from "next/navigation"
import Link from "next/link"
import { getCurrentUser, isImpersonating } from "@/lib/auth-helpers"
import { Sidebar } from "./dashboard/sidebar"
import { MobileNav } from "./dashboard/mobile-nav"
import { NotificationBell } from "./dashboard/notification-bell"
import { UserMenu } from "./dashboard/user-menu"
import { ImpersonationBanner } from "./dashboard/impersonation-banner"

export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const dbUser = await getCurrentUser()

  if (!dbUser) {
    redirect("/sign-in")
  }

  // If user hasn't onboarded, show content without nav chrome
  // (onboarding page handles its own flow)
  if (!dbUser.onboardedAt) {
    return <>{children}</>
  }

  const roles = dbUser.roles.map((r) => r.role)
  const tenants =
    dbUser?.roles
      .filter((r) => r.tenant)
      .map((r) => ({
        id: r.tenant!.id,
        name: r.tenant!.name,
        slug: r.tenant!.slug,
        role: r.role,
      })) || []

  const impersonating = isImpersonating()
  const userName = [dbUser.firstName, dbUser.lastName].filter(Boolean).join(" ") || "User"
  const userEmail = dbUser.email
  const userInitials = [dbUser.firstName?.[0], dbUser.lastName?.[0]]
    .filter(Boolean)
    .join("")
    .toUpperCase() || "U"

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Impersonation banner */}
      {impersonating && <ImpersonationBanner userName={userName} />}

      {/* Top nav */}
      <nav className="border-b bg-white">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <MobileNav roles={roles} tenants={tenants} />
            <Link href="/dashboard" className="text-lg font-bold text-blue-600 md:text-xl">
              Youth Basketball Hub
            </Link>
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            <NotificationBell />
            <UserMenu
              userName={userName}
              userEmail={userEmail}
              userInitials={userInitials}
            />
          </div>
        </div>
      </nav>

      {/* Sidebar + content */}
      <div className="flex">
        <Sidebar roles={roles} tenants={tenants} />
        <main className="flex-1">{children}</main>
      </div>
    </div>
  )
}
