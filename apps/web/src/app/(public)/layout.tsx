import Link from "next/link"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getPublicNav } from "@/lib/queries/nav"
import { NavDropdown } from "@/components/nav-dropdown"
import { NotificationBell } from "../(platform)/dashboard/notification-bell"
import { UserMenu } from "../(platform)/dashboard/user-menu"
import { AuthLink } from "@/components/auth-link"

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  let isLoggedIn = false
  let userId: string | null = null
  let userName = "User"
  let userEmail = ""
  let userInitials = "U"

  try {
    const session = await getServerSession(authOptions)
    if (session?.user) {
      isLoggedIn = true
      userId = (session.user as any).id ?? null
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

  const nav = await getPublicNav(userId)

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
              href="/scores"
              className="text-ink-600 hover:bg-ink-50 hover:text-ink-950 rounded-lg px-3.5 py-1.5 text-[13px] font-medium transition-colors"
            >
              Scores
            </Link>
            <NavDropdown
              label="Leagues"
              myLabel="My leagues"
              myEntries={nav.myLeagues}
              allLabel="Active leagues"
              allEntries={nav.otherLeagues}
              browseHref="/leagues"
              browseLabel="Browse all leagues"
            />
            <NavDropdown
              label="Clubs"
              myLabel="My clubs"
              myEntries={nav.myClubs}
              allLabel="Featured clubs"
              allEntries={nav.otherClubs}
              browseHref="/club"
              browseLabel="Browse all clubs"
            />
            <Link
              href="/news"
              className="text-ink-600 hover:bg-ink-50 hover:text-ink-950 rounded-lg px-3.5 py-1.5 text-[13px] font-medium transition-colors"
            >
              News
            </Link>
            <Link
              href="/events"
              className="text-ink-600 hover:bg-ink-50 hover:text-ink-950 rounded-lg px-3.5 py-1.5 text-[13px] font-medium transition-colors"
            >
              Programs
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
                {nav.isOperator && (
                  <Link
                    href="/dashboard"
                    className="bg-ink-950 hover:bg-ink-800 hidden items-center gap-1.5 rounded-xl px-4 py-2 text-[13px] font-semibold text-white transition-colors sm:inline-flex"
                  >
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                    </svg>
                    Manage
                  </Link>
                )}
                <NotificationBell />
                <UserMenu userName={userName} userEmail={userEmail} userInitials={userInitials} />
              </>
            ) : (
              <>
                <AuthLink
                  to="sign-in"
                  className="text-ink-600 hover:text-ink-950 px-3 py-1.5 text-[13px] font-medium transition-colors"
                >
                  Log in
                </AuthLink>
                <AuthLink
                  to="sign-up"
                  className="bg-ink-950 hover:bg-ink-800 inline-flex items-center rounded-xl px-4 py-2 text-[13px] font-semibold text-white transition-colors"
                >
                  Start Free
                </AuthLink>
              </>
            )}
          </div>
        </div>

        <div className="border-ink-100 border-t px-4 py-2 md:hidden">
          <div className="flex gap-2 overflow-x-auto">
            <Link
              href="/scores"
              className="text-ink-600 ring-ink-200 hover:bg-ink-50 hover:text-ink-950 whitespace-nowrap rounded-full bg-white px-3 py-1.5 text-xs font-medium ring-1 transition-colors"
            >
              Scores
            </Link>
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
              href="/leagues"
              className="text-ink-600 ring-ink-200 hover:bg-ink-50 hover:text-ink-950 whitespace-nowrap rounded-full bg-white px-3 py-1.5 text-xs font-medium ring-1 transition-colors"
            >
              Leagues
            </Link>
            <Link
              href="/news"
              className="text-ink-600 ring-ink-200 hover:bg-ink-50 hover:text-ink-950 whitespace-nowrap rounded-full bg-white px-3 py-1.5 text-xs font-medium ring-1 transition-colors"
            >
              News
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
              <Link href="/leagues" className="block transition-colors hover:text-white">
                Leagues
              </Link>
              <Link href="/news" className="block transition-colors hover:text-white">
                News
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
              {isLoggedIn ? (
                <>
                  <Link href="/scores" className="block transition-colors hover:text-white">
                    Scores
                  </Link>
                  {nav.isOperator && (
                    <Link href="/dashboard" className="block transition-colors hover:text-white">
                      Manage
                    </Link>
                  )}
                  <Link href="/settings/profile" className="block transition-colors hover:text-white">
                    Account
                  </Link>
                </>
              ) : (
                <>
                  <Link href="/sign-up" className="block transition-colors hover:text-white">
                    Create account
                  </Link>
                  <Link href="/sign-in" className="block transition-colors hover:text-white">
                    Sign in
                  </Link>
                </>
              )}
            </div>
          </div>

          <div>
            <h3 className="text-ink-400 mb-4 text-sm font-semibold uppercase tracking-[0.18em]">
              Company
            </h3>
            <div className="text-ink-300 space-y-3 text-sm">
              <Link href="/for-clubs" className="block transition-colors hover:text-white">
                For clubs
              </Link>
              <Link href="/for-leagues" className="block transition-colors hover:text-white">
                For leagues
              </Link>
              <Link href="/news" className="block transition-colors hover:text-white">
                News
              </Link>
            </div>
          </div>
        </div>

        <div className="text-ink-400 container mx-auto mt-10 border-t border-white/5 px-4 pt-6 text-sm sm:px-6">
          &copy; {new Date().getFullYear()} Youth Basketball Hub. All rights reserved.
        </div>
      </footer>
    </main>
  )
}
