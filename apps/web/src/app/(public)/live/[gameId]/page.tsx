import { LiveView } from "./live-view"

/** Public live scoreboard — score, box, play-by-play; polls every 10s. */
export default function LiveGamePage({ params }: { params: { gameId: string } }) {
  return <LiveView gameId={params.gameId} />
}
