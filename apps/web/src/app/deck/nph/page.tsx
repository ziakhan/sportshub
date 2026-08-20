import type { Metadata } from "next"
import { LeagueDeck } from "../_deck/league-deck"

export const metadata: Metadata = {
  title: "SportsHub for North Pole Hoops",
  description:
    "Run the whole season in one place: registration, divisions, scheduling, game day, standings, playoffs, referees, waivers and fees.",
  alternates: { canonical: "/deck/nph" },
  robots: { index: false, follow: false },
}

/** The North Pole Hoops cut: their league in every screenshot and in the live
 *  game-day demo. Never send this one to another league. */
export default function NphDeckPage() {
  return (
    <LeagueDeck
      brand={{
        shots: "/deck",
        league: "NPH Summer League",
        addressedTo: "Prepared for North Pole Hoops",
      }}
    />
  )
}
