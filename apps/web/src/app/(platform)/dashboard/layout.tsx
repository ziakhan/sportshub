import { redirect } from "next/navigation"
import Link from "next/link"
import { getCurrentUser, isImpersonating, getRealUserId } from "@/lib/auth-helpers"
import { Sidebar } from "./sidebar"
import { MobileNav } from "./mobile-nav"
import { NotificationBell } from "./notification-bell"
import { UserMenu } from "./user-menu"
import { ImpersonationBanner } from "./impersonation-banner"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const dbUser = await getCurrentUser()

  if (!dbUser) {
    redirect("/sign-in")
  }

  // Redirect to onboarding if user hasn't completed it
  if (!dbUser.onboardedAt) {
    redirect("/onboarding")
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
        <main className="flex-1 p-6 md:p-8">{children}</main>
      </div>
    </div>
  )
}
