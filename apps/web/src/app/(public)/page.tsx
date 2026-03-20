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
      {/* Hero Section — dark navy */}
      <section className="relative bg-navy-950 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-navy-900 via-navy-950 to-navy-900" />
        <div className="relative container mx-auto px-4 py-24 text-center md:py-32">
          <div className="mb-6 inline-block rounded-full bg-orange-500/20 px-4 py-1.5 text-sm font-semibold text-orange-400">
            YOUTH BASKETBALL HUB
          </div>
          <h1 className="mb-6 text-5xl font-extrabold tracking-tight text-white md:text-6xl lg:text-7xl">
            THE ALL-IN-ONE{" "}
            <br className="hidden md:block" />
            PLATFORM FOR{" "}
            <span className="text-orange-400">YOUTH BASKETBALL</span>
          </h1>
          <p className="mx-auto mb-10 max-w-3xl text-xl text-gray-300">
            Find clubs, browse tryouts, manage teams, and connect with the basketball
            community — all in one place.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link
              href="/sign-up"
              className="rounded-full bg-orange-500 px-8 py-4 text-lg font-semibold text-white hover:bg-orange-600 transition"
            >
              Get Started Free
            </Link>
            <Link
              href="/marketplace"
              className="rounded-full border-2 border-gray-500 px-8 py-4 text-lg font-semibold text-gray-300 hover:border-white hover:text-white transition"
            >
              Browse Tryouts
            </Link>
          </div>
        </div>
      </section>

      {/* Club Discovery — slightly lighter navy */}
      <section className="bg-navy-900 py-16">
        <div className="container mx-auto px-4">
          <h2 className="mb-2 text-center text-3xl font-bold text-white">
            Find a Basketball Club
          </h2>
          <p className="mx-auto mb-8 max-w-2xl text-center text-gray-400">
            Search by club name or city to find programs near you.
          </p>
          <ClubSearch />
        </div>
      </section>

      {/* Featured Clubs */}
      {featuredClubs.length > 0 && (
        <section className="bg-navy-950 py-16">
          <div className="container mx-auto px-4">
            <h2 className="mb-8 text-center text-3xl font-bold text-white">
              Featured Clubs
            </h2>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {featuredClubs.map((club: any) => (
                <Link
                  key={club.id}
                  href={`/club/${club.slug}`}
                  className="rounded-lg border border-navy-700 bg-navy-800 overflow-hidden shadow-sm transition hover:border-orange-500/50 hover:shadow-lg"
                >
                  <div
                    className="h-1.5"
                    style={{ backgroundColor: club.branding?.primaryColor || "#f97316" }}
                  />
                  <div className="p-6">
                    <h3 className="text-lg font-bold text-white">{club.name}</h3>
                    <p className="text-sm text-gray-400 mb-3">
                      {[club.city, club.state].filter(Boolean).join(", ")}
                    </p>
                    {club.description && (
                      <p className="text-sm text-gray-300 line-clamp-2 mb-3">{club.description}</p>
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
                className="text-orange-400 font-semibold hover:text-orange-300"
              >
                View All Clubs &rarr;
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Audience Cards */}
      <section className="bg-navy-900 py-20">
        <div className="container mx-auto px-4">
          <h2 className="mb-4 text-center text-3xl font-bold text-white">
            Built for Everyone in Youth Basketball
          </h2>
          <p className="mx-auto mb-12 max-w-2xl text-center text-gray-400">
            No matter your role, Youth Basketball Hub gives you the tools to
            stay organized and connected.
          </p>
          <div className="grid gap-8 md:grid-cols-2">
            <div className="rounded-xl border border-navy-700 border-t-4 border-t-orange-500 bg-navy-800 p-8">
              <h3 className="mb-3 text-2xl font-bold text-white">Parents &amp; Families</h3>
              <p className="mb-4 text-gray-400">Find the perfect club and team for your child.</p>
              <ul className="space-y-2 text-gray-300">
                <li className="flex items-start gap-2"><span className="mt-1 text-orange-400">&#10003;</span>Browse tryouts by age group and location</li>
                <li className="flex items-start gap-2"><span className="mt-1 text-orange-400">&#10003;</span>Register and pay online</li>
                <li className="flex items-start gap-2"><span className="mt-1 text-orange-400">&#10003;</span>Track schedule, games, and stats</li>
              </ul>
            </div>
            <div className="rounded-xl border border-navy-700 border-t-4 border-t-green-500 bg-navy-800 p-8">
              <h3 className="mb-3 text-2xl font-bold text-white">Club Owners &amp; Managers</h3>
              <p className="mb-4 text-gray-400">Run your club with powerful management tools.</p>
              <ul className="space-y-2 text-gray-300">
                <li className="flex items-start gap-2"><span className="mt-1 text-green-400">&#10003;</span>Create and organize teams by age group</li>
                <li className="flex items-start gap-2"><span className="mt-1 text-green-400">&#10003;</span>Publish tryouts for families to find</li>
                <li className="flex items-start gap-2"><span className="mt-1 text-green-400">&#10003;</span>Accept payments online with Stripe</li>
              </ul>
            </div>
            <div className="rounded-xl border border-navy-700 border-t-4 border-t-orange-400 bg-navy-800 p-8">
              <h3 className="mb-3 text-2xl font-bold text-white">Referees</h3>
              <p className="mb-4 text-gray-400">Get booked for games on your schedule.</p>
              <ul className="space-y-2 text-gray-300">
                <li className="flex items-start gap-2"><span className="mt-1 text-orange-400">&#10003;</span>Set your availability and certification</li>
                <li className="flex items-start gap-2"><span className="mt-1 text-orange-400">&#10003;</span>Get assigned to local games</li>
                <li className="flex items-start gap-2"><span className="mt-1 text-orange-400">&#10003;</span>Track earnings and game history</li>
              </ul>
            </div>
            <div className="rounded-xl border border-navy-700 border-t-4 border-t-purple-500 bg-navy-800 p-8">
              <h3 className="mb-3 text-2xl font-bold text-white">League Organizers</h3>
              <p className="mb-4 text-gray-400">Organize competitions effortlessly.</p>
              <ul className="space-y-2 text-gray-300">
                <li className="flex items-start gap-2"><span className="mt-1 text-purple-400">&#10003;</span>Create divisions by age group and gender</li>
                <li className="flex items-start gap-2"><span className="mt-1 text-purple-400">&#10003;</span>Schedule games and assign referees</li>
                <li className="flex items-start gap-2"><span className="mt-1 text-purple-400">&#10003;</span>Track standings and player stats live</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-orange-500 py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="mb-4 text-3xl font-bold text-white">Ready to Get Started?</h2>
          <p className="mx-auto mb-8 max-w-xl text-lg text-orange-100">
            Join clubs, staff, and families already using Youth Basketball Hub.
          </p>
          <Link
            href="/sign-up"
            className="inline-block rounded-full bg-navy-900 px-8 py-4 text-lg font-semibold text-white hover:bg-navy-800 transition"
          >
            Create Your Free Account
          </Link>
        </div>
      </section>
    </>
  )
}
