import { prisma } from "@youthbasketballhub/db"
import { getSessionUserId } from "@/lib/auth-helpers"
import { ScoringConsole } from "@/components/scoring/scoring-console"

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

  return <ScoringConsole gameId={params.id} canCorrect={canCorrect} />
}
