import Link from "next/link"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { NotificationBell } from "../(platform)/dashboard/notification-bell"
import { UserMenu } from "../(platform)/dashboard/user-menu"

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  let isLoggedIn = false
  let userName = "User"
  let userEmail = ""
  let userInitials = "U"

  try {
    const session = await getServerSession(authOptions)
    if (session?.user) {
      isLoggedIn = true
      userName = session.user.name || "User"
      userEmail = session.user.email || ""
      const parts = userName.split(" ")
      userInitials = parts.map((p) => p[0]).join("").toUpperCase().slice(0, 2) || "U"
    }
  } catch {
    // Session check failed — render as unauthenticated
  }

  return (
    <main className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <Link href="/" className="text-2xl font-bold text-blue-600">
            Youth Basketball Hub
          </Link>
          <nav className="flex items-center gap-4">
            <Link
              href="/events"
              className="hidden text-gray-600 hover:text-gray-900 sm:block"
            >
              Events
            </Link>
            <Link
              href="/club"
              className="hidden text-gray-600 hover:text-gray-900 sm:block"
            >
              Clubs
            </Link>
            {isLoggedIn ? (
              <>
                <Link
                  href="/dashboard"
                  className="rounded-md border border-blue-600 px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50"
                >
                  Dashboard
                </Link>
                <NotificationBell />
                <UserMenu
                  userName={userName}
                  userEmail={userEmail}
                  userInitials={userInitials}
                />
              </>
            ) : (
              <>
                <Link
                  href="/sign-in"
                  className="rounded-md px-4 py-2 text-gray-600 hover:text-gray-900"
                >
                  Sign In
                </Link>
                <Link
                  href="/sign-up"
                  className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                >
                  Get Started
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      {children}

      {/* Footer */}
      <footer className="border-t bg-white py-8 mt-auto">
        <div className="container mx-auto px-4 text-center text-sm text-gray-500">
          &copy; {new Date().getFullYear()} Youth Basketball Hub. All rights reserved.
        </div>
      </footer>
    </main>
  )
}
