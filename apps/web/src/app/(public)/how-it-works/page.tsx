import Link from "next/link"

export const metadata = {
  title: "How It Works | SportsHub One",
  alternates: { canonical: "/how-it-works" },
  description:
    "A guided walkthrough of the whole season is being rebuilt. In the meantime, see what clubs, leagues and families get.",
}

export default function HowItWorksPage() {
  return (
    <section className="mesh-surface bg-[#fafafa] py-24">
      <div className="container mx-auto px-4 text-center sm:px-6">
        <h1 className="font-display text-ink-950 mb-4 text-4xl font-extrabold">
          The guided walkthrough is getting a rebuild.
        </h1>
        <p className="text-ink-500 mx-auto mb-8 max-w-xl text-lg leading-8">
          A better one is on the way. Until then, here is what the platform does for each side of
          the gym.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link href="/for-clubs" className="bg-ink-950 rounded-2xl px-6 py-3 text-sm font-semibold text-white">
            For clubs
          </Link>
          <Link href="/for-leagues" className="bg-ink-950 rounded-2xl px-6 py-3 text-sm font-semibold text-white">
            For leagues
          </Link>
          <Link href="/for-parents" className="border-ink-200 text-ink-700 rounded-2xl border bg-white px-6 py-3 text-sm font-semibold">
            For parents
          </Link>
        </div>
      </div>
    </section>
  )
}
