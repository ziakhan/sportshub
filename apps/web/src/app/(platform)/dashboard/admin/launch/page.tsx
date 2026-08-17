import Link from "next/link"
import { format } from "date-fns"
import { redirect } from "next/navigation"
import { prisma } from "@youthbasketballhub/db"
import { getSessionUserId } from "@/lib/auth-helpers"

export const dynamic = "force-dynamic"

/**
 * The launch dashboard (owner 2026-08-17: "complete visibility on what's
 * happening on the demo"). Four views over the soft-launch traffic:
 *
 *  - Overview: visits, uniques, time spent, top pages, demo watch depth,
 *    referrers. Headline numbers count OUTSIDE visitors only; browsing by
 *    anyone signed in (the owner, the team) is tallied separately.
 *  - Signups: the notify list, filterable, with CSV export.
 *  - Claims: club claims started and where they stand.
 *  - Journeys: one visitor session at a time, event by event.
 *
 * Everything renders server-side from the ActivityEvent beacon table plus
 * LaunchSignup and ClubClaim. At soft-launch traffic the reductions here are
 * a few hundred rows; revisit if a marketing push changes that.
 */

const HEARTBEAT_SECONDS = 15

type Search = { tab?: string; range?: string; session?: string }

function rangeStart(range: string): Date | null {
  const now = new Date()
  if (range === "today") return new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (range === "7d") return new Date(now.getTime() - 7 * 24 * 3600 * 1000)
  return null
}

function fmtDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  if (m < 60) return `${m}m ${seconds % 60}s`
  return `${Math.floor(m / 60)}h ${m % 60}m`
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`border-ink-100 shadow-soft rounded-2xl border bg-white ${className ?? "p-6"}`}>
      {children}
    </div>
  )
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="border-ink-100 rounded-xl border bg-white p-4">
      <div className="text-ink-500 text-xs font-medium uppercase tracking-wider">{label}</div>
      <div className="font-display text-ink-950 mt-1 text-2xl font-bold">{value}</div>
      {sub ? <div className="text-ink-400 mt-0.5 text-xs">{sub}</div> : null}
    </div>
  )}

function BarRow({ label, count, max, href }: { label: string; count: number; max: number; href?: string }) {
  const width = max > 0 ? Math.max(4, Math.round((count / max) * 100)) : 4
  const inner = (
    <div className="flex items-center gap-3 py-1.5">
      <div className="text-ink-700 w-64 shrink-0 truncate text-sm" title={label}>
        {label}
      </div>
      <div className="bg-ink-100 h-2.5 flex-1 overflow-hidden rounded-full">
        <div className="bg-play-500 h-full rounded-full" style={{ width: `${width}%` }} />
      </div>
      <div className="text-ink-900 w-12 shrink-0 text-right text-sm font-semibold">{count}</div>
    </div>
  )
  return href ? (
    <Link href={href} className="hover:bg-court-50 -mx-2 block rounded-lg px-2">
      {inner}
    </Link>
  ) : (
    inner
  )
}

