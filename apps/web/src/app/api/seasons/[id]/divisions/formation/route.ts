import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@youthbasketballhub/db"
import { seasonPlannerAuth } from "@/lib/scheduler/planner-auth"
import { formDivisions } from "@/lib/divisions/formation"

export const dynamic = "force-dynamic"

/**
 * Division formation — the guided "Create divisions" dialog's API (owner
 * 2026-08-09: a scheduling-time decision in its own space, never inline).
 * GET: the grades with their current divisions + registered teams.
 * POST: apply one grade's division specs (split, re-shuffle, or merge).
 */

const postSchema = z.object({
  ageGroup: z.string().min(1).max(80),
  divisions: z
    .array(
      z.object({
        id: z.string().nullable(),
        name: z.string().min(1).max(80),
        teamIds: z.array(z.string()).min(2).max(64),
      })
    )
    .min(1)
    .max(6),
  scheduling: z.enum(["LOCKED", "PREFER", "OPEN"]).optional(),
  playoffPooling: z.enum(["GRADE", "DIVISION"]).optional(),
})

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const gate = await seasonPlannerAuth(params.id)
    if (gate.status !== 200) return NextResponse.json({ error: gate.error }, { status: gate.status })
    const divisions = await (prisma as any).division.findMany({
      where: { seasonId: params.id },
      orderBy: [{ ageGroup: "asc" }, { name: "asc" }],
      include: {
        teamSubmissions: {
          where: { status: "APPROVED" },
          select: { teamId: true, team: { select: { name: true } } },
        },
      },
    })
    const byGrade = new Map<string, any>()
    for (const d of divisions) {
      const key = d.ageGroup ?? d.name
      if (!byGrade.has(key)) byGrade.set(key, { ageGroup: key, divisions: [], teams: 0 })
      const g = byGrade.get(key)
      g.divisions.push({
        id: d.id,
        name: d.name,
        teams: d.teamSubmissions.map((ts: any) => ({ teamId: ts.teamId, name: ts.team?.name ?? ts.teamId })),
      })
      g.teams += d.teamSubmissions.length
    }
    return NextResponse.json({ grades: [...byGrade.values()].filter((g) => g.teams > 0) })
  } catch (error) {
    console.error("divisions formation GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const gate = await seasonPlannerAuth(params.id)
    if (gate.status !== 200) return NextResponse.json({ error: gate.error }, { status: gate.status })
    const body = postSchema.parse(await req.json())
    const result = await formDivisions(params.id, body.ageGroup, body.divisions)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 422 })
    /* Settings A and B ride the same guided flow (owner: the related
       questions belong to this moment). */
    const season = await (prisma as any).season.findUnique({
      where: { id: params.id },
      select: { gradeScheduling: true, playoffConfig: true },
    })
    if (body.scheduling) {
      const gs = { ...((season?.gradeScheduling ?? {}) as Record<string, string>) }
      if (body.divisions.length <= 1 || body.scheduling === "LOCKED") delete gs[body.ageGroup]
      else gs[body.ageGroup] = body.scheduling
      await (prisma as any).season.update({ where: { id: params.id }, data: { gradeScheduling: gs } })
    }
    if (body.playoffPooling) {
      const pc = { ...((season?.playoffConfig ?? {}) as Record<string, any>) }
      pc[body.ageGroup] = { ...(pc[body.ageGroup] ?? {}), pooling: body.playoffPooling }
      await (prisma as any).season.update({ where: { id: params.id }, data: { playoffConfig: pc } })
    }
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    console.error("divisions formation POST error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
