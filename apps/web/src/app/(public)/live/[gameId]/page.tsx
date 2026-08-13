import { notFound } from "next/navigation"
import { prisma } from "@youthbasketballhub/db"
import { SmartBack } from "@/components/ui"
import { LiveView } from "./live-view"
import { isDemoGame } from "@/lib/demo/demo-mode"
import { DemoBadge } from "@/components/demo-badge"
import { HintBalloon } from "@/components/demo/hint-balloon"

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
  const demo = await isDemoGame(params.gameId)
  return (
    <div>
      <div className="mx-auto w-full max-w-[1760px] px-4 pt-3 sm:px-6">
        <SmartBack fallback="/scores" fallbackLabel="Scores" className="-ml-1" />
        {demo && (
          <div className="mt-2 flex items-center gap-2">
            <DemoBadge />
            <HintBalloon hintKey="live-game">
              This is live scoring: the score and play-by-play update as the table scores. No
              refresh, no login. Every real game works this way.
            </HintBalloon>
          </div>
        )}
      </div>
      <LiveView gameId={params.gameId} />
    </div>
  )
}
