import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@youthbasketballhub/db"
import { getSessionUserId } from "@/lib/auth-helpers"
import { isClubStaff } from "@/lib/authz/team-scope"
import { loadSession } from "@/lib/evaluation/session"

export const dynamic = "force-dynamic"

/**
 * Submitting scores.
 *
 * A batch, because the capture screen queues locally and flushes: a gym's
 * wifi drops and a coach must never lose a station's worth of work to it.
 * Each row is upserted on (session, player, category, evaluator), so a
 * re-send after a flaky connection corrects rather than duplicates, and a
 * coach can change their mind about a score without creating a second one.
 */

const bodySchema = z.object({
  ratings: z
    .array(
      z.object({
        poolMemberId: z.string(),
        categoryId: z.string(),
        score: z.number().int().min(1).max(5),
        isPrivate: z.boolean().optional(),
      })
    )
    .max(200),
})

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await getSessionUserId()
  if (!auth?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const session = await loadSession(params.id)
  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (!(await isClubStaff(auth.userId, session.tenantId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  // A closed session is frozen. That is the whole point of closing it.
  if (session.status !== "OPEN") {
    return NextResponse.json({ error: "This evaluation is not open" }, { status: 409 })
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 })

  const valid = new Set(session.template.categories.map((c: any) => c.id))
  const rows = parsed.data.ratings.filter((r) => valid.has(r.categoryId))

  let saved = 0
  for (const r of rows) {
    await (prisma as any).evaluationRating.upsert({
      where: {
        sessionId_poolMemberId_categoryId_evaluatorId: {
          sessionId: session.id,
          poolMemberId: r.poolMemberId,
          categoryId: r.categoryId,
          evaluatorId: auth.userId,
        },
      },
      create: {
        sessionId: session.id,
        poolMemberId: r.poolMemberId,
        categoryId: r.categoryId,
        evaluatorId: auth.userId,
        score: r.score,
        isPrivate: r.isPrivate ?? false,
      },
      update: { score: r.score, isPrivate: r.isPrivate ?? false },
    })
    saved++
  }

  return NextResponse.json({ saved })
}
