import { notFound, redirect } from "next/navigation"
import { getSessionUserId } from "@/lib/auth-helpers"
import { isClubAdmin, isClubStaff } from "@/lib/authz/team-scope"
import { SmartBack } from "@/components/ui"
import { buildReport, loadSession } from "@/lib/evaluation/session"
import { DirectorControls } from "./controls"

export const dynamic = "force-dynamic"

const SCORE_TONE = (n: number | null): string => {
  if (n === null) return "text-ink-400"
  if (n >= 4) return "text-play-700"
  if (n >= 3) return "text-ink-800"
  return "text-hoop-700"
}

export default async function ReportPage({ params }: { params: { id: string; sessionId: string } }) {
  const auth = await getSessionUserId()
  if (!auth?.userId) redirect("/sign-in")

  const session = await loadSession(params.sessionId)
  if (!session || session.tenantId !== params.id) notFound()
  if (!(await isClubStaff(auth.userId, session.tenantId))) notFound()

  const admin = await isClubAdmin(auth.userId, session.tenantId)
  const report = await buildReport(params.sessionId, auth.userId)
  if (!report) notFound()

  const names = new Map(report.roster.map((r) => [r.poolMemberId, r]))
  const evaluatorName = new Map(report.evaluators.map((e) => [e.id, e.name]))

  return (
    <div className="mx-auto max-w-5xl px-4 py-4">
      <SmartBack
        fallback={`/clubs/${params.id}/tryouts/evaluate/${params.sessionId}`}
        fallbackLabel="Back to scoring"
      />

      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-ink-950 text-2xl font-bold tracking-tight">{session.event.title}</h1>
          <p className="text-ink-500 text-sm">
            {report.rows.length} evaluated · {report.evaluators.length} evaluator
            {report.evaluators.length === 1 ? "" : "s"}
          </p>
        </div>
        {admin && (
          <DirectorControls
            sessionId={session.id}
            status={session.status}
            visibility={session.visibility}
          />
        )}
      </div>

      {!report.canSeeOthers && (
        <p className="border-ink-200 text-ink-600 mb-4 rounded-xl border bg-white p-3 text-sm">
          This club keeps evaluations private, so you are seeing your own scores only. A club admin
          sees the consolidated report.
        </p>
      )}

      {report.rows.length === 0 ? (
        <p className="text-ink-500 rounded-2xl border border-dashed py-14 text-center text-sm">
          Nothing scored yet.
        </p>
      ) : (
        <div className="space-y-2">
          {report.rows.map((row, i) => {
            const who = names.get(row.playerId)
            return (
              <div key={row.playerId} className="border-ink-200 rounded-2xl border bg-white p-3">
                <div className="flex items-start gap-3">
                  <span className="text-ink-400 w-6 shrink-0 pt-1 text-sm font-bold tabular-nums">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-ink-950 font-bold">
                        <span className="tabular-nums">#{who?.number ?? "?"}</span>{" "}
                        {who?.name ?? "Unknown"}
                      </span>
                      <span className="text-ink-500 text-xs">{who?.ageGroup}</span>
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                      <span className={SCORE_TONE(row.adjusted ?? row.overall)}>
                        <span className="text-lg font-bold tabular-nums">
                          {(row.adjusted ?? row.overall)?.toFixed(1) ?? "–"}
                        </span>
                        <span className="text-ink-400 ml-1 text-xs">adjusted</span>
                      </span>
                      <span className="text-ink-500 text-xs">
                        raw <span className="tabular-nums">{row.overall?.toFixed(1) ?? "–"}</span>
                      </span>
                      <span className="text-ink-500 text-xs">
                        {row.evaluatorCount} evaluator{row.evaluatorCount === 1 ? "" : "s"}
                      </span>
                      {row.spreadLow !== null && (
                        <span className="text-ink-500 text-xs tabular-nums">
                          {row.spreadLow} – {row.spreadHigh}
                        </span>
                      )}
                      {/* Disagreement is a finding, not noise to be averaged away. */}
                      {row.contested && (
                        <span className="bg-hoop-50 text-hoop-800 rounded-full px-2 py-0.5 text-[11px] font-bold">
                          Coaches disagree
                        </span>
                      )}
                      {/* One opinion is not a score. */}
                      {row.lowConfidence && (
                        <span className="bg-ink-100 text-ink-600 rounded-full px-2 py-0.5 text-[11px] font-bold">
                          Only one look
                        </span>
                      )}
                    </div>

                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                      {row.perCategory.map((c) => (
                        <span key={c.key} className="text-ink-600 text-xs">
                          {c.label}{" "}
                          <span className="text-ink-900 font-semibold tabular-nums">
                            {c.average.toFixed(1)}
                          </span>
                        </span>
                      ))}
                    </div>

                    {report.canSeeAttribution && row.perEvaluator.length > 0 && (
                      <p className="text-ink-400 mt-2 text-[11px]">
                        {row.perEvaluator
                          .map((e) => `${evaluatorName.get(e.evaluatorId) ?? "Coach"} ${e.overall}`)
                          .join(" · ")}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Advisory, admin-only, and never an accusation: a coach may simply
          have seen what the others missed, which is why several score. */}
      {admin && report.deviations.length > 0 && (
        <div className="border-ink-200 mt-6 rounded-2xl border bg-white p-4">
          <h2 className="text-ink-900 text-sm font-bold uppercase tracking-wide">Worth a look</h2>
          <p className="text-ink-500 mt-1 text-xs">
            These scores sit far from what the rest of the room said about the same player, and far
            from how that coach scored everyone else. It may be nothing.
          </p>
          <ul className="mt-3 space-y-1">
            {report.deviations.slice(0, 8).map((d, i) => (
              <li key={i} className="text-ink-700 text-sm">
                <span className="font-semibold">{evaluatorName.get(d.evaluatorId) ?? "Coach"}</span>{" "}
                on{" "}
                <span className="font-semibold">
                  #{names.get(d.playerId)?.number} {names.get(d.playerId)?.name}
                </span>{" "}
                <span className="text-ink-500 tabular-nums">
                  {d.delta > 0 ? "+" : ""}
                  {d.delta} vs the room
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
