import { notFound, redirect } from "next/navigation"
import { getSessionUserId } from "@/lib/auth-helpers"
import { isClubAdmin, isClubStaff } from "@/lib/authz/team-scope"
import { prisma } from "@youthbasketballhub/db"
import { SmartBack } from "@/components/ui"
import { loadSession, sessionRoster } from "@/lib/evaluation/session"
import { EvaluationCapture } from "./capture"

export const dynamic = "force-dynamic"

export default async function EvaluatePage({ params }: { params: { id: string; sessionId: string } }) {
  const auth = await getSessionUserId()
  if (!auth?.userId) redirect("/sign-in")

  const session = await loadSession(params.sessionId)
  if (!session || session.tenantId !== params.id) notFound()

  // Any club staff may score. Deliberately not narrowed to the coaches of the
  // team or age group: coaches work across groups (owner 2026-08-21).
  if (!(await isClubStaff(auth.userId, session.tenantId))) notFound()

  const mine = await (prisma as any).evaluationRating.findMany({
    where: { sessionId: session.id, evaluatorId: auth.userId },
    select: { poolMemberId: true, categoryId: true, score: true },
  })
  const initialScores: Record<string, number> = {}
  for (const r of mine) initialScores[`${r.poolMemberId}|${r.categoryId}`] = r.score

  return (
    <div className="mx-auto max-w-4xl px-4 py-4">
      <SmartBack fallback={`/clubs/${params.id}/tryouts`} fallbackLabel="Back to tryouts" />
      <EvaluationCapture
        sessionId={session.id}
        clubId={params.id}
        title={session.event.title}
        status={session.status}
        categories={session.template.categories.map((c: any) => ({
          id: c.id,
          key: c.key,
          label: c.label,
          hint: c.hint,
          anchors: (c.anchors ?? {}) as Record<string, string>,
        }))}
        roster={await sessionRoster(session)}
        initialScores={initialScores}
        isAdmin={await isClubAdmin(auth.userId, session.tenantId)}
      />
    </div>
  )
}