export default async function AdminLaunchPage({ searchParams }: { searchParams: Search }) {
  const auth = await getSessionUserId()
  if (!auth?.isPlatformAdmin) redirect("/dashboard")

  const tab = ["signups", "claims", "journeys"].includes(searchParams.tab ?? "")
    ? (searchParams.tab as "signups" | "claims" | "journeys")
    : "overview"
  const range = ["today", "all"].includes(searchParams.range ?? "") ? searchParams.range! : "7d"
  const start = rangeStart(range)
  const since = start ? { createdAt: { gte: start } } : {}

  const tabs = [
    { key: "overview", label: "Overview" },
    { key: "signups", label: "Signups" },
    { key: "claims", label: "Claims" },
    { key: "journeys", label: "Journeys" },
  ]

  const [signupTotal, claimTotal] = await Promise.all([
    (prisma as any).launchSignup.count(),
    (prisma as any).clubClaim.count(),
  ])

  return (
    <div className="space-y-5">
      <Card>
        <div className="border-play-100 bg-play-50 text-play-600 mb-3 inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em]">
          Admin
        </div>
        <h1 className="font-display text-ink-950 text-2xl font-bold">Launch</h1>
        <p className="text-ink-600 text-sm">
          Who is visiting the landing, the demos and the claim flow, what they do there, and who
          asked to hear from us. {signupTotal} on the list, {claimTotal} claims started.
        </p>
      </Card>

      <div className="flex flex-wrap items-center gap-1.5">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={`/dashboard/admin/launch?tab=${t.key}&range=${range}`}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${
              tab === t.key ? "bg-play-600 text-white" : "bg-ink-100 text-ink-700 hover:bg-ink-200"
            }`}
          >
            {t.label}
          </Link>
        ))}
        <span className="text-ink-300 mx-1.5">|</span>
        {[
          { key: "today", label: "Today" },
          { key: "7d", label: "7 days" },
          { key: "all", label: "All time" },
        ].map((r) => (
          <Link
            key={r.key}
            href={`/dashboard/admin/launch?tab=${tab}&range=${r.key}`}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              range === r.key ? "bg-ink-900 text-white" : "bg-ink-100 text-ink-600 hover:bg-ink-200"
            }`}
          >
            {r.label}
          </Link>
        ))}
      </div>

      {tab === "overview" && <Overview since={since} />}
      {tab === "signups" && <Signups since={since} />}
      {tab === "claims" && <Claims since={since} />}
      {tab === "journeys" && <Journeys since={since} sessionId={searchParams.session} range={range} />}
    </div>
  )
}

