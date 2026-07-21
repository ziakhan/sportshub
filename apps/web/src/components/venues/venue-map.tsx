/**
 * Keyless Google Maps embed. Uses the `output=embed` endpoint, which renders a
 * pinned map WITHOUT a Maps API key (the Places key we hold is client-only and
 * scoped to autocomplete). Prefers lat/lng (exact pin); falls back to the
 * address string. Renders nothing if we have neither.
 */
export function VenueMap({
  latitude,
  longitude,
  address,
  name,
  className,
}: {
  latitude?: number | null
  longitude?: number | null
  address?: string | null
  name?: string | null
  className?: string
}) {
  const q =
    latitude != null && longitude != null
      ? `${latitude},${longitude}`
      : address
        ? `${name ? `${name}, ` : ""}${address}`
        : null
  if (!q) return null
  const src = `https://maps.google.com/maps?q=${encodeURIComponent(q)}&z=15&output=embed`
  return (
    <iframe
      title={`Map of ${name ?? "venue"}`}
      src={src}
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
      className={className ?? "border-ink-200 h-64 w-full rounded-xl border"}
    />
  )
}
