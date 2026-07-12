import { prisma } from "@youthbasketballhub/db"
import { notFound, redirect } from "next/navigation"
import { normalizeHandle } from "@/lib/handles"

export const dynamic = "force-dynamic"

/**
 * /p/<handle> — the marketable player URL (player-handles-plan.md P0).
 * Resolves to the player page; becomes the player-owned page itself in P1.
 */
export default async function HandlePage({ params }: { params: { handle: string } }) {
  const player = await (prisma as any).player.findUnique({
    where: { handle: normalizeHandle(decodeURIComponent(params.handle)) },
    select: { id: true },
  })
  if (!player) notFound()
  redirect(`/player/${player.id}`)
}
