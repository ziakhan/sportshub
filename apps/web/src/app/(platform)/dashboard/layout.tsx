import { redirect } from "next/navigation"
import Link from "next/link"
import { getCurrentUser } from "@/lib/auth-helpers"
import { Sidebar } from "./sidebar"
import { NotificationBell } from "./notification-bell"
import { UserMenu } from "./user-menu"

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
      })) || []

  const userName = [dbUser.firstName, dbUser.lastName].filter(Boolean).join(" ") || "User"
  const userEmail = dbUser.email
  const userInitials = [dbUser.firstName?.[0], dbUser.lastName?.[0]]
    .filter(Boolean)
    .join("")
    .toUpperCase() || "U"

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top nav */}
      <nav className="border-b bg-white">
        <div className="flex items-center justify-between px-4 py-3">
          <Link href="/dashboard" className="text-xl font-bold text-blue-600">
            Youth Basketball Hub
          </Link>
          <div className="flex items-center gap-3">
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