async function Overview({ since }: { since: object }) {
  const outside = { ...since, signedIn: false }
  const [pageviews, heartbeatCount, signedInPageviews, demoEvents, signupsInRange] =
    await Promise.all([
      (prisma as any).activityEvent.findMany({
        where: { ...outside, kind: "pageview" },
        select: { sessionId: true, path: true, meta: true },
      }),
      (prisma as any).activityEvent.count({ where: { ...outside, kind: "heartbeat" } }),
      (prisma as any).activityEvent.count({ where: { ...since, signedIn: true, kind: "pageview" } }),
      (prisma as any).activityEvent.findMany({
        where: { ...outside, kind: "demo" },
        select: { path: true, sessionId: true, meta: true },
      }),
      (prisma as any).launchSignup.count({ where: since }),
    ])

  const sessions = new Set(pageviews.map((p: any) => p.sessionId))
  const uniques = sessions.size
  const totalSeconds = heartbeatCount * HEARTBEAT_SECONDS
  const avgSeconds = uniques ? Math.round(totalSeconds / uniques) : 0

  const byPath = new Map<string, number>()
  const referrers = new Map<string, number>()
  for (const p of pageviews) {
    byPath.set(p.path, (byPath.get(p.path) ?? 0) + 1)
    const meta = p.meta as Record<string, unknown> | null
    if (meta) {
      const source =
        (meta.utm_source as string | undefined) ||
        (typeof meta.referrer === "string" && meta.referrer
          ? new URL(meta.referrer as string).hostname
          : undefined)
      if (source) referrers.set(source, (referrers.get(source) ?? 0) + 1)
    }
  }
  const topPages = [...byPath.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
  const topReferrers = [...referrers.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
  const maxPage = topPages[0]?.[1] ?? 0

  const demos = new Map<string, { plays: Set<string>; done: Set<string>; chapters: number }>()
  for (const d of demoEvents) {
    const slug = d.path.replace(/^\/demos\//, "")
    const entry = demos.get(slug) ?? { plays: new Set(), done: new Set(), chapters: 0 }
    const action = (d.meta as any)?.action
    if (action === "play") entry.plays.add(d.sessionId)
    if (action === "done") entry.done.add(d.sessionId)
    if (action === "chapter") entry.chapters++
    demos.set(slug, entry)
  }
  const demoRows = [...demos.entries()]
    .map(([slug, v]) => ({ slug, plays: v.plays.size, done: v.done.size }))
    .sort((a, b) => b.plays - a.plays)

  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Visitors" value={String(uniques)} sub="outside sessions" />
        <Stat label="Page views" value={String(pageviews.length)} />
        <Stat label="Time on site" value={fmtDuration(totalSeconds)} sub={`about ${fmtDuration(avgSeconds)} each`} />
        <Stat label="Signups" value={String(signupsInRange)} sub="in this range" />
        <Stat label="Team views" value={String(signedInPageviews)} sub="signed in, not counted above" />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <h2 className="text-ink-900 mb-3 text-base font-semibold">Most visited</h2>
          {topPages.length === 0 ? (
            <p className="text-ink-500 text-sm">Nothing tracked in this range yet.</p>
          ) : (
            topPages.map(([path, count]) => (
              <BarRow key={path} label={path} count={count} max={maxPage} />
            ))
          )}
        </Card>
        <Card>
          <h2 className="text-ink-900 mb-3 text-base font-semibold">Demos watched</h2>
          {demoRows.length === 0 ? (
            <p className="text-ink-500 text-sm">No demo plays in this range yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-ink-500 text-left text-xs uppercase tracking-wider">
                  <th className="py-2">Demo</th>
                  <th className="py-2 text-right">Started</th>
                  <th className="py-2 text-right">Finished</th>
                </tr>
              </thead>
              <tbody className="divide-court-200 divide-y">
                {demoRows.map((d) => (
                  <tr key={d.slug}>
                    <td className="text-ink-800 py-2 font-medium">{d.slug}</td>
                    <td className="text-ink-900 py-2 text-right font-semibold">{d.plays}</td>
                    <td className="text-ink-600 py-2 text-right">{d.done}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      <Card>
        <h2 className="text-ink-900 mb-3 text-base font-semibold">Where they came from</h2>
        {topReferrers.length === 0 ? (
          <p className="text-ink-500 text-sm">
            No referrers recorded yet. Direct visits and same-site navigation carry none.
          </p>
        ) : (
          topReferrers.map(([source, count]) => (
            <BarRow key={source} label={source} count={count} max={topReferrers[0][1]} />
          ))
        )}
      </Card>
    </>
  )
}

async function Signups({ since }: { since: object }) {
  const signups = await (prisma as any).launchSignup.findMany({
    where: since,
    orderBy: { createdAt: "desc" },
    take: 500,
  })
  const byIdentity = new Map<string, number>()
  let emails = 0
  let phones = 0
  for (const s of signups) {
    byIdentity.set(s.identity ?? "Not picked", (byIdentity.get(s.identity ?? "Not picked") ?? 0) + 1)
    if (s.kind === "email") emails++
    else phones++
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <span className="bg-court-100 text-court-800 rounded-full px-3 py-1 text-xs font-semibold">
          {emails} emails
        </span>
        <span className="bg-court-100 text-court-800 rounded-full px-3 py-1 text-xs font-semibold">
          {phones} phone numbers
        </span>
        {[...byIdentity.entries()].map(([k, v]) => (
          <span key={k} className="bg-ink-100 text-ink-600 rounded-full px-3 py-1 text-xs font-medium">
            {k}: {v}
          </span>
        ))}
        <a
          href="/api/admin/launch/export"
          className="bg-play-600 hover:bg-play-700 ml-auto rounded-full px-4 py-1.5 text-sm font-semibold text-white"
        >
          Export CSV
        </a>
      </div>

      {signups.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-ink-500 text-sm">Nobody in this range yet.</p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="divide-court-200 w-full min-w-[640px] divide-y">
              <thead className="bg-court-50">
                <tr>
                  {["Contact", "Kind", "Identity", "From", "When"].map((h) => (
                    <th key={h} className="text-ink-500 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-court-200 divide-y">
                {signups.map((s: any) => (
                  <tr key={s.id}>
                    <td className="text-ink-900 whitespace-nowrap px-4 py-3 text-sm font-medium">{s.contact}</td>
                    <td className="text-ink-600 px-4 py-3 text-sm">{s.kind}</td>
                    <td className="px-4 py-3">
                      <span className="bg-play-50 text-play-700 rounded-full px-2 py-0.5 text-xs font-medium">
                        {s.identity ?? "Not picked"}
                      </span>
                    </td>
                    <td className="text-ink-600 px-4 py-3 text-xs">{s.source}</td>
                    <td className="text-ink-500 whitespace-nowrap px-4 py-3 text-xs">
                      {format(new Date(s.createdAt), "MMM d, h:mm a")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  )
}

async function Claims({ since }: { since: object }) {
  const claims = await (prisma as any).clubClaim.findMany({
    where: since,
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { tenant: { select: { name: true, city: true } } },
  })
  const byStatus = new Map<string, number>()
  for (const c of claims) byStatus.set(c.status, (byStatus.get(c.status) ?? 0) + 1)

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {[...byStatus.entries()].map(([k, v]) => (
          <span key={k} className="bg-ink-100 text-ink-600 rounded-full px-3 py-1 text-xs font-medium">
            {k.replace(/_/g, " ").toLowerCase()}: {v}
          </span>
        ))}
        <Link
          href="/dashboard/admin/claims"
          className="text-play-600 hover:text-play-700 ml-auto text-sm font-semibold"
        >
          Review claims
        </Link>
      </div>

      {claims.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-ink-500 text-sm">No claims in this range yet.</p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="divide-court-200 w-full min-w-[640px] divide-y">
              <thead className="bg-court-50">
                <tr>
                  {["Club", "Method", "Status", "Claimer", "When"].map((h) => (
                    <th key={h} className="text-ink-500 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-court-200 divide-y">
                {claims.map((c: any) => (
                  <tr key={c.id}>
                    <td className="px-4 py-3 text-sm">
                      <div className="text-ink-900 font-medium">{c.tenant?.name ?? "(removed)"}</div>
                      <div className="text-ink-400 text-xs">{c.tenant?.city ?? ""}</div>
                    </td>
                    <td className="text-ink-600 px-4 py-3 text-sm">{(c.method ?? "").toLowerCase()}</td>
                    <td className="px-4 py-3">
                      <span className="bg-play-50 text-play-700 rounded-full px-2 py-0.5 text-xs font-medium">
                        {c.status.replace(/_/g, " ").toLowerCase()}
                      </span>
                    </td>
                    <td className="text-ink-600 px-4 py-3 text-xs">{c.claimantEmail ?? c.contactPoint ?? ""}</td>
                    <td className="text-ink-500 whitespace-nowrap px-4 py-3 text-xs">
                      {format(new Date(c.createdAt), "MMM d, h:mm a")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  )
}

async function Journeys({
  since,
  sessionId,
  range,
}: {
  since: object
  sessionId?: string
  range: string
}) {
  if (sessionId) {
    const events = await (prisma as any).activityEvent.findMany({
      where: { sessionId },
      orderBy: { createdAt: "asc" },
      take: 500,
    })
    if (!events.length) {
      return (
        <Card className="p-8 text-center">
          <p className="text-ink-500 text-sm">That session has no events.</p>
        </Card>
      )
    }
    const startAt = new Date(events[0].createdAt).getTime()
    const seconds = events.filter((e: any) => e.kind === "heartbeat").length * HEARTBEAT_SECONDS
    const visible = events.filter((e: any) => e.kind !== "heartbeat")

    const describe = (e: any): string => {
      const meta = (e.meta ?? {}) as Record<string, unknown>
      if (e.kind === "pageview") return `Opened ${e.path}`
      if (e.kind === "click") return `Clicked: ${meta.label ?? "(unknown)"}`
      if (e.kind === "signup") return `Signed up (${meta.identity ?? "no identity"})`
      if (e.kind === "demo") {
        if (meta.action === "play") return `Started the ${e.path.replace("/demos/", "")} demo`
        if (meta.action === "done") return `Finished the ${e.path.replace("/demos/", "")} demo`
        return `Reached chapter "${meta.chapter ?? "?"}" of ${e.path.replace("/demos/", "")}`
      }
      return e.kind
    }

    return (
      <Card>
        <div className="mb-4 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h2 className="text-ink-900 text-base font-semibold">One visitor's journey</h2>
          <span className="text-ink-500 text-sm">
            {format(new Date(events[0].createdAt), "MMM d, h:mm a")} · {fmtDuration(seconds)} active
            {events[0].signedIn ? " · signed in (team)" : ""}
          </span>
          <Link
            href={`/dashboard/admin/launch?tab=journeys&range=${range}`}
            className="text-play-600 hover:text-play-700 ml-auto text-sm font-semibold"
          >
            All sessions
          </Link>
        </div>
        <ol className="border-ink-100 space-y-0 border-l pl-4">
          {visible.map((e: any) => (
            <li key={e.id} className="relative py-1.5">
              <span className="bg-play-500 absolute -left-[21px] top-3 h-2 w-2 rounded-full" />
              <span className="text-ink-400 mr-3 inline-block w-14 text-xs tabular-nums">
                +{fmtDuration(Math.round((new Date(e.createdAt).getTime() - startAt) / 1000))}
              </span>
              <span className="text-ink-800 text-sm">{describe(e)}</span>
            </li>
          ))}
        </ol>
      </Card>
    )
  }

  const grouped = await (prisma as any).activityEvent.groupBy({
    by: ["sessionId", "signedIn"],
    where: since,
    _count: { _all: true },
    _min: { createdAt: true },
    _max: { createdAt: true },
  })
  const sessions = grouped
    .sort(
      (a: any, b: any) => new Date(b._max.createdAt).getTime() - new Date(a._max.createdAt).getTime()
    )
    .slice(0, 50)

  const heartbeats = await (prisma as any).activityEvent.groupBy({
    by: ["sessionId"],
    where: { ...since, kind: "heartbeat", sessionId: { in: sessions.map((s: any) => s.sessionId) } },
    _count: { _all: true },
  })
  const timeBySession = new Map<string, number>(
    heartbeats.map((h: any) => [h.sessionId, h._count._all * HEARTBEAT_SECONDS])
  )
  const firstPages = await (prisma as any).activityEvent.findMany({
    where: { kind: "pageview", sessionId: { in: sessions.map((s: any) => s.sessionId) } },
    orderBy: { createdAt: "asc" },
    select: { sessionId: true, path: true },
  })
  const entryBySession = new Map<string, string>()
  for (const p of firstPages) {
    if (!entryBySession.has(p.sessionId)) entryBySession.set(p.sessionId, p.path)
  }

  return sessions.length === 0 ? (
    <Card className="p-8 text-center">
      <p className="text-ink-500 text-sm">No visitor sessions in this range yet.</p>
    </Card>
  ) : (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="divide-court-200 w-full min-w-[640px] divide-y">
          <thead className="bg-court-50">
            <tr>
              {["Started", "Entry page", "Active time", "Events", "Who"].map((h) => (
                <th key={h} className="text-ink-500 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-court-200 divide-y">
            {sessions.map((s: any) => (
              <tr key={s.sessionId} className="hover:bg-court-50">
                <td className="whitespace-nowrap px-4 py-3 text-sm">
                  <Link
                    href={`/dashboard/admin/launch?tab=journeys&range=${range}&session=${s.sessionId}`}
                    className="text-play-600 hover:text-play-700 font-semibold"
                  >
                    {format(new Date(s._min.createdAt), "MMM d, h:mm a")}
                  </Link>
                </td>
                <td className="text-ink-700 px-4 py-3 text-sm">{entryBySession.get(s.sessionId) ?? ""}</td>
                <td className="text-ink-700 px-4 py-3 text-sm">
                  {fmtDuration(timeBySession.get(s.sessionId) ?? 0)}
                </td>
                <td className="text-ink-600 px-4 py-3 text-sm">{s._count._all}</td>
                <td className="px-4 py-3">
                  {s.signedIn ? (
                    <span className="bg-ink-100 text-ink-500 rounded-full px-2 py-0.5 text-xs font-medium">team</span>
                  ) : (
                    <span className="bg-court-100 text-court-800 rounded-full px-2 py-0.5 text-xs font-medium">visitor</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
