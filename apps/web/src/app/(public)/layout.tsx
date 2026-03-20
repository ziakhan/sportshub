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
      {/* Header — dark navy */}
      <header className="border-b border-navy-700 bg-navy-950">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <Link href="/" className="text-2xl font-bold text-orange-400">
            Youth Basketball Hub
          </Link>
          <nav className="flex items-center gap-4">
            <Link
              href="/events"
              className="hidden text-gray-300 hover:text-white sm:block"
            >
              Events
            </Link>
            <Link
              href="/club"
              className="hidden text-gray-300 hover:text-white sm:block"
            >
              Clubs
            </Link>
            <Link
              href="/marketplace"
              className="hidden text-gray-300 hover:text-white sm:block"
            >
              Tryouts
            </Link>
            {isLoggedIn ? (
              <>
                <Link
                  href="/dashboard"
                  className="rounded-md border border-orange-500 px-4 py-2 text-sm font-medium text-orange-400 hover:bg-orange-500/10"
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
                  className="rounded-md px-4 py-2 text-gray-300 hover:text-white"
                >
                  Sign In
                </Link>
                <Link
                  href="/sign-up"
                  className="rounded-full bg-orange-500 px-5 py-2 font-semibold text-white hover:bg-orange-600"
                >
                  Sign Up Free
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      {children}

      {/* Footer — dark navy */}
      <footer className="border-t border-navy-800 bg-navy-950 py-8 mt-auto">
        <div className="container mx-auto px-4 text-center text-sm text-gray-400">
          &copy; {new Date().getFullYear()} Youth Basketball Hub. All rights reserved.
        </div>
      </footer>
    </main>
  )
}
