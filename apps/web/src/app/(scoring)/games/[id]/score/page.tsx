import { prisma } from "@youthbasketballhub/db"
import { getSessionUserId } from "@/lib/auth-helpers"
import { ScoringConsole } from "@/components/scoring/scoring-console"
import { PreGameChecklist } from "@/components/scoring/pre-game-checklist"
import { ScorekeeperBroadcast } from "@/components/streaming/scorekeeper-broadcast"

/**
 * The scorer's-table console. Server shell only — the console bootstraps
 * client-side (auth + roster + events) so the offline queue owns the data.
 *
 * The one server-computed prop is `canCorrect`: whether the viewer may reopen
 * a COMPLETED game for corrections. It mirrors the re-finalize gate in
 * /api/games/[id]/finalize (league owner or PlatformAdmin) — the API stays
 * the enforcer; this only decides whether the button renders.
 */
export default async function ScoreGamePage({ params }: { params: { id: string } }) {
  let canCorrect = false
  const sessionInfo = await getSessionUserId()
  if (sessionInfo) {
    if (sessionInfo.isPlatformAdmin) {
      canCorrect = true
    } else {
      const game = await (prisma as any).game.findUnique({
        where: { id: params.id },
        select: { season: { select: { league: { select: { ownerId: true } } } } },
      })
      canCorrect = game?.season?.league?.ownerId === sessionInfo.userId
    }
  }

  return (
    <>
      <PreGameChecklist gameId={params.id} />
      {/* Broadcasting (live-streaming plan, "The human interaction"), which is
          OPTIONAL and OFF: this renders one quiet row offering a camera, and a
          game nobody is filming reads as a completely normal game. It sits
          ABOVE the console rather than inside it, because the console is a
          2,000-line offline-queue machine and a once-a-day camera choice has
          no business living in it. It fetches its own candidates, renders
          nothing at all when the league has not turned streaming on, and is
          dismissible for the session. */}
      <ScorekeeperBroadcast gameId={params.id} />
      <ScoringConsole gameId={params.id} canCorrect={canCorrect} />
    </>
  )
}
