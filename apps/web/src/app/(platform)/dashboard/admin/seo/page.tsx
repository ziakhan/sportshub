import Link from "next/link"
import { redirect } from "next/navigation"
import { prisma } from "@youthbasketballhub/db"
import { getSessionUserId } from "@/lib/auth-helpers"

export const dynamic = "force-dynamic"

const DAY = 24 * 60 * 60 * 1000
const SOURCES = ["ORGANIC", "DIRECT", "REFERRAL", "INTERNAL", "BOT"] as const

/**
 * SEO traffic report — first-party PublicPageView rollup. The per-club
 * organic column is the claim-pitch number: "your page got N search
 * landings without you doing anything" (seo-strategy §6/§7).
 */
export default async function AdminSeoPage() {
  const auth = await getSessionUserId()
  if (!auth?.isPlatformAdmin) redirect("/dashboard")

  const since30 = new Date(Date.now() - 30 * DAY)
  const since7 = new Date(Date.now() - 7 * DAY)

  const [bySource, byType, clubRows30, clubOrganic30, clubRows7, settings] = await Promise.all([
    prisma.publicPageView.groupBy({
      by: ["source"],
      where: { createdAt: { gte: since30 } },
      _count: true,
    }),
    prisma.publicPageView.groupBy({
      by: ["entityType"],
      where: { createdAt: { gte: since30 }, source: { not: "BOT" } },
      _count: true,
    }),
    prisma.publicPageView.groupBy({
      by: ["tenantId"],
      where: { createdAt: { gte: since30 }, tenantId: { not: null }, source: { not: "BOT" } },
      _count: true,
    }),
    prisma.publicPageView.groupBy({
      by: ["tenantId"],
      where: { createdAt: { gte: since30 }, tenantId: { not: null }, source: "ORGANIC" },
      _count: true,
    }),
    prisma.publicPageView.groupBy({
      by: ["tenantId"],
      where: { createdAt: { gte: since7 }, tenantId: { not: null }, source: { not: "BOT" } },
      _count: true,
    }),
    prisma.platformSettings.findUnique({
      where: { id: "default" },
      select: { seoIndexingEnabled: true },
    }),
  ])

  const sourceCounts = Object.fromEntries(bySource.map((r) => [r.source, r._count]))
  const organic30 = new Map(clubOrganic30.map((r) => [r.tenantId as string, r._count]))
  const views7 = new Map(clubRows7.map((r) => [r.tenantId as string, r._count]))

  const topClubIds = clubRows30
    .sort((a, b) => b._count - a._count)
    .slice(0, 50)
    .map((r) => r.tenantId as string)
  const tenants = topClubIds.length
    ? await prisma.tenant.findMany({
        where: { id: { in: topClubIds } },
        select: { id: true, name: true, slug: true, status: true, city: true },
      })
    : []
  const tenantById = new Map(tenants.map((t) => [t.id, t]))

  const totalNonBot = SOURCES.filter((s) => s !== "BOT").reduce(
    (sum, s) => sum + (sourceCounts[s] || 0),
    0
  )

  return (
    <div className="space-y-5">
      <div className="border-ink-100 shadow-soft rounded-2xl border bg-white p-6">
        <div className="border-play-100 bg-play-50 text-play-600 mb-3 inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em]">
          Admin
        </div>
        <h2 className="font-display text-ink-950 text-2xl font-bold">SEO traffic</h2>
        <p className="text-ink-500 mt-1 text-sm">
          First-party page views on public pages, last 30 days. Organic = landed from a search
          engine. Indexing is currently{" "}
          <span className={settings?.seoIndexingEnabled ? "text-court-700 font-semibold" : "text-hoop-700 font-semibold"}>
            {settings?.seoIndexingEnabled ? "ON" : "OFF"}
          </span>{" "}
          (<Link href="/dashboard/admin/settings" className="underline">change</Link>).
        </p>
      </div>

      {/* Source split */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {SOURCES.map((s) => (
          <div key={s} className="border-ink-100 shadow-soft rounded-2xl border bg-white p-4">
            <div className="text-ink-500 text-xs font-semibold uppercase tracking-wide">{s.toLowerCase()}</div>
            <div className="font-display text-ink-950 mt-1 text-2xl font-bold">
              {sourceCounts[s] || 0}
            </div>
            {s !== "BOT" && totalNonBot > 0 && (
              <div className="text-ink-400 text-xs">
                {Math.round(((sourceCounts[s] || 0) / totalNonBot) * 100)}% of human traffic
              </div>
            )}
          </div>
        ))}
      </div>

      {/* By page type */}
      <div className="border-ink-100 shadow-soft rounded-2xl border bg-white p-6">
        <h3 className="font-display text-ink-950 mb-3 text-lg font-semibold">By page type (human traffic)</h3>
        <div className="flex flex-wrap gap-2">
          {byType
            .sort((a, b) => b._count - a._count)
            .map((r) => (
              <span key={r.entityType} className="bg-ink-50 text-ink-700 rounded-full px-3 py-1 text-sm">
                {r.entityType.toLowerCase().replace("_", " ")}: <b>{r._count}</b>
              </span>
            ))}
          {byType.length === 0 && <span className="text-ink-400 text-sm">No tracked views yet.</span>}
        </div>
      </div>

      {/* Per-club table — the claim-pitch numbers */}
      <div className="border-ink-100 shadow-soft rounded-2xl border bg-white p-6">
        <h3 className="font-display text-ink-950 mb-1 text-lg font-semibold">Clubs by visibility</h3>
        <p className="text-ink-500 mb-4 text-sm">
          Top 50 by 30-day human views (club page + their programs). The organic column on an
          UNCLAIMED club is the &ldquo;families are already finding you here&rdquo; sales number.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="text-ink-400 border-ink-100 border-b text-left text-xs uppercase tracking-wide">
                <th className="py-2 pr-4">Club</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4 text-right">Views 30d</th>
                <th className="py-2 pr-4 text-right">Views 7d</th>
                <th className="py-2 pr-4 text-right">Organic 30d</th>
                <th className="py-2 text-right">Organic share</th>
              </tr>
            </thead>
            <tbody>
              {topClubIds.map((id) => {
                const t = tenantById.get(id)
                if (!t) return null
                const v30 = clubRows30.find((r) => r.tenantId === id)?._count || 0
                const org = organic30.get(id) || 0
                return (
                  <tr key={id} className="border-ink-50 border-b last:border-0">
                    <td className="py-2 pr-4">
                      <Link href={`/club/${t.slug}`} className="text-play-700 font-medium hover:underline">
                        {t.name}
                      </Link>
                      {t.city && <span className="text-ink-400 ml-2 text-xs">{t.city}</span>}
                    </td>
                    <td className="py-2 pr-4">
                      {t.status === "UNCLAIMED" ? (
                        <span className="bg-gold-50 text-gold-600 rounded-full px-2 py-0.5 text-xs font-semibold">
                          Unclaimed
                        </span>
                      ) : (
                        <span className="text-ink-400 text-xs">Active</span>
                      )}
                    </td>
                    <td className="py-2 pr-4 text-right font-medium tabular-nums">{v30}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{views7.get(id) || 0}</td>
                    <td className="text-court-700 py-2 pr-4 text-right font-semibold tabular-nums">{org}</td>
                    <td className="py-2 text-right tabular-nums">
                      {v30 > 0 ? `${Math.round((org / v30) * 100)}%` : "—"}
                    </td>
                  </tr>
                )
              })}
              {topClubIds.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-ink-400 py-6 text-center">
                    No club-page views tracked yet — they&apos;ll appear as soon as public pages get
                    traffic.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
