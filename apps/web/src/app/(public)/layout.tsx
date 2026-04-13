import Link from "next/link"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { NotificationBell } from "../(platform)/dashboard/notification-bell"
import { UserMenu } from "../(platform)/dashboard/user-menu"

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
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
      userInitials =
        parts
          .map((p) => p[0])
          .join("")
          .toUpperCase()
          .slice(0, 2) || "U"
    }
  } catch {
    // Session check failed — render as unauthenticated
  }

  return (
    <main className="text-ink-950 flex min-h-screen flex-col bg-[#fafafa]">
      <header className="border-ink-100 sticky top-0 z-50 border-b bg-white/80 backdrop-blur-xl">
        <div className="container mx-auto flex h-[60px] items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="bg-play-600 shadow-play-200/70 flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-sm">
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 2c0 5.5 2 8.5 10 10M12 22c0-5.5-2-8.5 10-10M12 2c0 5.5-2 8.5-10 10M12 22c0-5.5-2-8.5-10-10" />
              </svg>
            </span>
            <span className="font-display text-ink-950 text-lg font-bold tracking-tight">
              sportshub
            </span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            <Link
              href="/events"
              className="text-ink-600 hover:bg-ink-50 hover:text-ink-950 rounded-lg px-3.5 py-1.5 text-[13px] font-medium transition-colors"
            >
              Programs
            </Link>
            <Link
              href="/club"
              className="text-ink-600 hover:bg-ink-50 hover:text-ink-950 rounded-lg px-3.5 py-1.5 text-[13px] font-medium transition-colors"
            >
              Clubs
            </Link>
            <Link
              href="/browse-leagues"
              className="text-ink-600 hover:bg-ink-50 hover:text-ink-950 rounded-lg px-3.5 py-1.5 text-[13px] font-medium transition-colors"
            >
              Leagues
            </Link>
            <Link
              href="/marketplace"
              className="text-ink-600 hover:bg-ink-50 hover:text-ink-950 rounded-lg px-3.5 py-1.5 text-[13px] font-medium transition-colors"
            >
              Marketplace
            </Link>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            {isLoggedIn ? (
              <>
                <Link
                  href="/dashboard"
                  className="border-ink-200 text-ink-700 hover:bg-ink-50 hidden rounded-xl border px-4 py-2 text-[13px] font-semibold transition-colors sm:inline-flex"
                >
                  Dashboard
                </Link>
                <NotificationBell />
                <UserMenu userName={userName} userEmail={userEmail} userInitials={userInitials} />
              </>
            ) : (
              <>
                <Link
                  href="/sign-in"
                  className="text-ink-600 hover:text-ink-950 px-3 py-1.5 text-[13px] font-medium transition-colors"
                >
                  Log in
                </Link>
                <Link
                  href="/sign-up"
                  className="bg-ink-950 hover:bg-ink-800 inline-flex items-center rounded-xl px-4 py-2 text-[13px] font-semibold text-white transition-colors"
                >
                  Start Free
                </Link>
              </>
            )}
          </div>
        </div>

        <div className="border-ink-100 border-t px-4 py-2 md:hidden">
          <div className="flex gap-2 overflow-x-auto">
            <Link
              href="/events"
              className="text-ink-600 ring-ink-200 hover:bg-ink-50 hover:text-ink-950 whitespace-nowrap rounded-full bg-white px-3 py-1.5 text-xs font-medium ring-1 transition-colors"
            >
              Programs
            </Link>
            <Link
              href="/club"
              className="text-ink-600 ring-ink-200 hover:bg-ink-50 hover:text-ink-950 whitespace-nowrap rounded-full bg-white px-3 py-1.5 text-xs font-medium ring-1 transition-colors"
            >
              Clubs
            </Link>
            <Link
              href="/browse-leagues"
              className="text-ink-600 ring-ink-200 hover:bg-ink-50 hover:text-ink-950 whitespace-nowrap rounded-full bg-white px-3 py-1.5 text-xs font-medium ring-1 transition-colors"
            >
              Leagues
            </Link>
            <Link
              href="/marketplace"
              className="text-ink-600 ring-ink-200 hover:bg-ink-50 hover:text-ink-950 whitespace-nowrap rounded-full bg-white px-3 py-1.5 text-xs font-medium ring-1 transition-colors"
            >
              Marketplace
            </Link>
          </div>
        </div>
      </header>

      {children}

      <footer className="bg-ink-950 mt-auto border-t border-white/5 py-14 text-white">
        <div className="container mx-auto grid gap-10 px-4 sm:px-6 lg:grid-cols-[1.5fr_repeat(3,1fr)]">
          <div className="max-w-sm">
            <div className="mb-4 flex items-center gap-2.5">
              <span className="bg-play-600 flex h-9 w-9 items-center justify-center rounded-xl text-white">
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 2c0 5.5 2 8.5 10 10M12 22c0-5.5-2-8.5 10-10M12 2c0 5.5-2 8.5-10 10M12 22c0-5.5-2-8.5-10-10" />
                </svg>
              </span>
              <span className="font-display text-lg font-bold tracking-tight">sportshub</span>
            </div>
            <p className="text-ink-300 text-sm leading-6">
              A modern operating system for youth basketball clubs, parents, players, and league
              organizers.
            </p>
          </div>

          <div>
            <h3 className="text-ink-400 mb-4 text-sm font-semibold uppercase tracking-[0.18em]">
              Explore
            </h3>
            <div className="text-ink-300 space-y-3 text-sm">
              <Link href="/events" className="block transition-colors hover:text-white">
                Programs
              </Link>
              <Link href="/club" className="block transition-colors hover:text-white">
                Clubs
              </Link>
              <Link href="/marketplace" className="block transition-colors hover:text-white">
                Marketplace
              </Link>
            </div>
          </div>

          <div>
            <h3 className="text-ink-400 mb-4 text-sm font-semibold uppercase tracking-[0.18em]">
              Platform
            </h3>
            <div className="text-ink-300 space-y-3 text-sm">
              <Link href="/sign-up" className="block transition-colors hover:text-white">
                Create account
              </Link>
              <Link href="/sign-in" className="block transition-colors hover:text-white">
                Sign in
              </Link>
              <Link href="/dashboard" className="block transition-colors hover:text-white">
                Dashboard
              </Link>
            </div>
          </div>

          <div>
            <h3 className="text-ink-400 mb-4 text-sm font-semibold uppercase tracking-[0.18em]">
              Company
            </h3>
            <p className="text-ink-300 text-sm leading-6">
              Built for the real workflows behind teams, tryouts, offers, payments, and club
              operations.
            </p>
          </div>
        </div>

        <div className="text-ink-400 container mx-auto mt-10 border-t border-white/5 px-4 pt-6 text-sm sm:px-6">
          &copy; {new Date().getFullYear()} Youth Basketball Hub. All rights reserved.
        </div>
      </footer>
    </main>
  )
}
