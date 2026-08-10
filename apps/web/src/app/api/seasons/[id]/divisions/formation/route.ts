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
})

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const gate = await seasonPlannerAuth(params.id)
    if (gate.status !== 200) return NextResponse.json({ error: gate.error }, { status: gate.status })
    const season = await (prisma as any).season.findUnique({
      where: { id: params.id },
      select: { gradeScheduling: true, status: true },
    })
    const gradeScheduling = (season?.gradeScheduling ?? {}) as Record<string, string>
    // Owner ruling 2026-08-09: divisions are free to change (with a
    // regenerate) until the schedule is PUBLISHED; after that they lock and
    // new teams join an existing division.
    const publishedCount = await (prisma as any).game.count({
      where: { seasonId: params.id, phase: "REGULAR", publishedAt: { not: null } },
    })
    const locked = publishedCount > 0 || ["IN_PROGRESS", "COMPLETED"].includes(season?.status)
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
      if (!byGrade.has(key))
        byGrade.set(key, {
          ageGroup: key,
          scheduling: gradeScheduling[key] ?? "LOCKED",
          divisions: [],
          teams: 0,
        })
      const g = byGrade.get(key)
      g.divisions.push({
        id: d.id,
        name: d.name,
        teams: d.teamSubmissions.map((ts: any) => ({ teamId: ts.teamId, name: ts.team?.name ?? ts.teamId })),
      })
      g.teams += d.teamSubmissions.length
    }
    const grades = [...byGrade.values()].filter((g) => g.teams > 0)
    // Definite staleness: a fenced (NO cross-play) split grade whose games
    // still pair teams across divisions needs a regenerate.
    const staleGrades: string[] = []
    if (!locked) {
      const divOfTeam = new Map<string, string>()
      const gradeOfTeam = new Map<string, string>()
      for (const g of grades) {
        if (g.divisions.length < 2) continue
        for (const d of g.divisions) {
          for (const t of d.teams) {
            divOfTeam.set(t.teamId, d.id)
            gradeOfTeam.set(t.teamId, g.ageGroup)
          }
        }
      }
      if (divOfTeam.size > 0) {
        const games = await (prisma as any).game.findMany({
          where: { seasonId: params.id, phase: "REGULAR" },
          select: { homeTeamId: true, awayTeamId: true },
        })
        const seen = new Set<string>()
        for (const gm of games) {
          const age = gradeOfTeam.get(gm.homeTeamId)
          if (!age || seen.has(age)) continue
          if ((gradeScheduling[age] ?? "LOCKED") !== "LOCKED") continue
          const dh = divOfTeam.get(gm.homeTeamId)
          const da = divOfTeam.get(gm.awayTeamId)
          if (dh && da && dh !== da) {
            staleGrades.push(age)
            seen.add(age)
          }
        }
      }
    }
    return NextResponse.json({ grades, locked, staleGrades })
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
    const seasonRow = await (prisma as any).season.findUnique({
      where: { id: params.id },
      select: { status: true },
    })
    const publishedCount = await (prisma as any).game.count({
      where: { seasonId: params.id, phase: "REGULAR", publishedAt: { not: null } },
    })
    if (publishedCount > 0 || ["IN_PROGRESS", "COMPLETED"].includes(seasonRow?.status)) {
      return NextResponse.json(
        { error: "The schedule is published — divisions are locked. New teams join an existing division." },
        { status: 422 }
      )
    }
    const result = await formDivisions(params.id, body.ageGroup, body.divisions)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 422 })
    /* Cross-division play is the one season-start setting that rides this
       flow. Playoff questions live on the Playoffs tab (owner 2026-08-09:
       decide them when the season is ending, not here). */
    if (body.scheduling) {
      const season = await (prisma as any).season.findUnique({
        where: { id: params.id },
        select: { gradeScheduling: true },
      })
      const gs = { ...((season?.gradeScheduling ?? {}) as Record<string, string>) }
      if (body.divisions.length <= 1 || body.scheduling === "LOCKED") delete gs[body.ageGroup]
      else gs[body.ageGroup] = body.scheduling
      await (prisma as any).season.update({ where: { id: params.id }, data: { gradeScheduling: gs } })
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
