import { prisma } from "@youthbasketballhub/db"
import { notFound } from "next/navigation"
import Link from "next/link"
import { getCurrentUser } from "@/lib/auth-helpers"
import { ClubPageEditor } from "./club-page-editor"

export const dynamic = "force-dynamic"

export default async function CustomizeClubPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user) notFound()
  const roles = user.roles.map((r: any) => r.role)
  const isAdmin =
    roles.includes("PlatformAdmin") ||
    user.roles.some(
      (r: any) =>
        r.tenantId === params.id &&
        (r.role === "ClubOwner" || r.role === "ClubManager" || r.role === "Trainer")
    )
  if (!isAdmin) notFound()

  const club = await prisma.tenant.findUnique({
    where: { id: params.id },
    include: { branding: true },
  })
  if (!club) notFound()

  const announcements = await (prisma as any).announcement.findMany({
    where: { tenantId: params.id, teamId: null },
    orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
    take: 50,
    select: { id: true, title: true, content: true, isPinned: true, createdAt: true },
  })

  const b: any = club.branding
  const initial = {
    tagline: b?.tagline ?? "",
    description: club.description ?? "",
    bannerUrl: b?.bannerUrl ?? null,
    logoUrl: b?.logoUrl ?? null,
    primaryColor: b?.primaryColor ?? "#1a73e8",
    secondaryColor: b?.secondaryColor ?? "#34a853",
    accentColor: b?.accentColor ?? "#fbbc04",
    phoneNumber: club.phoneNumber ?? "",
    address: club.address ?? "",
    city: club.city ?? "",
    state: club.state ?? "",
    zipCode: club.zipCode ?? "",
    contactEmail: club.contactEmail ?? "",
    website: club.website ?? "",
    socials: (b?.socials as any) ?? {},
    pageLayout: (b?.pageLayout as any) ?? null,
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-ink-950 text-lg font-bold">Customize your public page</h2>
          <p className="text-ink-500 text-sm">
            Brand it, add your info, and arrange the sections. Changes go live when you save.
          </p>
        </div>
        <Link
          href={`/club/${club.slug}`}
          target="_blank"
          className="border-ink-200 text-ink-700 hover:bg-ink-50 shrink-0 rounded-xl border px-4 py-2 text-sm font-semibold transition"
        >
          View public page ↗
        </Link>
      </div>

      <ClubPageEditor
        clubId={params.id}
        slug={club.slug}
        initial={initial}
        initialAnnouncements={announcements}
      />
    </div>
  )
}
