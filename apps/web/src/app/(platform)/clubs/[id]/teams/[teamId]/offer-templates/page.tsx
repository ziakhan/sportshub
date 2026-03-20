import { redirect } from "next/navigation"

// Offer templates moved to club level. Redirect old bookmarks.
export default function OldOfferTemplatesPage({
  params,
}: {
  params: { id: string }
}) {
  redirect(`/clubs/${params.id}/offer-templates`)
}
