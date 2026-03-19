import Link from "next/link"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@youthbasketballhub/db"
import { NotificationBell } from "../(platform)/dashboard/notification-bell"
import { UserMenu } from "../(platform)/dashboard/user-menu"

async function getUserInfo(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { firstName: true, lastName: true, email: true },
  })
  if (!user) return null
  return {
    name: [user.firstName, user.lastName].filter(Boolean).join(" ") || "User",
    email: user.email,
    initials: [user.firstName?.[0], user.lastName?.[0]]
      .filter(Boolean).join("").toUpperCase() || "U",
  }
}

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  let session = null
  let userInfo = null
  try {
    session = await getServerSession(authOptions)
    if (session?.user?.id) {
      userInfo = await getUserInfo(session.user.id)
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
              href="/marketplace"
              className="hidden text-gray-600 hover:text-gray-900 sm:block"
            >
              Tryouts
            </Link>
            <Link
              href="/club"
              className="hidden text-gray-600 hover:text-gray-900 sm:block"
            >
              Clubs
            </Link>
            {session && userInfo ? (
              <>
                <Link
                  href="/dashboard"
                  className="hidden text-sm text-gray-600 hover:text-gray-900 sm:block"
                >
                  Dashboard
                </Link>
                <NotificationBell />
                <UserMenu
                  userName={userInfo.name}
                  userEmail={userInfo.email}
                  userInitials={userInfo.initials}
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
