import Link from "next/link"
import { format } from "date-fns"
import { getPublicFeed } from "@/lib/queries/content"
import { NewsCard, SectionHeader } from "@/components/ui"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "News & Game Recaps — SportsHub",
  description:
    "The latest youth basketball news: game recaps, club announcements, and league updates.",
}

export default async function NewsIndexPage() {
  const items = await getPublicFeed(30)

  return (
    <div className="container mx-auto px-4 py-10 sm:px-6">
      <SectionHeader
        eyebrow="Around the hub"
        title="News & Game Recaps"
        description="Every scored game gets a story — plus announcements from clubs and leagues."
        accent="play"
        className="mb-10"
      />

      {items.length === 0 ? (
        <div className="border-ink-100 rounded-[28px] border bg-white p-12 text-center">
          <p className="text-ink-500">
            No stories yet — recaps publish automatically as games are scored.
          </p>
          <Link href="/" className="text-play-600 mt-2 inline-block text-sm font-semibold">
            &larr; Back to the homepage
          </Link>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <NewsCard
              key={`${item.type}-${item.id}`}
              title={item.title}
              excerpt={item.excerpt}
              dateLabel={format(new Date(item.dateISO), "MMM d, yyyy")}
              author={item.author ?? undefined}
              href={item.href ?? undefined}
            />
          ))}
        </div>
      )}
    </div>
  )
}
