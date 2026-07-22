import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { authOptions } from "@/lib/auth"
import { getSessionUserId, getUserTenants } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { getSocialFeed } from "@/lib/queries/feed"
import { FeedCard } from "@/components/social/feed-card"
import { StoriesRail } from "@/components/social/stories-rail"
import { OrgComposer, type OrgOption } from "@/components/social/org-composer"

export const dynamic = "force-dynamic"

export const metadata = { title: "My Feed | SportsHub One" }

/**
 * My Feed (social-feed-plan P5): stories rail on top, then posts from
 * everything the viewer follows — system score cards, recaps, player
 * moments, org photo/video posts, and reposts by followed players' families.
 */
export default async function FeedPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/sign-in?callbackUrl=/feed")
  const sessionInfo = await getSessionUserId()
  if (!sessionInfo) redirect("/sign-in?callbackUrl=/feed")

  const [items, tenants, ownedLeagues] = await Promise.all([
    getSocialFeed(sessionInfo.userId),
    getUserTenants(),
    (prisma as any).league.findMany({
      where: { ownerId: sessionInfo.userId },
      select: { id: true, name: true },
    }),
  ])

  const orgs: OrgOption[] = [
    ...tenants
      .filter((t: any) => ["ClubOwner", "ClubManager"].includes(t.role))
      .map((t: any) => ({ key: `t-${t.id}`, label: t.name, tenantId: t.id })),
    ...ownedLeagues.map((l: any) => ({ key: `l-${l.id}`, label: l.name, leagueId: l.id })),
  ]

  return (
    <div className="mx-auto max-w-xl space-y-4 px-4 py-6 sm:px-0">
      <h1 className="font-display text-ink-950 text-2xl font-bold">My Feed</h1>
      <StoriesRail />
      <OrgComposer orgs={orgs} />
      {items.length === 0 ? (
        <div className="border-ink-300 rounded-2xl border border-dashed bg-white p-8 text-center">
          <p className="text-ink-900 text-sm font-semibold">Your feed is empty</p>
          <p className="text-ink-500 mt-1 text-sm">
            Follow teams, clubs, leagues, and players to see finals, recaps, and shared moments
            here.
          </p>
          <Link
            href="/clubs/find"
            className="bg-play-600 hover:bg-play-700 mt-4 inline-block rounded-xl px-4 py-2 text-sm font-bold text-white"
          >
            Find clubs to follow
          </Link>
        </div>
      ) : (
        items.map((item) => <FeedCard key={`${item.id}-${item.repostedBy ?? "o"}`} item={item} />)
      )}
    </div>
  )
}
