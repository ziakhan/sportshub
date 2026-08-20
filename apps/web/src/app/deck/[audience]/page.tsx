import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { DECKS, deckTitle, getDeck } from "../_deck/registry"
import { LeagueDeck } from "../_deck/league-deck"

export function generateStaticParams() {
  return Object.keys(DECKS).map((audience) => ({ audience }))
}

export function generateMetadata({ params }: { params: { audience: string } }): Metadata {
  const brand = getDeck(params.audience)
  if (!brand) return { title: "Deck" }
  const title = deckTitle(brand)
  return {
    title,
    description:
      "Run the whole season in one place: registration, divisions, scheduling, game day, standings, playoffs, referees, waivers and fees.",
    alternates: { canonical: `/deck/${params.audience}` },
    /* Sent to a named prospect, not something to index. */
    robots: { index: false, follow: false },
    openGraph: { title, url: `/deck/${params.audience}`, type: "website" },
  }
}

/**
 * One deck, many addressees. Which league a link is for is decided by the
 * registry, never by forking the slides. See _deck/registry.ts.
 */
export default function DeckPage({ params }: { params: { audience: string } }) {
  const brand = getDeck(params.audience)
  if (!brand) notFound()
  return <LeagueDeck brand={brand} />
}
