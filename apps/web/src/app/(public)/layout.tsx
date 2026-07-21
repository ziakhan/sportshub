import Link from "next/link"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getPublicNav } from "@/lib/queries/nav"
import { NavDropdown } from "@/components/nav-dropdown"
import { NotificationBell } from "../(platform)/dashboard/notification-bell"
import { AccountMenu } from "@/components/nav/account-menu"
import { AnonymousBottomTabs, BottomTabs } from "@/components/nav/bottom-tabs"
import { QuickIcons } from "@/components/nav/quick-icons"
import { getNavShape, operatorTabLabel, EMPTY_NAV_SHAPE } from "@/lib/queries/nav-shape"
import { AuthLink } from "@/components/auth-link"
import { ChatDock } from "@/components/chat-dock"
import { OverflowStrip } from "@/components/overflow-strip"
import { SectionPills } from "@/components/public/section-pills"
import { BrandWordmark } from "@/components/brand/wordmark"

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

  const [nav, shape] = await Promise.all([
    getPublicNav(userId),
    userId ? getNavShape(userId) : Promise.resolve(EMPTY_NAV_SHAPE),
  ])

  return (
    <main
      className="text-ink-950 flex min-h-screen flex-col bg-[#fafafa] pb-16 lg:pb-0"
    >
      <header className="border-ink-100 sticky top-0 z-50 border-b bg-white/80 backdrop-blur-xl">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:h-[72px]">
          <Link href="/" className="flex items-center">
            {/* Full-size lockup needs the desktop bar; phones get the md cut
                so the logo, Log in and Start Free stop crowding 390px. */}
            <span className="lg:hidden">
              <BrandWordmark size="md" variant="color" />
            </span>
            <span className="hidden lg:inline-flex">
              <BrandWordmark size="lg" variant="color" />
            </span>
          </Link>

          {/* lg, not md: at 768–1023px this nav + logo + account buttons don't
              fit (worse logged-in) and overflow the viewport — tablets get
              the scrollable pill row instead. */}
          <nav className="hidden items-center gap-1 lg:flex">
            <Link
              href="/scores"
              className="text-ink-600 hover:bg-ink-50 hover:text-ink-950 rounded-lg px-4 py-2 text-[15px] font-medium transition-colors"
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
              className="text-ink-600 hover:bg-ink-50 hover:text-ink-950 rounded-lg px-4 py-2 text-[15px] font-medium transition-colors"
            >
              News
            </Link>
            <Link
              href="/events"
              className="text-ink-600 hover:bg-ink-50 hover:text-ink-950 rounded-lg px-4 py-2 text-[15px] font-medium transition-colors"
            >
              Programs
            </Link>
            <Link
              href="/events"
              className="text-ink-600 hover:bg-ink-50 hover:text-ink-950 rounded-lg px-4 py-2 text-[15px] font-medium transition-colors"
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
                    className="bg-ink-950 hover:bg-ink-800 hidden items-center gap-1.5 rounded-xl px-4 py-2 text-[15px] font-semibold text-white transition-colors sm:inline-flex"
                  >
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                    </svg>
                    {operatorTabLabel(shape)}
                  </Link>
                )}
                <QuickIcons showCalendar={shape.hasCalendar} />
                {/* Bell is desktop-only — on phones it folds into the badge */}
                <div className="hidden md:block">
                  <NotificationBell />
                </div>
                <AccountMenu
                  userName={userName}
                  userEmail={userEmail}
                  userInitials={userInitials}
                  shape={shape}
                />
              </>
            ) : (
              <>
                <AuthLink
                  to="sign-in"
                  className="text-ink-600 hover:text-ink-950 px-2.5 py-1.5 text-sm font-medium transition-colors lg:px-3.5 lg:py-2 lg:text-[15px]"
                >
                  Log in
                </AuthLink>
                <AuthLink
                  to="sign-up"
                  className="bg-ink-950 hover:bg-ink-800 inline-flex items-center rounded-xl px-3.5 py-2 text-sm font-semibold text-white transition-colors lg:px-5 lg:py-2.5 lg:text-[15px]"
                >
                  Start Free
                </AuthLink>
              </>
            )}
          </div>
        </div>

        <div className="border-ink-100 border-t px-4 py-2 lg:hidden">
          <OverflowStrip className="gap-2">
            <SectionPills />
          </OverflowStrip>
        </div>
      </header>

      {children}

      <footer className="bg-ink-950 mt-auto border-t border-white/5 py-14 text-white">
        <div className="container mx-auto grid gap-10 px-4 sm:px-6 lg:grid-cols-[1.5fr_repeat(3,1fr)]">
          <div className="max-w-sm">
            <div className="mb-4 flex items-center">
              <BrandWordmark size="md" variant="reverse" />
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
              <Link href="/events" className="block transition-colors hover:text-white">
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
                  {(nav.isOperator || nav.isFamily) && (
                    <Link href="/dashboard" className="block transition-colors hover:text-white">
                      {nav.isOperator ? "Manage" : "My Hub"}
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
              <Link href="/legal/privacy" className="block transition-colors hover:text-white">
                Privacy
              </Link>
              <Link href="/legal/terms" className="block transition-colors hover:text-white">
                Terms
              </Link>
              <Link href="/legal" className="block transition-colors hover:text-white">
                Legal &amp; policies
              </Link>
            </div>
          </div>
        </div>

        <div className="container mx-auto mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-white/5 px-4 pt-6 text-sm sm:px-6">
          <span className="text-ink-400">
            &copy; 2019&ndash;{new Date().getFullYear()} SportsHub One. All rights reserved.
          </span>
          <span className="text-ink-400 flex flex-wrap gap-x-4 gap-y-1">
            <Link href="/legal/privacy" className="transition-colors hover:text-white">
              Privacy
            </Link>
            <Link href="/legal/terms" className="transition-colors hover:text-white">
              Terms
            </Link>
            <Link href="/legal/acceptable-use" className="transition-colors hover:text-white">
              Acceptable Use
            </Link>
          </span>
        </div>
      </footer>
      {userId && (
        <div className="hidden lg:block">
          <ChatDock userId={userId} />
        </div>
      )}
      {isLoggedIn ? <BottomTabs shape={shape} /> : <AnonymousBottomTabs />}
    </main>
  )
}
