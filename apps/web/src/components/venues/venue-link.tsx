import Link from "next/link"

/**
 * Renders a venue name that links to its public detail page (/venues/[id]).
 * When there's no venueId (legacy free-text location), it falls back to plain
 * text so callers can pass `venueId={game.venueId}` unconditionally.
 */
export function VenueLink({
  venueId,
  name,
  className,
}: {
  venueId?: string | null
  name?: string | null
  className?: string
}) {
  const label = name ?? "Venue"
  if (!venueId) return <span className={className}>{label}</span>
  return (
    <Link
      href={`/venues/${venueId}`}
      className={className ?? "text-play-600 hover:text-play-700 font-medium hover:underline"}
    >
      {label}
    </Link>
  )
}
