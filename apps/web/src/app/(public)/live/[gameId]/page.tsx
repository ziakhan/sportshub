import { notFound } from "next/navigation"
import { prisma } from "@youthbasketballhub/db"
import { LiveView } from "./live-view"

export const dynamic = "force-dynamic"

async function getGameHead(gameId: string) {
  return (prisma as any).game.findUnique({
    where: { id: gameId },
    select: { id: true, homeTeam: { select: { name: true } }, awayTeam: { select: { name: true } } },
  })
}

export async function generateMetadata({ params }: { params: { gameId: string } }) {
  const game = await getGameHead(params.gameId)
  if (!game) return { title: "Game not found — SportsHub" }
  return { title: `${game.homeTeam.name} vs ${game.awayTeam.name} — Live — SportsHub` }
}

/** Public live scoreboard — score, box, play-by-play; polls every 10s. */
export default async function LiveGamePage({ params }: { params: { gameId: string } }) {
  // Real 404 for unknown ids (the client view handles its own polling)
  const game = await getGameHead(params.gameId)
  if (!game) notFound()
  return <LiveView gameId={params.gameId} />
}
