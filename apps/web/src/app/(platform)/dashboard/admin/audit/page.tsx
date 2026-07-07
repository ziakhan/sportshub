import { prisma } from "@youthbasketballhub/db"
import Link from "next/link"
import { format } from "date-fns"
import { redirect } from "next/navigation"
import { getSessionUserId } from "@/lib/auth-helpers"

export const dynamic = "force-dynamic"

/**
 * The audit trail, visible — every manual override (roster edits, jersey
 * changes, referee assignments, forfeits, admin actions) with who/what/when.
 */
export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: { action?: string }
}) {
  const auth = await getSessionUserId()
  if (!auth?.isPlatformAdmin) redirect("/dashboard")

  const actionFilter = searchParams.action

  const [entries, actions] = await Promise.all([
    prisma.auditLog.findMany({
      where: actionFilter ? { action: actionFilter } : {},
      select: {
        id: true,
        action: true,
        resource: true,
        resourceId: true,
        changes: true,
        createdAt: true,
        user: { select: { firstName: true, lastName: true, email: true } },
        tenantId: true,
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }) as any,
    prisma.auditLog.groupBy({
      by: ["action"],
      _count: true,
      orderBy: { _count: { action: "desc" } },
    }) as any,
  ])

  const tenantIds = [...new Set(entries.map((e: any) => e.tenantId).filter(Boolean))] as string[]
  const tenants = tenantIds.length
    ? await prisma.tenant.findMany({
        where: { id: { in: tenantIds } },
        select: { id: true, name: true },
      })
    : []
  const tenantName = new Map(tenants.map((t: any) => [t.id, t.name]))

  return (
    <div className="space-y-5">
      <div className="border-ink-100 shadow-soft rounded-2xl border bg-white p-6">
        <div className="border-play-100 bg-play-50 text-play-600 mb-3 inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em]">
          Admin
        </div>
        <h1 className="font-display text-ink-950 text-2xl font-bold">Audit trail</h1>
        <p className="text-ink-600 text-sm">
          Every manual override leaves a record — roster edits, jersey changes, referee
          assignments, forfeits, admin actions.
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Link
          href="/dashboard/admin/audit"
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            !actionFilter ? "bg-play-600 text-white" : "bg-ink-100 text-ink-700 hover:bg-ink-200"
          }`}
        >
          All
        </Link>
        {actions.map((a: any) => (
          <Link
            key={a.action}
            href={`/dashboard/admin/audit?action=${a.action}`}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              actionFilter === a.action
                ? "bg-play-600 text-white"
                : "bg-ink-100 text-ink-700 hover:bg-ink-200"
            }`}
          >
            {a.action.toLowerCase().replace(/_/g, " ")} ({a._count})
          </Link>
        ))}
      </div>

      {entries.length === 0 ? (
        <div className="border-ink-200 rounded-2xl border bg-white p-8 text-center text-sm">
          <p className="text-ink-500">No audit entries yet.</p>
        </div>
      ) : (
        <div className="border-ink-100 shadow-soft overflow-x-auto rounded-2xl border bg-white">
          <table className="divide-court-200 min-w-full divide-y">
            <thead className="bg-court-50">
              <tr>
                <th className="text-ink-500 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">When</th>
                <th className="text-ink-500 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Who</th>
                <th className="text-ink-500 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Action</th>
                <th className="text-ink-500 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Where</th>
                <th className="text-ink-500 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Details</th>
              </tr>
            </thead>
            <tbody className="divide-court-200 divide-y">
              {entries.map((e: any) => (
                <tr key={e.id}>
                  <td className="text-ink-500 whitespace-nowrap px-4 py-3 text-xs">
                    {format(new Date(e.createdAt), "MMM d, h:mm a")}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm">
                    <div className="text-ink-900 font-medium">
                      {e.user ? `${e.user.firstName ?? ""} ${e.user.lastName ?? ""}`.trim() : "—"}
                    </div>
                    <div className="text-ink-400 text-xs">{e.user?.email}</div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className="bg-play-50 text-play-700 rounded-full px-2 py-0.5 text-xs font-medium">
                      {e.action.toLowerCase().replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="text-ink-600 whitespace-nowrap px-4 py-3 text-xs">
                    {(e.tenantId && tenantName.get(e.tenantId)) || e.resource}
                  </td>
                  <td className="text-ink-600 max-w-md px-4 py-3 text-xs">
                    {e.changes ? (
                      <span className="line-clamp-2 break-all">
                        {Object.entries(e.changes as Record<string, unknown>)
                          .filter(([k]) => k !== "playerIds")
                          .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.length : String(v)}`)
                          .join(" · ")}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
