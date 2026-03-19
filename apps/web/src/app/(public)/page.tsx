import Link from "next/link"
import { prisma } from "@youthbasketballhub/db"
import { ClubSearch } from "./club-search"

async function getFeaturedClubs() {
  const clubs = await prisma.tenant.findMany({
    where: { status: { in: ["ACTIVE", "UNCLAIMED"] } },
    select: {
      id: true,
      slug: true,
      name: true,
      city: true,
      state: true,
      country: true,
      description: true,
      status: true,
      branding: { select: { primaryColor: true, logoUrl: true } },
      _count: { select: { teams: true, tryouts: true } },
    },
    orderBy: { teams: { _count: "desc" } },
    take: 6,
  })
  return clubs
}

export default async function HomePage() {
  const featuredClubs = await getFeaturedClubs()

  return (
    <>
      {/* Hero Section */}
      <section className="bg-gradient-to-b from-blue-50 to-white">
        <div className="container mx-auto px-4 py-20 text-center">
          <h1 className="mb-6 text-5xl font-bold text-gray-900 md:text-6xl">
            The All-in-One Platform for
            <span className="text-blue-600"> Youth Basketball</span>
          </h1>
          <p className="mx-auto mb-10 max-w-3xl text-xl text-gray-600">
            Find clubs, browse tryouts, manage teams, and connect with the basketball
            community — all in one place.
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

      {/* Club Discovery */}
      <section className="bg-white py-16">
        <div className="container mx-auto px-4">
          <h2 className="mb-2 text-center text-3xl font-bold text-gray-900">
            Find a Basketball Club
          </h2>
          <p className="mx-auto mb-8 max-w-2xl text-center text-gray-600">
            Search by club name or city to find programs near you.
          </p>
          <ClubSearch />
        </div>
      </section>

      {/* Featured Clubs */}
      {featuredClubs.length > 0 && (
        <section className="bg-gray-50 py-16">
          <div className="container mx-auto px-4">
            <h2 className="mb-8 text-center text-3xl font-bold text-gray-900">
              Featured Clubs
            </h2>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {featuredClubs.map((club) => (
                <Link
                  key={club.id}
                  href={`/club/${club.slug}`}
                  className="rounded-lg border border-gray-200 bg-white overflow-hidden shadow-sm transition hover:shadow-md"
                >
                  <div
                    className="h-3"
                    style={{ backgroundColor: club.branding?.primaryColor || "#1a73e8" }}
                  />
                  <div className="p-6">
                    <div className="mb-2">
                      <h3 className="text-lg font-bold text-gray-900">{club.name}</h3>
                    </div>
                    <p className="text-sm text-gray-500 mb-3">
                      {[club.city, club.state].filter(Boolean).join(", ")}
                    </p>
                    {club.description && (
                      <p className="text-sm text-gray-600 line-clamp-2 mb-3">{club.description}</p>
                    )}
                    <div className="flex gap-4 text-xs text-gray-500">
                      <span>{club._count.teams} teams</span>
                      <span>{club._count.tryouts} tryouts</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            <div className="mt-8 text-center">
              <Link
                href="/club"
                className="text-blue-600 font-semibold hover:underline"
              >
                View All Clubs &rarr;
              </Link>
            </div>
          </div>
        </section>
      )}

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
            <div className="rounded-xl border-t-4 border-blue-500 bg-white p-8 shadow-md">
              <h3 className="mb-3 text-2xl font-bold text-gray-900">Parents &amp; Families</h3>
              <p className="mb-4 text-gray-600">Find the perfect club and team for your child.</p>
              <ul className="space-y-2 text-gray-700">
                <li className="flex items-start gap-2"><span className="mt-1 text-blue-500">&#10003;</span>Browse tryouts by age group and location</li>
                <li className="flex items-start gap-2"><span className="mt-1 text-blue-500">&#10003;</span>Register and pay online</li>
                <li className="flex items-start gap-2"><span className="mt-1 text-blue-500">&#10003;</span>Track schedule, games, and stats</li>
              </ul>
            </div>
            <div className="rounded-xl border-t-4 border-green-500 bg-white p-8 shadow-md">
              <h3 className="mb-3 text-2xl font-bold text-gray-900">Club Owners &amp; Managers</h3>
              <p className="mb-4 text-gray-600">Run your club with powerful management tools.</p>
              <ul className="space-y-2 text-gray-700">
                <li className="flex items-start gap-2"><span className="mt-1 text-green-500">&#10003;</span>Create and organize teams by age group</li>
                <li className="flex items-start gap-2"><span className="mt-1 text-green-500">&#10003;</span>Publish tryouts for families to find</li>
                <li className="flex items-start gap-2"><span className="mt-1 text-green-500">&#10003;</span>Accept payments online with Stripe</li>
              </ul>
            </div>
            <div className="rounded-xl border-t-4 border-orange-500 bg-white p-8 shadow-md">
              <h3 className="mb-3 text-2xl font-bold text-gray-900">Referees</h3>
              <p className="mb-4 text-gray-600">Get booked for games on your schedule.</p>
              <ul className="space-y-2 text-gray-700">
                <li className="flex items-start gap-2"><span className="mt-1 text-orange-500">&#10003;</span>Set your availability and certification</li>
                <li className="flex items-start gap-2"><span className="mt-1 text-orange-500">&#10003;</span>Get assigned to local games</li>
                <li className="flex items-start gap-2"><span className="mt-1 text-orange-500">&#10003;</span>Track earnings and game history</li>
              </ul>
            </div>
            <div className="rounded-xl border-t-4 border-purple-500 bg-white p-8 shadow-md">
              <h3 className="mb-3 text-2xl font-bold text-gray-900">League Organizers</h3>
              <p className="mb-4 text-gray-600">Organize competitions effortlessly.</p>
              <ul className="space-y-2 text-gray-700">
                <li className="flex items-start gap-2"><span className="mt-1 text-purple-500">&#10003;</span>Create divisions by age group and gender</li>
                <li className="flex items-start gap-2"><span className="mt-1 text-purple-500">&#10003;</span>Schedule games and assign referees</li>
                <li className="flex items-start gap-2"><span className="mt-1 text-purple-500">&#10003;</span>Track standings and player stats live</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-blue-600 py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="mb-4 text-3xl font-bold text-white">Ready to Get Started?</h2>
          <p className="mx-auto mb-8 max-w-xl text-lg text-blue-100">
            Join clubs, staff, and families already using Youth Basketball Hub.
          </p>
          <Link
            href="/sign-up"
            className="inline-block rounded-lg bg-white px-8 py-4 text-lg font-semibold text-blue-600 hover:bg-blue-50"
          >
            Create Your Free Account
          </Link>
        </div>
      </section>
    </>
  )
}
