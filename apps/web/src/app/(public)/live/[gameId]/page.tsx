import { notFound } from "next/navigation"
import { prisma } from "@youthbasketballhub/db"
import { SmartBack } from "@/components/ui"
import { LiveView } from "./live-view"

export const dynamic = "force-dynamic"

async function getGameHead(gameId: string) {
  return (prisma as any).game.findUnique({
    where: { id: gameId },
    select: {
      id: true,
      status: true,
      potgPlayerId: true,
      homeTeam: { select: { name: true } },
      awayTeam: { select: { name: true } },
    },
  })
}

export async function generateMetadata({ params }: { params: { gameId: string } }) {
  const game = await getGameHead(params.gameId)
  if (!game) return { title: "Game not found" }
  return {
    title: `${game.homeTeam.name} vs ${game.awayTeam.name} — Live Score`,
    alternates: { canonical: `/live/${params.gameId}` },
    // Finished games with a POTG share as the rendered card (P2): link
    // previews show the award + final instead of a generic page.
    ...(game.status === "COMPLETED" && game.potgPlayerId
      ? { openGraph: { images: [`/api/live/${params.gameId}/card`] } }
      : {}),
  }
}

/** Public live scoreboard — score, box, play-by-play; polls every 10s. */
export default async function LiveGamePage({ params }: { params: { gameId: string } }) {
  // Real 404 for unknown ids (the client view handles its own polling)
  const game = await getGameHead(params.gameId)
  if (!game) notFound()
  return (
    <div>
      <div className="mx-auto w-full max-w-[1760px] px-4 pt-3 sm:px-6">
        <SmartBack fallback="/scores" fallbackLabel="Scores" className="-ml-1" />
      </div>
      <LiveView gameId={params.gameId} />
    </div>
  )
}
