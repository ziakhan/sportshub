import type { Metadata } from "next"
import { LeagueDeck } from "../_deck/league-deck"

export const metadata: Metadata = {
  title: "SportsHub for Leagues",
  description:
    "Run the whole season in one place: registration, divisions, scheduling, game day, standings, playoffs, referees, waivers and fees.",
  alternates: { canonical: "/deck/leagues" },
  /* Sent to a named prospect, not something to index. */
  robots: { index: false, follow: false },
}

/**
 * The deck that gets sent to any league. Screenshots come from the neutral
 * capture set and the embedded game-day demo runs under a placeholder league,
 * so nothing here names another operator. Use /deck/nph for North Pole Hoops.
 */
export default function LeagueDeckPage() {
  return <LeagueDeck brand={{ shots: "/deck/neutral", league: "Parkview Summer League" }} />
}
