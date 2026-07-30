import { prisma } from "@youthbasketballhub/db"
import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth-helpers"
import { SmartBack } from "@/components/ui"
import { OrgEditor } from "./org-editor"
import { SeasonDefaultsEditor } from "./season-defaults-editor"

export const dynamic = "force-dynamic"

/**
 * Operator (Organization) settings — the ONE place NPH's identity lives
 * (owner 2026-07-29: "where are the NPH organization settings?"). Leagues
 * inherit everything set here unless a league overrides it on its own
 * Customize page.
 */
export default async function OrgSettingsPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user) redirect("/sign-in")

  const org = await (prisma as any).organization.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      name: true,
      slug: true,
      logoUrl: true,
      primaryColor: true,
      tagline: true,
      description: true,
      seasonDefaults: true,
      leagues: { select: { id: true, name: true, logoUrl: true, primaryColor: true, tagline: true }, orderBy: { name: "asc" } },
    },
  })
  if (!org) notFound()

  const isAdmin =
    user.roles.some((r: any) => r.role === "PlatformAdmin") ||
    org.leagues.length === 0 ||
    (await (prisma as any).league.findFirst({
      where: { organizationId: org.id, ownerId: user.id },
      select: { id: true },
    })) !== null ||
    (await prisma.userRole.findFirst({
      where: {
        userId: user.id,
        role: { in: ["LeagueOwner", "LeagueManager"] },
        leagueId: { in: org.leagues.map((l: any) => l.id) },
      },
      select: { id: true },
    })) !== null
  if (!isAdmin) notFound()

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <SmartBack fallback="/dashboard" fallbackLabel="Dashboard" className="-ml-1 mb-1" />
          <h1 className="text-ink-950 mt-1 text-xl font-bold">Organization settings</h1>
          <p className="text-ink-500 max-w-xl text-sm">
            {org.name}&apos;s identity — logo, color, tagline, description — set once here and
            inherited by every league below. A league can override any of these on its own
            Customize page; blank league fields fall back to what you set here.
          </p>
        </div>
        <Link
          href={`/org/${org.slug}`}
          target="_blank"
          className="border-ink-200 text-ink-700 hover:bg-ink-50 shrink-0 rounded-xl border px-4 py-2 text-sm font-semibold transition"
        >
          View public page ↗
        </Link>
      </div>

      <OrgEditor
        orgId={org.id}
        initial={{
          name: org.name,
          tagline: org.tagline ?? "",
          description: org.description ?? "",
          primaryColor: org.primaryColor ?? "#4f46e5",
          logoUrl: org.logoUrl ?? null,
        }}
      />

      <div className="mt-6">
        <SeasonDefaultsEditor
          orgId={org.id}
          orgName={org.name}
          initial={(org.seasonDefaults as Record<string, any> | null) ?? null}
        />
      </div>

      <div className="border-ink-100 shadow-soft mt-6 rounded-2xl border bg-white p-5">
        <h2 className="text-ink-900 text-sm font-bold uppercase tracking-wide">
          Leagues run by {org.name} ({org.leagues.length})
        </h2>
        <p className="text-ink-400 mt-1 text-xs">
          &quot;Inherits&quot; means the league shows your organization branding; &quot;overridden&quot;
          means the league set its own.
        </p>
        <div className="mt-3 grid gap-1.5">
          {org.leagues.map((l: any) => {
            const overridden = !!(l.logoUrl || (l.primaryColor && l.primaryColor !== "#1a73e8") || l.tagline)
            return (
              <div key={l.id} className="bg-court-50 flex items-center justify-between rounded-lg px-3 py-2 text-sm">
                <span className="text-ink-800 font-medium">{l.name}</span>
                <span className="flex items-center gap-3">
                  <span className={overridden ? "text-gold-600 text-xs font-semibold" : "text-ink-400 text-xs"}>
                    {overridden ? "branding overridden" : "inherits organization branding"}
                  </span>
                  <Link href={`/manage/leagues/${l.id}/customize`} className="text-play-600 text-xs font-semibold hover:underline">
                    Customize &rarr;
                  </Link>
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
