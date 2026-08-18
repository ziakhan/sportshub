import { notFound } from "next/navigation"
import { prisma } from "@youthbasketballhub/db"
import { getCurrentUser } from "@/lib/auth-helpers"
import { getClubProfile } from "@/lib/queries/club-profile"
import { chosenBrandColor, NEUTRAL_BRAND } from "@/lib/club-page/brand"
import { resolveLayout } from "@/lib/club-page/blocks"
import { LiveEditor } from "./live-editor"

export const dynamic = "force-dynamic"

/**
 * Live page editor route (owner 2026-08-18).
 *
 * The owner asked for the editor to look like a real website rather than controls
 * beside a thumbnail. So this route fetches exactly what the public page fetches,
 * via the SAME shared query module (parity law), and hands it to a client editor
 * that renders the SAME ClubBlock components. What the club edits is the site.
 */
export default async function LivePageEditor({ params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user) notFound()
  const roles = user.roles.map((r: any) => r.role)
  const allowed =
    roles.includes("PlatformAdmin") ||
    user.roles.some(
      (r: any) =>
        r.tenantId === params.id &&
        (r.role === "ClubOwner" || r.role === "ClubManager" || r.role === "Trainer")
    )
  if (!allowed) notFound()

  const tenant = await prisma.tenant.findUnique({
    where: { id: params.id },
    select: { id: true, slug: true, name: true },
  })
  if (!tenant) notFound()

  // Same shared query the public page uses. One data source per surface.
  const profile = await getClubProfile(tenant.slug)
  if (!profile) notFound()

  const club: any = profile.club
  const b: any = club.branding
  const primary = chosenBrandColor({ status: club.status, primaryColor: b?.primaryColor })

  const data: any = { ...profile, accent: primary ?? NEUTRAL_BRAND }

  return (
    <LiveEditor
      clubId={params.id}
      slug={tenant.slug}
      clubName={tenant.name}
      data={data}
      initialLayout={resolveLayout(b?.pageLayout)}
      initialLook={{
        theme: b?.theme ?? null,
        accentKey: b?.accentKey ?? null,
        headerStyle: b?.headerStyle ?? null,
        intensity: b?.intensity ?? null,
        shape: b?.shape ?? null,
        density: b?.density ?? null,
        bannerFocalX: b?.bannerFocalX ?? null,
        bannerFocalY: b?.bannerFocalY ?? null,
      }}
    />
  )
}
