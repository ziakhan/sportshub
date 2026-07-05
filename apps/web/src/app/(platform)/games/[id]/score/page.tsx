import { ScoringConsole } from "@/components/scoring/scoring-console"

/**
 * The scorer's-table console. Server shell only — the console bootstraps
 * client-side (auth + roster + events) so the offline queue owns the data.
 */
export default function ScoreGamePage({ params }: { params: { id: string } }) {
  return <ScoringConsole gameId={params.id} />
}
