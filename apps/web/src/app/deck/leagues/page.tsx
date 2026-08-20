import type { Metadata } from "next"
import { LeagueDeck } from "./deck"

export const metadata: Metadata = {
  title: "SportsHub for Leagues",
  description:
    "Run the whole season in one place: registration, divisions, scheduling, game day, standings, playoffs, referees, waivers and fees. A walkthrough for league operators.",
  alternates: { canonical: "/deck/leagues" },
  openGraph: {
    title: "SportsHub for Leagues",
    description: "Run the whole season in one place. A walkthrough for league operators.",
    url: "/deck/leagues",
    type: "website",
  },
  /* Sent to a named prospect, not something to index. */
  robots: { index: false, follow: false },
}

export default function LeagueDeckPage() {
  return <LeagueDeck />
}
