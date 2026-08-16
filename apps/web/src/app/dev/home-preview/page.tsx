import { HomePreview } from "./preview"

/**
 * Static draft of the pre-launch homepage, for owner approval. Nothing on it is
 * wired: the form does not send, the club search does not search. The real page
 * ships at / once the look is approved.
 */
export default function HomePreviewPage() {
  return <HomePreview />
}
