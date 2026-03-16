import Link from "next/link"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"

export default async function Home() {
  const session = await getServerSession(authOptions)

  // If logged in, go straight to dashboard
  if (session) {
    redirect("/dashboard")
  }

  return (
    <main className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <h2 className="text-2xl font-bold text-blue-600">
            Youth Basketball Hub
          </h2>
          <nav className="flex items-center gap-4">
            <Link
              href="/marketplace"
              className="text-gray-600 hover:text-gray-900"
            >
              Browse Tryouts
            </Link>
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
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-b from-blue-50 to-white">
        <div className="container mx-auto px-4 py-20 text-center">
          <h1 className="mb-6 text-5xl font-bold text-gray-900 md:text-6xl">
            The All-in-One Platform for
            <span className="text-blue-600"> Youth Basketball</span>
          </h1>
          <p className="mx-auto mb-10 max-w-3xl text-xl text-gray-600">
            Whether you&apos;re a parent finding tryouts, a club managing teams,
            a referee booking games, or a league organizer running
            competitions — we&apos;ve got you covered.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link
              href="/sign-up"
              className="rounded-lg bg-blue-600 px-8 py-4 text-lg font-semibold text-white hover:bg-blue-700"
            >
              Get Started Free
            </Link>
            <Link
              href="/marketplace"
              className="rounded-lg border-2 border-blue-600 px-8 py-4 text-lg font-semibold text-blue-600 hover:bg-blue-50"
            >
              Browse Tryouts
            </Link>
          </div>
        </div>
      </section>

      {/* Audience Cards */}
      <section className="bg-white py-20">
        <div className="container mx-auto px-4">
          <h2 className="mb-4 text-center text-3xl font-bold text-gray-900">
            Built for Everyone in Youth Basketball
          </h2>
          <p className="mx-auto mb-12 max-w-2xl text-center text-gray-600">
            No matter your role, Youth Basketball Hub gives you the tools to
            stay organized and connected.
          </p>

          <div className="grid gap-8 md:grid-cols-2">
            {/* Parents & Families */}
            <div className="rounded-xl border-t-4 border-blue-500 bg-white p-8 shadow-md">
              <div className="mb-4 text-4xl">👨‍👩‍👧‍👦</div>
              <h3 className="mb-3 text-2xl font-bold text-gray-900">
                Parents & Families
              </h3>
              <p className="mb-4 text-gray-600">
                Find the perfect club and team for your child.
              </p>
              <ul className="space-y-2 text-gray-700">
                <li className="flex items-start gap-2">
                  <span className="mt-1 text-blue-500">&#10003;</span>
                  Browse tryouts by age group and location
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 text-blue-500">&#10003;</span>
                  Register and pay online — no more paper forms
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 text-blue-500">&#10003;</span>
                  Track your child&apos;s schedule, games, and stats
                </li>
              </ul>
            </div>

            {/* Club Owners */}
            <div className="rounded-xl border-t-4 border-green-500 bg-white p-8 shadow-md">
              <div className="mb-4 text-4xl">🏀</div>
              <h3 className="mb-3 text-2xl font-bold text-gray-900">
                Club Owners & Managers
              </h3>
              <p className="mb-4 text-gray-600">
                Run your club like a pro with powerful management tools.
              </p>
              <ul className="space-y-2 text-gray-700">
                <li className="flex items-start gap-2">
                  <span className="mt-1 text-green-500">&#10003;</span>
                  Create and organize teams by age group and season
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 text-green-500">&#10003;</span>
                  Publish tryouts to our marketplace for families to find
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 text-green-500">&#10003;</span>
                  Accept payments online with Stripe integration
                </li>
              </ul>
            </div>

            {/* Referees */}
            <div className="rounded-xl border-t-4 border-orange-500 bg-white p-8 shadow-md">
              <div className="mb-4 text-4xl">🏁</div>
              <h3 className="mb-3 text-2xl font-bold text-gray-900">
                Referees
              </h3>
              <p className="mb-4 text-gray-600">
                Get booked for games you want, on your schedule.
              </p>
              <ul className="space-y-2 text-gray-700">
                <li className="flex items-start gap-2">
                  <span className="mt-1 text-orange-500">&#10003;</span>
                  Set your availability and certification level
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 text-orange-500">&#10003;</span>
                  Get assigned to local games automatically
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 text-orange-500">&#10003;</span>
                  Track your earnings and game history
                </li>
              </ul>
            </div>

            {/* League Organizers */}
            <div className="rounded-xl border-t-4 border-purple-500 bg-white p-8 shadow-md">
              <div className="mb-4 text-4xl">🏆</div>
              <h3 className="mb-3 text-2xl font-bold text-gray-900">
                League Organizers
              </h3>
              <p className="mb-4 text-gray-600">
                Organize competitions effortlessly from start to finish.
              </p>
              <ul className="space-y-2 text-gray-700">
                <li className="flex items-start gap-2">
                  <span className="mt-1 text-purple-500">&#10003;</span>
                  Create divisions by age group and gender
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 text-purple-500">&#10003;</span>
                  Schedule games and assign referees
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 text-purple-500">&#10003;</span>
                  Track standings, scores, and player stats live
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="bg-gray-50 py-20">
        <div className="container mx-auto px-4">
          <h2 className="mb-12 text-center text-3xl font-bold text-gray-900">
            How It Works
          </h2>
          <div className="mx-auto grid max-w-4xl gap-8 md:grid-cols-3">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-2xl font-bold text-blue-600">
                1
              </div>
              <h3 className="mb-2 text-xl font-semibold text-gray-900">
                Create Your Account
              </h3>
              <p className="text-gray-600">
                Sign up for free in 30 seconds with email or Google.
              </p>
            </div>
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-2xl font-bold text-blue-600">
                2
              </div>
              <h3 className="mb-2 text-xl font-semibold text-gray-900">
                Tell Us Who You Are
              </h3>
              <p className="text-gray-600">
                Select your roles — parent, club owner, staff, referee, or all
                of the above.
              </p>
            </div>
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-2xl font-bold text-blue-600">
                3
              </div>
              <h3 className="mb-2 text-xl font-semibold text-gray-900">
                Get Started
              </h3>
              <p className="text-gray-600">
                Access your personalized dashboard with tools for every role you
                hold.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="bg-blue-600 py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="mb-4 text-3xl font-bold text-white">
            Ready to Get Started?
          </h2>
          <p className="mx-auto mb-8 max-w-xl text-lg text-blue-100">
            Join clubs, staff, and families already using Youth Basketball Hub
            to organize their seasons.
          </p>
          <Link
            href="/sign-up"
            className="inline-block rounded-lg bg-white px-8 py-4 text-lg font-semibold text-blue-600 hover:bg-blue-50"
          >
            Create Your Free Account
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-white py-8">
        <div className="container mx-auto px-4 text-center text-sm text-gray-500">
          &copy; {new Date().getFullYear()} Youth Basketball Hub. All rights
          reserved.
        </div>
      </footer>
    </main>
  )
}
