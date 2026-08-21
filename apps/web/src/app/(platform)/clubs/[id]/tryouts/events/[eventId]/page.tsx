import { prisma } from "@youthbasketballhub/db"
import { notFound, redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth-helpers"
import { isClubAdmin } from "@/lib/authz/team-scope"
import { EventDetail } from "./event-detail"

export const dynamic = "force-dynamic"

/**
 * Tryout event detail. The club layout has already proved the viewer belongs
 * to this club; what is decided here is whether they may EDIT the event, which
 * the API limits to owners and managers.
 */
export default async function TryoutEventPage({
  params,
}: {
  params: { id: string; eventId: string }
}) {
  const user = await getCurrentUser()
  if (!user) redirect("/sign-in")

  const [canEdit, club] = await Promise.all([
    isClubAdmin(user.id, params.id),
    prisma.tenant.findUnique({ where: { id: params.id }, select: { slug: true } }),
  ])
  if (!club) notFound()

  return (
    <EventDetail
      clubId={params.id}
      eventId={params.eventId}
      clubSlug={club.slug}
      canEdit={canEdit}
    />
  )
}
