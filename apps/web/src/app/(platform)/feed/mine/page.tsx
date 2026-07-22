import { redirect } from "next/navigation"
import Link from "next/link"
import { getSessionUserId } from "@/lib/auth-helpers"
import { getMyPosts } from "@/lib/queries/feed"
import { FeedCard } from "@/components/social/feed-card"
import { FeedTabs } from "@/components/social/feed-tabs"

export const dynamic = "force-dynamic"

export const metadata = { title: "My posts | SportsHub One" }

/**
 * My posts (owner 2026-07-23: every role gets one): everything the signed-in
 * user has published — shared player cards for parents, org posts for
 * club/league admins — plus their reposts.
 */
export default async function MyPostsPage() {
  const sessionInfo = await getSessionUserId()
  if (!sessionInfo) redirect("/sign-in?callbackUrl=/feed/mine")

  const items = await getMyPosts(sessionInfo.userId)

  return (
    <div className="mx-auto max-w-xl space-y-3 px-3 py-2 sm:px-0">
      <FeedTabs />
      {items.length === 0 ? (
        <div className="border-ink-300 rounded-2xl border border-dashed bg-white p-8 text-center">
          <p className="text-ink-900 text-sm font-semibold">Nothing shared yet</p>
          <p className="text-ink-500 mt-1 text-sm">
            Cards you share from a finished game page, posts you publish, and your reposts all
            land here.
          </p>
          <Link
            href="/scores"
            className="bg-play-600 hover:bg-play-700 mt-4 inline-block rounded-xl px-4 py-2 text-sm font-bold text-white"
          >
            Find a finished game
          </Link>
        </div>
      ) : (
        items.map((item) => <FeedCard key={`${item.id}-${item.repostedBy ?? "o"}`} item={item} manageable={!item.repostedBy} />)
      )}
    </div>
  )
}
